"""Tests for the VectorStoreService embedding cache optimization.

Verifies that get_embedding() caches results to avoid redundant
(slow) curl/subprocess embedding calls for identical queries — the
single biggest ChromaDB/LLM optimization for chat.
"""

import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure no real API providers are configured
for _v in [
    "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "XKIRO_API_KEY",
    "NVIDIA_API_KEY", "NIM_API_KEY",
]:
    os.environ[_v] = ""
os.environ["AI_PREFLIGHT"] = "false"
os.environ["DB_TYPE"] = "sqlite"

from services.vector_store import VectorStoreService


def _fresh_service():
    """Create a VectorStoreService without running the full __init__
    (which tries to import chromadb and connect to embedding providers)."""
    svc = object.__new__(VectorStoreService)
    # Initialize only the attributes get_embedding() needs
    svc.has_api = True
    svc.has_xkiro_api = True
    svc.has_gemini_api = False
    svc.has_cf_api = False
    svc.has_hf_api = False
    svc.has_nvidia_api = False
    svc._embed_dim = None
    svc._embed_cache = {}
    svc._embed_cache_meta = {}
    svc._embed_cache_max = 128
    svc._embed_cache_ttl = 1800.0
    svc._xkiro_embed_down_until = 0.0
    svc.embed_global_timeout = 6.0
    svc.embed_provider_timeout = 4.0
    return svc


def test_embedding_cache_returns_stored_vector():
    """get_embedding should return the cached vector for a repeated query
    without re-invoking the provider."""
    svc = _fresh_service()
    call_count = [0]

    def mock_embed(text, **kwargs):
        call_count[0] += 1
        return [0.1, 0.2, 0.3]

    svc._xkiro_get_embedding = mock_embed

    # First call — computes and caches
    vec1 = svc.get_embedding("tìm học bổng")
    assert vec1 == [0.1, 0.2, 0.3]
    assert call_count[0] == 1

    # Second call — returns cached (no second provider call)
    vec2 = svc.get_embedding("tìm học bổng")
    assert vec2 == [0.1, 0.2, 0.3]
    assert call_count[0] == 1  # provider called only once!

    print("✓ test_embedding_cache_returns_stored_vector")


def test_embedding_cache_evicts_oldest():
    """Cache should evict the oldest entry (FIFO/LRU) when exceeding max."""
    svc = _fresh_service()
    svc._embed_cache_max = 2  # small cache for testing

    def mock_embed(text, **kwargs):
        return [float(ord(text[0]))]

    svc._xkiro_get_embedding = mock_embed

    # Insert 3 unique queries — cache max is 2, so the first is evicted
    svc.get_embedding("aaa")
    svc.get_embedding("bbb")
    svc.get_embedding("ccc")

    assert len(svc._embed_cache) == 2

    # Replace with a counting mock to detect cache hits vs misses
    call_count = [0]
    def counting_mock(text, **kwargs):
        call_count[0] += 1
        return [0.0]

    svc._xkiro_get_embedding = counting_mock

    # "bbb" and "ccc" should be cache hits (no provider calls)
    call_count[0] = 0
    svc.get_embedding("bbb")
    svc.get_embedding("ccc")
    assert call_count[0] == 0, "cached entries should not hit the provider"

    # "aaa" was evicted — should miss cache and call provider
    call_count[0] = 0
    svc.get_embedding("aaa")
    assert call_count[0] == 1, "evicted entry should trigger a provider call"

    print("✓ test_embedding_cache_evicts_oldest")


def test_embedding_cache_does_not_store_empty():
    """Empty text should not pollute the cache."""
    svc = _fresh_service()
    vec = svc.get_embedding("")
    assert vec == []
    assert len(svc._embed_cache) == 0

    print("✓ test_embedding_cache_does_not_store_empty")


def test_get_embedding_raises_without_api():
    """Should raise RuntimeError when no embedding provider is configured."""
    svc = _fresh_service()
    svc.has_api = False
    try:
        svc.get_embedding("test")
        assert False, "Should have raised RuntimeError"
    except RuntimeError:
        pass

    print("✓ test_get_embedding_raises_without_api")


