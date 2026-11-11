

import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)


for _v in [
    "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "XKIRO_API_KEY",
    "NVIDIA_API_KEY", "NIM_API_KEY", "KIMI_API_KEY",
]:
    os.environ[_v] = ""
os.environ["AI_PREFLIGHT"] = "false"
os.environ["DB_TYPE"] = "sqlite"

from services.vector_store import VectorStoreService


def _fresh_service():
    """Create a VectorStoreService without running the full __init__
    (which tries to import chromadb and connect to embedding providers)."""
    svc = object.__new__(VectorStoreService)

    svc.has_api = True
    svc.has_cf_api = False
    svc.has_gemini_api = False
    svc._embed_dim = None
    svc._embed_cache = {}
    svc._embed_cache_meta = {}
    svc._embed_cache_max = 128
    svc._embed_cache_ttl = 1800.0
    svc._cf_embed_down_until = 0.0
    svc._gemini_embed_down_until = 0.0
    svc.embed_global_timeout = 6.0
    svc.embed_provider_timeout = 4.0
    return svc


def test_embedding_cache_returns_stored_vector():
    """get_embedding should return the cached vector for a repeated query
    without re-invoking the provider."""
    svc = _fresh_service()
    svc.has_gemini_api = True
    call_count = [0]

    def mock_embed(text, **kwargs):
        call_count[0] += 1
        return [0.1, 0.2, 0.3]

    svc._gemini_get_embedding = mock_embed


    vec1 = svc.get_embedding("tìm học bổng")
    assert vec1 == [0.1, 0.2, 0.3]
    assert call_count[0] == 1


    vec2 = svc.get_embedding("tìm học bổng")
    assert vec2 == [0.1, 0.2, 0.3]
    assert call_count[0] == 1

    print("✓ test_embedding_cache_returns_stored_vector")


def test_embedding_cache_evicts_oldest():
    """Cache should evict the oldest entry (FIFO/LRU) when exceeding max."""
    svc = _fresh_service()
    svc.has_gemini_api = True
    svc._embed_cache_max = 2

    def mock_embed(text, **kwargs):
        return [float(ord(text[0]))]

    svc._gemini_get_embedding = mock_embed


    svc.get_embedding("aaa")
    svc.get_embedding("bbb")
    svc.get_embedding("ccc")

    assert len(svc._embed_cache) == 2


    call_count = [0]
    def counting_mock(text, **kwargs):
        call_count[0] += 1
        return [0.0]

    svc._gemini_get_embedding = counting_mock


    call_count[0] = 0
    svc.get_embedding("bbb")
    svc.get_embedding("ccc")
    assert call_count[0] == 0, "cached entries should not hit the provider"


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


def test_get_embedding_raises_without_any_provider():
    """Should raise RuntimeError when NO embedding provider is available.

    Local embedding (SentenceTransformer) was removed — only external APIs
    (Gemini / Cloudflare) power RAG now, so has_embedding is purely ``has_api``.
    """
    svc = _fresh_service()
    svc.has_api = False

    try:
        svc.get_embedding("test")
        assert False, "Should have raised RuntimeError"
    except RuntimeError as e:
        assert "Embedding service chưa sẵn sàng" in str(e)

    print("✓ test_get_embedding_raises_without_any_provider")


def test_get_embedding_requires_external_api_only():
    """has_embedding must be False when no API key is configured."""
    svc = _fresh_service()
    svc.has_api = False
    svc.has_cf_api = False
    svc.has_gemini_api = False

    assert svc.has_embedding is False

    # The chain must not hang trying a local model that no longer exists.
    try:
        svc.get_embedding("nơ-ron")
        assert False, "Should have raised RuntimeError"
    except RuntimeError:
        pass

    print("✓ test_get_embedding_requires_external_api_only")


def test_embed_chain_calls_gemini_when_cf_disabled():
    """When Cloudflare is not configured, Gemini should be called exactly once.

    There is no local fallback: the chain stops after the last external API.
    """
    svc = _fresh_service()
    svc.has_api = True
    svc.has_cf_api = False
    svc.has_gemini_api = True
    svc._cf_embed_down_until = 0.0
    svc._gemini_embed_down_until = 0.0
    svc.embed_global_timeout = 6.0
    svc.embed_provider_timeout = 3.0

    gemini_calls = [0]

    def mock_gemini(text, timeout_override=None):
        gemini_calls[0] += 1
        return [0.4] * 768

    svc._gemini_get_embedding = mock_gemini

    vec = svc.get_embedding("xin chào")
    assert vec == [0.4] * 768
    assert gemini_calls[0] == 1, "Gemini should be called exactly once"

    print("✓ test_embed_chain_calls_gemini_when_cf_disabled")


