"""Regression tests for the RAG chat SSE time budget (HF Spaces free tier).

Production log evidence (2026-10-30):

    INFO: ... "POST /api/ai/chat/stream HTTP/1.1" 200 OK
    [stream] Provider timeout — falling back: Provider timeout after 8.0s
    [Nest] WARN [AIService] SSE stream error from ai-service: aborted

The NestJS proxy closes the SSE request at 10s (``ai.service.ts``
``timeout: 10000``). The old cascade could spend 8s on a dead provider and then
up to 3s more on the local TinyLlama model → the connection was aborted before
the template fallback reply was streamed, leaving the chat bubble empty.

Fix under test:
  1. The local-LLM attempt is skipped when less than ``2s`` remain.
  2. ``_stream_word_by_word`` accepts ``max_duration`` and shrinks its per-word
     delay so a long reply still arrives before the deadline.
"""

import asyncio
import os
import sys
from unittest.mock import patch

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

os.environ["DB_TYPE"] = "sqlite"
os.environ["AI_PREFLIGHT"] = "false"
os.environ.setdefault("DB_SQLITE_PATH", os.path.abspath(
    os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db")
))

import services.llm_service as llm_module
from services.llm_service import LLMService


def test_stream_word_by_word_respects_max_duration(monkeypatch):
    """A 300-word reply must not exceed the caller's ``max_duration``."""
    svc = LLMService()
    text = " ".join(["từ"] * 300)
    delays = []

    async def _fake_sleep(seconds):
        delays.append(seconds)

    monkeypatch.setattr(asyncio, "sleep", _fake_sleep)

    async def _collect():
        return [chunk async for chunk in svc._stream_word_by_word(
            text, sources=[], is_final=True, max_duration=1.0,
        )]

    chunks = asyncio.run(_collect())

    assert delays, "expected at least one inter-word sleep"
    assert sum(delays) <= 1.0 + 1e-6
    assert max(delays) < 0.03, "per-word delay should be shrunk below the default"
    assert '"done": true' in chunks[-1]


def test_stream_skips_local_llm_when_proxy_budget_is_gone(monkeypatch):
    """When the proxy deadline is nearly exhausted, skip TinyLlama and stream
    the template reply so the client still receives an answer."""
    svc = LLMService()
    svc.is_ready = True          # bypass the "no providers → template" shortcut
    svc.has_cf = False
    svc.has_gemini = False
    svc.tinyllama_enabled = True

    monkeypatch.setenv("STREAM_PROXY_DEADLINE_SECONDS", "1")

    def _boom(*args, **kwargs):
        raise AssertionError("local LLM must not run past the proxy deadline")

    monkeypatch.setattr(llm_module, "_tinyllama_generate", _boom)

    async def _collect():
        with patch("services.vector_store.vector_store") as mock_vs, \
             patch.object(llm_module.cache_service, "get", return_value=None), \
             patch.object(llm_module.cache_service, "set"):
            mock_vs.query.return_value = {"documents": [[]], "metadatas": [[]], "ids": [[]]}
            return [chunk async for chunk in svc.chat_with_rag_stream("Xin chào")]

    chunks = asyncio.run(_collect())

    assert chunks[-1].strip() == "data: " + '{"done": true}'
    body = "".join(chunks)
    # Template fallback replies are Vietnamese strings, never empty metadata.
    assert '"token"' in body
    assert len(chunks) > 3
