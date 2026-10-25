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
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "OPENROUTER_API_KEY",
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
    svc.has_openrouter_api = True
    svc.has_gemini_api = False
    svc.has_cf_api = False
    svc.has_hf_api = False
    svc.has_nvidia_api = False
    svc._embed_dim = None
    svc._embed_cache = {}
    svc._embed_cache_meta = {}
    svc._embed_cache_max = 128
    svc._embed_cache_ttl = 1800.0
    svc._openrouter_embed_down_until = 0.0
    return svc


def test_embedding_cache_returns_stored_vector():
    """get_embedding should return the cached vector for a repeated query
    without re-invoking the provider."""
    svc = _fresh_service()
    call_count = [0]

    def mock_embed(text):
        call_count[0] += 1
        return [0.1, 0.2, 0.3]

    svc._openrouter_get_embedding = mock_embed

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

    def mock_embed(text):
        return [float(ord(text[0]))]

    svc._openrouter_get_embedding = mock_embed

    # Insert 3 unique queries — cache max is 2, so the first is evicted
    svc.get_embedding("aaa")
    svc.get_embedding("bbb")
    svc.get_embedding("ccc")

    assert len(svc._embed_cache) == 2

    # Replace with a counting mock to detect cache hits vs misses
    call_count = [0]
    def counting_mock(text):
        call_count[0] += 1
        return [0.0]

    svc._openrouter_get_embedding = counting_mock

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


if __name__ == "__main__":
    test_embedding_cache_returns_stored_vector()
    test_embedding_cache_evicts_oldest()
    test_embedding_cache_does_not_store_empty()
    test_get_embedding_raises_without_api()
    test_store_embed_cache_respects_max()
    print("\n✅ All vector store cache tests passed!")
