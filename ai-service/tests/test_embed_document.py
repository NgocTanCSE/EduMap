"""Tests for the incremental embed_document() method.

Verifies that when a new book or location is created, the backend can
embed a SINGLE document into the ChromaDB vector store without triggering
a full re-sync (seed_data). This is the "TỰ ĐỘNG NHÚNG (Embed) vào Vector DB
ngay khi có sách hay địa điểm mới" feature.
"""

import os
import sys
import types
import time

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure no real API providers are configured
for _v in [
    "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN",
]:
    os.environ[_v] = ""
os.environ["DB_TYPE"] = "sqlite"


def _mock_chromadb():
    """Build a lightweight ChromaDB mock and inject it into sys.modules."""
    mock = types.ModuleType("chromadb")

    _collections = {}

    class _MockCollection:
        def __init__(self, name="edumap_docs"):
            self.name = name
            self.documents = {}
            self.embeddings = {}
            self.metadatas = {}
            _collections[name] = self

        def upsert(self, **kwargs):
            ids = kwargs.get("ids", [])
            docs = kwargs.get("documents", [])
            embs = kwargs.get("embeddings")
            metas = kwargs.get("metadatas", [])
            for i, id_ in enumerate(ids):
                self.documents[id_] = docs[i] if i < len(docs) else ""
                self.metadatas[id_] = metas[i] if i < len(metas) else {}
                if embs is not None:
                    self.embeddings[id_] = embs[i]

        def count(self):
            return len(self.documents)

        def get(self, **kw):
            return {"embeddings": list(self.embeddings.values())} if self.embeddings else {}

        def query(self, **kw):
            ids = list(self.documents.keys())
            docs = list(self.documents.values())
            return {
                "documents": [docs],
                "metadatas": [list(self.metadatas.values())],
                "ids": [ids],
                "distances": [[]],
            }

        def add(self, **kwargs):
            self.upsert(**kwargs)

    class _MockClient:
        def __init__(self, **kw):
            pass

        def get_or_create_collection(self, name):
            if name not in _collections:
                return _MockCollection(name)
            return _collections[name]

    class _MockSettings:
        def __init__(self, **kw):
            pass

    mock.PersistentClient = _MockClient
    mock.config = types.ModuleType("chromadb.config")
    mock.config.Settings = _MockSettings
    sys.modules["chromadb"] = mock
    sys.modules["chromadb.config"] = mock.config

    ph = types.ModuleType("posthog")
    ph.disabled = True
    ph.capture = lambda *a, **k: None
    sys.modules["posthog"] = ph

    return _MockCollection


def _fresh_service(collection=None):
    """Create a VectorStoreService with a mock collection, bypassing __init__."""
    from services.vector_store import VectorStoreService
    svc = object.__new__(VectorStoreService)
    svc.has_api = True
    svc.has_gemini_api = False
    svc.has_cf_api = False
    svc._embed_dim = 768
    svc._embed_cache = {}
    svc._embed_cache_meta = {}
    svc._embed_cache_max = 128
    svc._embed_cache_ttl = 1800.0
    svc._gemini_embed_down_until = 0.0
    svc._cf_embed_down_until = 0.0
    svc.embed_global_timeout = 6.0
    svc.embed_provider_timeout = 4.0
    # Local embedding attributes (for has_embedding property resilience)
    svc.local_embedding_disabled = True  # default: disabled in tests (no sentence_transformers)
    svc._local_embedder = None
    svc._local_embedder_failed = False
    svc._local_embedder_loaded = False
    svc.local_embed_dim = 768
    svc.local_reranker_disabled = True
    svc._local_reranker = None
    svc._local_reranker_failed = False
    svc._local_reranker_loaded = False
    svc.collection = collection
    # Mock get_embedding to return a fixed 768-dim vector
    svc.get_embedding = lambda text: [0.01] * 768
    return svc