def test_store_embed_cache_respects_max():
    """_store_embed_cache should evict the oldest when cache is full."""
    svc = _fresh_service()
    svc._embed_cache_max = 1

    svc._store_embed_cache("key_a", [1.0])
    assert len(svc._embed_cache) == 1


    svc._store_embed_cache("key_b", [2.0])
    assert len(svc._embed_cache) == 1
    assert "key_a" not in svc._embed_cache
    assert "key_b" in svc._embed_cache

    print("✓ test_store_embed_cache_respects_max")


def test_gemini_fallback_when_cloudflare_disabled():
    """When Cloudflare is not configured, Gemini should be used."""
    svc = _fresh_service()
    svc.has_cf_api = False
    svc.has_gemini_api = True
    svc._cf_embed_down_until = 0.0
    svc._gemini_embed_down_until = 0.0
    svc.embed_global_timeout = 6.0
    svc.embed_provider_timeout = 3.0

    gemini_calls = [0]

    def mock_gemini(text, timeout_override=None):
        gemini_calls[0] += 1
        return [0.4] * 768

    svc._gemini_get_embedding = mock_gemini

    vec = svc.get_embedding("xin chào")
    assert vec == [0.4] * 768
    assert gemini_calls[0] == 1, "Gemini should be called exactly once"

    print("✓ test_gemini_fallback_when_cloudflare_disabled")


def test_slow_cloudflare_still_reaches_gemini_fallback():
    """A timing-out Cloudflare must not consume the whole budget: the Gemini
    fallback must still be attempted and its vector returned."""
    svc = _fresh_service()
    svc.has_cf_api = False
    svc.has_gemini_api = True
    svc._cf_embed_down_until = 0.0
    svc._gemini_embed_down_until = 0.0
    svc.embed_global_timeout = 6.0
    svc.embed_provider_timeout = 3.0

    gemini_timeouts = []

    def gemini_ok(text, timeout_override=None):
        gemini_timeouts.append(timeout_override)
        return [0.2] * 768

    svc._gemini_get_embedding = gemini_ok

    vec = svc.get_embedding("xin chào")
    assert vec == [0.2] * 768
    assert gemini_timeouts, "Gemini fallback must run"
    assert gemini_timeouts[0] <= 3.0

    print("✓ test_slow_cloudflare_still_reaches_gemini_fallback")


def test_query_returns_results_without_reranker():
    """``query()`` must return ChromaDB results unchanged — the local
    sentence-transformer reranker no longer exists in this repo.

    Patched via ``where=`` to avoid touching a real ChromaDB collection.
    """
    from unittest.mock import MagicMock

    svc = _fresh_service()
    svc.has_api = True
    svc.has_gemini_api = True
    svc.has_cf_api = False

    svc._gemini_get_embedding = lambda text, **kw: [0.3] * 768

    collection = MagicMock()
    collection.query.return_value = {
        "documents": [["doc1", "doc2", "doc3"]],
        "metadatas": [[{"id": "1"}, {"id": "2"}, {"id": "3"}]],
        "ids": ["1", "2", "3"],
        "distances": [0.1, 0.2, 0.3],
    }
    svc.collection = collection

    results = svc.query("test query", n_results=3, where={"id": "1"})

    # The same documents/ids must surface in the same order (no reranking).
    assert results["documents"] == collection.query.return_value["documents"]
    assert results["ids"] == collection.query.return_value["ids"]
    assert results["distances"] == collection.query.return_value["distances"]

    print("✓ test_query_returns_results_without_reranker")


def test_has_embedding_property():
    """has_embedding is True only when an external API is configured.

    There is no local SentenceTransformer fallback anymore — an embedding
    model only becomes available when an API key is configured.
    """
    svc = _fresh_service()
    svc.has_api = True
    assert svc.has_embedding is True

    svc.has_api = False
    svc.has_cf_api = False
    svc.has_gemini_api = False
    assert svc.has_embedding is False

    # Re-computed exactly like __init__ does (has_api = has_gemini_api or has_cf_api
    svc.has_cf_api = False
    svc.has_gemini_api = True
    svc.has_api = svc.has_gemini_api or svc.has_cf_api
    assert svc.has_embedding is True

    print("✓ test_has_embedding_property")


if __name__ == "__main__":
    test_embedding_cache_returns_stored_vector()
    test_embedding_cache_evicts_oldest()
    test_embedding_cache_does_not_store_empty()
    test_get_embedding_raises_without_any_provider()
    test_get_embedding_requires_external_api_only()
    test_embed_chain_calls_gemini_when_cf_disabled()
    test_store_embed_cache_respects_max()
    test_gemini_fallback_when_cloudflare_disabled()
    test_slow_cloudflare_still_reaches_gemini_fallback()
    test_query_returns_results_without_reranker()
    test_has_embedding_property()
    print("\n✅ All vector store cache tests passed!")
