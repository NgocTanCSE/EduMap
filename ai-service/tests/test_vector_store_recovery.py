"""Regression tests for the ChromaDB collection recovery path (HF free tier).

Production log evidence (2026-10-30):

    Vector store collection is None — returning empty RAG results (graceful degradation).

That line means the one-shot ChromaDB init at import time failed (15 s SIGALRM
on a cold 2-vCPU boot, corrupt ``/tmp/chroma_db``, …) and ``collection`` stayed
``None`` for the whole process lifetime → RAG was permanently empty.

Fix under test:
  1. ``_init_collection()`` is retryable and only arms ``signal.SIGALRM`` in the
     main thread (previously ``signal.signal()`` raised ``ValueError`` when the
     service was imported from a worker thread and aborted initialization).
  2. ``_ensure_collection()`` retries lazily, at most once per
     ``CHROMA_RETRY_SECONDS`` (cooldown respected).
  3. ``query()`` / ``add_documents()`` / ``semantic_career_search()`` call it
     before degrading.
"""

import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

os.environ["DB_TYPE"] = "sqlite"
os.environ["AI_PREFLIGHT"] = "false"
os.environ.setdefault("DB_SQLITE_PATH", os.path.abspath(
    os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db")
))

import services.vector_store as vs_module


class _FakeCollection:
    def count(self):
        return 0


class _FakeClient:
    def get_or_create_collection(self, name):
        assert name == "edumap_docs"
        return _FakeCollection()


class _FlakyChroma:
    """First ``PersistentClient`` call fails, later calls succeed."""

    def __init__(self):
        self.calls = 0

    def PersistentClient(self, path=None, settings=None):
        self.calls += 1
        if self.calls == 1:
            raise TimeoutError("ChromaDB initialization exceeded 30s")
        return _FakeClient()


def test_collection_init_can_be_retried_after_failure(monkeypatch):
    """A failed first init must not disable RAG for the process lifetime."""
    flaky = _FlakyChroma()
    monkeypatch.setattr(vs_module, "chromadb", flaky)

    svc = vs_module.VectorStoreService()
    assert flaky.calls == 1
    assert svc.collection is None, "first attempt is expected to fail"

    # Cooldown is respected — a burst of queries must not hammer ChromaDB.
    monkeypatch.setattr(vs_module.time, "monotonic", lambda: 0.0)
    svc._collection_next_retry = 10.0

    assert svc._ensure_collection() is False
    assert flaky.calls == 1

    # After the cooldown the retry succeeds and RAG works again.
    svc._collection_next_retry = 0.0
    assert svc._ensure_collection() is True
    assert flaky.calls == 2
    assert isinstance(svc.collection, _FakeCollection)


def test_query_degrades_to_empty_shape_without_chromadb(monkeypatch):
    """``query()`` returns the empty RAG shape (never raises) when chromadb is
    unavailable, so ``chat_with_rag`` still answers LLM-only."""
    monkeypatch.setattr(vs_module, "chromadb", None)

    svc = vs_module.VectorStoreService()
    result = svc.query("học bổng DNTU")

    assert result["documents"] == [[]]
    assert result["metadatas"] == [[]]
    assert result["ids"] == [[]]
    assert result["distances"] == [[]]


def test_semantic_career_search_degrades_without_chromadb(monkeypatch):
    monkeypatch.setattr(vs_module, "chromadb", None)

    svc = vs_module.VectorStoreService()
    assert svc.semantic_career_search(["python"], 3) == []