def test_embed_document_with_api_and_collection():
    """embed_document should embed + upsert a single doc when API + collection are available."""
    MockCollection = _mock_chromadb()
    svc = _fresh_service(collection=MockCollection())
    ok = svc.embed_document(
        "Test book: Machine Learning Basics.",
        {"title": "ML Basics", "category": "library", "source": "db_learning_materials"},
        "material_test_001",
    )
    assert ok is True
    assert svc.collection.count() == 1
    assert "material_test_001" in svc.collection.documents
    assert "ML Basics" in str(svc.collection.metadatas)
    print("✓ test_embed_document_with_api_and_collection")


def test_embed_document_no_api_upserts_text_only():
    """Without an embedding provider, embed_document should still upsert the text."""
    MockCollection = _mock_chromadb()
    svc = _fresh_service(collection=MockCollection())
    svc.has_api = False
    ok = svc.embed_document(
        "Dia diem: Thu vien DNTU.",
        {"title": "Thu vien DNTU", "category": "location", "source": "db_locations"},
        "location_test_001",
    )
    assert ok is True
    assert svc.collection.count() == 1
    # No embedding should have been stored
    assert len(svc.collection.embeddings) == 0
    print("✓ test_embed_document_no_api_upserts_text_only")


def test_embed_document_none_collection_graceful():
    """When ChromaDB collection is None, embed_document should return False (not crash)."""
    MockCollection = _mock_chromadb()
    svc = _fresh_service(collection=None)
    ok = svc.embed_document("test text", {"category": "library"}, "id_none")
    assert ok is False
    print("✓ test_embed_document_none_collection_graceful")


def test_embed_document_pads_wrong_dim():
    """If get_embedding returns a different dim, embed_document should pad."""
    MockCollection = _mock_chromadb()
    svc = _fresh_service(collection=MockCollection())
    # Return a 512-dim vector when collection expects 768
    svc.get_embedding = lambda text: [0.05] * 512
    ok = svc.embed_document("padded doc", {"category": "library"}, "pad_test")
    assert ok is True
    emb = svc.collection.embeddings["pad_test"]
    assert len(emb) == 768, f"Expected 768 dims after padding, got {len(emb)}"
    print("✓ test_embed_document_pads_wrong_dim")


def test_embed_document_upsert_is_idempotent():
    """Calling embed_document twice with the same ID should update, not duplicate."""
    MockCollection = _mock_chromadb()
    svc = _fresh_service(collection=MockCollection())
    svc.embed_document("v1 text", {"category": "library"}, "dup_001")
    svc.embed_document("v2 text (updated)", {"category": "library"}, "dup_001")
    assert svc.collection.count() == 1, "Upsert should be idempotent — no duplicate"
    assert "v2 text" in svc.collection.documents["dup_001"]
    print("✓ test_embed_document_upsert_is_idempotent")


def test_embed_document_caches_embedding():
    """embed_document should cache the computed embedding (md5 key) so that
    subsequent get_embedding calls for the same text hit the cache."""
    MockCollection = _mock_chromadb()
    svc = _fresh_service(collection=MockCollection())

    # Use the REAL get_embedding method (not the lambda override) so that
    # the internal _embed_cache + provider-chain logic is exercised.
    del svc.get_embedding  # remove lambda override, fall back to class method

    # Enable Gemini provider and mock the provider-level call
    svc.has_api = True
    svc.has_gemini_api = True
    svc.has_cf_api = False
    call_count = [0]

    def mock_gemini_embed(text, **kwargs):
        call_count[0] += 1
        return [0.1] * 768

    svc._gemini_get_embedding = mock_gemini_embed
    svc._gemini_embed_down_until = 0.0
    svc._cf_embed_down_until = 0.0

    # Embed the same text twice
    svc.embed_document("cached doc", {"category": "library"}, "cache_001")
    svc.embed_document("cached doc", {"category": "library"}, "cache_002")
    # get_embedding should call the provider only once (second hit is cached)
    assert call_count[0] == 1, f"Expected 1 provider call (cached), got {call_count[0]}"

    # The cache should now have the embedding
    import hashlib as _hl
    cache_key = _hl.md5("cached doc".encode("utf-8")).hexdigest()
    assert cache_key in svc._embed_cache, "Embedding should be cached after embed_document"
    # A direct get_embedding call for the same text should NOT hit the provider
    svc.get_embedding("cached doc")
    assert call_count[0] == 1, "Cached embedding should not trigger another provider call"
    print("✓ test_embed_document_caches_embedding")