def test_store_embed_cache_respects_max():
    """_store_embed_cache should evict the oldest when cache is full."""
    svc = _fresh_service()
    svc._embed_cache_max = 1

    svc._store_embed_cache("key_a", [1.0])
    assert len(svc._embed_cache) == 1

    # Adding a new key should evict the first
    svc._store_embed_cache("key_b", [2.0])
    assert len(svc._embed_cache) == 1
    assert "key_a" not in svc._embed_cache
    assert "key_b" in svc._embed_cache

    print("✓ test_store_embed_cache_respects_max")


def test_xkiro_unprefixed_model_is_normalized():
    """Legacy HF secret 'text-embedding-3-small' must be sent as
    'openai/text-embedding-3-small' (XKIRO requires provider prefix)."""
    import json as _json
    import subprocess as _subprocess

    svc = _fresh_service()
    svc.xkiro_base = "https://api.xkiro.com/v1"
    svc.xkiro_key = "test-key"
    svc.xkiro_embed_model = "text-embedding-3-small"
    svc.xkiro_timeout = 8.0
    svc._embed_dim = 768

    captured = {}

    class _Proc:
        returncode = 0
        stdout = _json.dumps({"data": [{"embedding": [0.1] * 768}]})
        stderr = ""

    def fake_run(cmd, **kwargs):
        captured["cmd"] = cmd
        return _Proc()

    orig_run = _subprocess.run
    _subprocess.run = fake_run
    try:
        vec = svc._xkiro_get_embedding("hello", timeout_override=4)
    finally:
        _subprocess.run = orig_run

    assert len(vec) == 768
    # The payload is the argument following "-d".
    payload = _json.loads(captured["cmd"][captured["cmd"].index("-d") + 1])
    assert payload["model"] == "openai/text-embedding-3-small"
    # Dimension is pinned to the collection so we do not truncate 1536 -> 768.
    assert payload["dimensions"] == 768

    print("✓ test_xkiro_unprefixed_model_is_normalized")


def test_slow_xkiro_still_reaches_hf_fallback():
    """A timing-out XKIRO must not consume the whole budget: the HF
    fallback must still be attempted and its vector returned."""
    svc = _fresh_service()
    svc.has_gemini_api = False
    svc.has_cf_api = False
    svc.has_hf_api = True
    svc.has_nvidia_api = False
    svc.has_kimi_api = False
    svc._gemini_embed_down_until = 0.0
    svc._cf_embed_down_until = 0.0
    svc._hf_embed_down_until = 0.0
    svc._nvidia_embed_down_until = 0.0
    svc._kimi_embed_down_until = 0.0
    svc.embed_global_timeout = 6.0
    svc.embed_provider_timeout = 3.0

    xkiro_timeouts = []
    hf_timeouts = []

    def slow_xkiro(text, timeout_override=None):
        xkiro_timeouts.append(timeout_override)
        raise RuntimeError("curl: (28) Operation timed out")

    def hf_ok(text, timeout_override=None):
        hf_timeouts.append(timeout_override)
        return [0.2] * 768

    svc._xkiro_get_embedding = slow_xkiro
    svc._hf_get_embedding = hf_ok

    vec = svc.get_embedding("xin chào")
    assert vec == [0.2] * 768
    assert xkiro_timeouts and xkiro_timeouts[0] <= 3.0
    assert hf_timeouts, "HF fallback must still run after XKIRO fails"
    assert hf_timeouts[0] <= 3.0

    print("✓ test_slow_xkiro_still_reaches_hf_fallback")


if __name__ == "__main__":
    test_embedding_cache_returns_stored_vector()
    test_embedding_cache_evicts_oldest()
    test_embedding_cache_does_not_store_empty()
    test_get_embedding_raises_without_api()
    test_store_embed_cache_respects_max()
    test_xkiro_unprefixed_model_is_normalized()
    test_slow_xkiro_still_reaches_hf_fallback()
    print("\n✅ All vector store cache tests passed!")
