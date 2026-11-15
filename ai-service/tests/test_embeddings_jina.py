"""Jina embedding provider tests (batch request, cache, dim fit, error handling)."""

import json
import os
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.vector_store import VectorStoreService


class FakeProc:
    def __init__(self, stdout="", stderr="", returncode=0):
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode


class FakeCollection:
    def __init__(self):
        self.calls = []

    def upsert(self, documents=None, embeddings=None, metadatas=None, ids=None):
        self.calls.append({"n": len(ids), "ids": list(ids), "emb": len(embeddings or [])})

    add = upsert

    def count(self):
        return 0

    def get(self, **kwargs):
        return {}


def _jina_json(n, dim=4):
    return json.dumps({"data": [{"index": i, "embedding": [0.1 * (i + 1)] * dim} for i in range(n)]})


@pytest.fixture
def jina(monkeypatch):
    monkeypatch.setenv("JINA_API_KEY", "jina_test")
    monkeypatch.setenv("JINA_EMBEDDING_MODEL", "jina-embeddings-v5-text-small")
    monkeypatch.delenv("JINA_BASE_URL", raising=False)
    svc = VectorStoreService()
    svc.collection = None
    return svc


def test_init_reads_jina_env(jina):
    assert jina.has_jina_api is True
    assert jina.has_embedding is True
    assert jina.jina_base_url == "https://api.jina.ai/v1"
    assert jina.jina_models == ["jina-embeddings-v5-text-small"]


def test_init_without_key_disables_embeddings(monkeypatch):
    monkeypatch.delenv("JINA_API_KEY", raising=False)
    svc = VectorStoreService()
    assert svc.has_embedding is False
    with pytest.raises(RuntimeError, match="JINA_API_KEY"):
        svc.get_embedding("xin chào")


def test_batch_uses_one_request_for_all_inputs(jina, monkeypatch):
    captured = {}

    def fake_run(cmd, **kwargs):
        captured["cmd"] = cmd
        return FakeProc(stdout=_jina_json(3))

    monkeypatch.setattr(subprocess, "run", fake_run)

    vecs = jina._jina_get_embeddings_batch(["a", "b", "c"])

    assert len(vecs) == 3
    assert len(captured["cmd"]) > 0
    assert captured["cmd"][:3] == ["curl", "--ipv4", "--insecure"]
    body = json.loads(captured["cmd"][captured["cmd"].index("-d") + 1])
    assert body["model"] == "jina-embeddings-v5-text-small"
    assert body["input"] == ["a", "b", "c"]


def test_auth_error_opens_circuit_breaker(jina, monkeypatch):
    err = json.dumps({"detail": "invalid api key"})
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: FakeProc(stdout=err))

    with pytest.raises(RuntimeError, match="Jina"):
        jina._jina_get_embeddings_batch(["a"])
    assert jina._jina_embed_down_until > 0


def test_get_embedding_truncates_to_collection_dim(jina, monkeypatch):
    jina._embed_dim = 3
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: FakeProc(stdout=_jina_json(1, dim=5)))

    vec = jina.get_embedding("học bổng")

    assert len(vec) == 3


def test_get_embedding_uses_cache(jina, monkeypatch):
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(cmd)
        return FakeProc(stdout=_jina_json(1))

    monkeypatch.setattr(subprocess, "run", fake_run)

    jina.get_embedding("cùng một câu hỏi")
    jina.get_embedding("cùng một câu hỏi")

    assert len(calls) == 1


def test_add_documents_batches_inputs(jina, monkeypatch):
    monkeypatch.setenv("EMBED_BATCH_SIZE", "2")
    jina.embed_batch_size = 2
    captured = []

    def fake_run(cmd, **kwargs):
        body = json.loads(cmd[cmd.index("-d") + 1])
        captured.append(len(body["input"]))
        return FakeProc(stdout=_jina_json(len(body["input"])))

    monkeypatch.setattr(subprocess, "run", fake_run)

    docs = [f"tai lieu {i}" for i in range(5)]
    metas = [{"title": f"t{i}"} for i in range(5)]
    ids = [f"id{i}" for i in range(5)]
    jina.collection = FakeCollection()
    jina._ensure_collection = lambda: True

    stats = jina.add_documents(docs, metas, ids)

    assert stats == {"added": 5, "failed": 0, "total": 5}
    assert captured == [2, 2, 1]


def test_add_documents_skips_failed_batch(jina, monkeypatch):
    jina.embed_batch_size = 2
    monkeypatch.setenv("EMBED_BATCH_SIZE", "2")

    def fake_run(cmd, **kwargs):
        body = json.loads(cmd[cmd.index("-d") + 1])
        if body["input"][0] == "bad":
            return FakeProc(stdout=json.dumps({"detail": "invalid input"}), returncode=0)
        return FakeProc(stdout=_jina_json(len(body["input"])))

    monkeypatch.setattr(subprocess, "run", fake_run)

    docs = ["bad", "bad", "ok1", "ok2"]
    metas = [{"title": str(i)} for i in range(4)]
    ids = [f"id{i}" for i in range(4)]
    jina.collection = FakeCollection()
    jina._ensure_collection = lambda: True

    stats = jina.add_documents(docs, metas, ids)

    assert stats["added"] == 2
    assert stats["failed"] == 2


def test_add_documents_without_provider_raises(jina, monkeypatch):
    monkeypatch.delenv("JINA_API_KEY", raising=False)
    svc = VectorStoreService()
    svc.collection = FakeCollection()
    svc._ensure_collection = lambda: True

    with pytest.raises(RuntimeError, match="Embedding service chưa sẵn sàng"):
        svc.add_documents(["a"], [{"title": "a"}], ["id-a"])