def test_embed_document_for_book_and_location():
    """Simulate the exact use case: auto-embed a new book and a new location."""
    MockCollection = _mock_chromadb()
    svc = _fresh_service(collection=MockCollection())

    # Simulate library.service.ts create() calling embedDocument
    book_text = "Tai lieu hoc tap: Gioi thieu Machine Learning. The loai / Nganh: AI. Lop / khoi: Dai hoc. Tac gia: DNTU. Tom tat: Khoa hoc AI ung dung."
    svc.embed_document(book_text, {"title": "Gioi thieu ML", "category": "library", "source": "db_learning_materials", "type": "book"}, "material_new_book")

    # Simulate map.service.ts createPoi() calling embedDocument
    poi_text = "Dia diem (library): Phong thi nghiem A. Dia chi: Tang 2, nha B. Thong tin: Phong thuc hanh chuyen nghanh."
    svc.embed_document(poi_text, {"title": "Phong thi nghiem A", "category": "location", "source": "db_locations"}, "location_new_poi")

    assert svc.collection.count() == 2
    ids = set(svc.collection.documents.keys())
    assert "material_new_book" in ids
    assert "location_new_poi" in ids
    print("✓ test_embed_document_for_book_and_location")


def test_add_documents_partial_failure_is_tolerated():
    """A single failing embedding must NOT discard the whole batch.

    Production symptom this guards against: seed_data() reported
    `0 documents, status=error` on HF Spaces because one slow provider made the
    old batch-wide list comprehension raise. Now the failing document is
    skipped and the rest are stored.
    """
    MockCollection = _mock_chromadb()
    svc = _fresh_service(collection=MockCollection())

    def _flaky_embedding(text):
        if "BAD" in text:
            raise RuntimeError("Khong the lay embedding (gioi han 6.0s)")
        return [0.01] * 768

    svc.get_embedding = _flaky_embedding
    stats = svc.add_documents(
        ["Doc A", "BAD Doc B", "Doc C"],
        [{"title": "A"}, {"title": "B"}, {"title": "C"}],
        ["doc_a", "doc_b", "doc_c"],
    )

    assert stats == {"added": 2, "failed": 1, "total": 3}
    assert svc.collection.count() == 2
    ids = set(svc.collection.documents.keys())
    assert ids == {"doc_a", "doc_c"}
    print("✓ test_add_documents_partial_failure_is_tolerated")


def test_add_documents_all_success():
    """All documents are stored and reported when embeddings work."""
    MockCollection = _mock_chromadb()
    svc = _fresh_service(collection=MockCollection())
    stats = svc.add_documents(
        ["Doc A", "Doc B"],
        [{"title": "A"}, {"title": "B"}],
        ["doc_a", "doc_b"],
    )
    assert stats == {"added": 2, "failed": 0, "total": 2}
    assert svc.collection.count() == 2
    print("✓ test_add_documents_all_success")


if __name__ == "__main__":
    test_embed_document_with_api_and_collection()
    test_embed_document_no_api_upserts_text_only()
    test_embed_document_none_collection_graceful()
    test_embed_document_pads_wrong_dim()
    test_embed_document_upsert_is_idempotent()
    test_embed_document_caches_embedding()
    test_embed_document_for_book_and_location()
    test_add_documents_partial_failure_is_tolerated()
    test_add_documents_all_success()
    print("\n✅ All embed_document tests passed!")
