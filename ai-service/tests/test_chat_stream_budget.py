

import asyncio
import os
import sys
import time
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


def _plain_text(chunks):
    """Rebuild the assistant reply from the SSE token chunks."""
    import json

    text = []
    for chunk in chunks:
        raw = chunk.strip()
        if not raw.startswith("data: "):
            continue
        try:
            payload = json.loads(raw[len("data: "):])
        except ValueError:
            continue
        if "token" in payload:
            text.append(payload["token"])
    return "".join(text)


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


def test_stream_cuts_hung_provider_and_still_answers(monkeypatch):
    """A provider that hangs must be cut by the proxy budget, and the user
    must still receive the Vietnamese template reply before the deadline."""
    svc = LLMService()
    svc.is_ready = True
    svc.has_deepseek = True
    svc.has_gemini = False
    svc.has_cf = False

    monkeypatch.setattr(svc, "_deepseek_generate_stream", lambda *a, **k: iter(()))

    called = []

    def _hang(*args, **kwargs):
        called.append(True)
        time.sleep(5)
        return "không bao giờ trả về kịp"

    monkeypatch.setattr(svc, "_deepseek_generate", _hang)
    monkeypatch.setenv("STREAM_PROXY_DEADLINE_SECONDS", "2")
    monkeypatch.setenv("STREAM_FINAL_RESERVE_SECONDS", "1")

    async def _collect():
        started = time.monotonic()
        with patch("services.vector_store.vector_store") as mock_vs, \
             patch.object(llm_module.cache_service, "get", return_value=None), \
             patch.object(llm_module.cache_service, "set"):
            mock_vs.query.return_value = {"documents": [[]], "metadatas": [[]], "ids": [[]]}
            chunks = [chunk async for chunk in svc.chat_with_rag_stream("Xin chào")]


        return chunks, time.monotonic() - started

    chunks, elapsed = asyncio.run(_collect())

    assert called, "the provider should be attempted once before the timeout"


    assert elapsed < 3.0, f"stream took {elapsed:.1f}s — provider not cut"
    assert chunks[-1].strip() == "data: " + '{"done": true}'
    body = "".join(chunks)

    assert '"token"' in body
    assert _plain_text(chunks).strip(), "the user must receive some text"
    assert len(chunks) > 3


def test_stream_reply_has_no_markdown_markers(monkeypatch):
    """Chat replies must reach the browser as plain text (no ** / # / ```)."""
    svc = LLMService()
    svc.is_ready = True
    svc.has_deepseek = False
    svc.has_gemini = False
    svc.has_cf = False

    def _markdown_reply(message, sources, context):
        return "**Chào bạn**\n# Hướng dẫn\n- Bước 1\n```\ncode\n```"

    monkeypatch.setattr(svc, "_chat_fallback_reply", _markdown_reply)

    async def _collect():
        with patch("services.vector_store.vector_store") as mock_vs, \
             patch.object(llm_module.cache_service, "get", return_value=None), \
             patch.object(llm_module.cache_service, "set"):
            mock_vs.query.return_value = {"documents": [[]], "metadatas": [[]], "ids": [[]]}
            return [chunk async for chunk in svc.chat_with_rag_stream("Xin chào")]

    chunks = asyncio.run(_collect())
    body = "".join(chunks)
    assert "**" not in body
    assert "#" not in body
    assert "```" not in body

    text = _plain_text(chunks)
    assert "Chào bạn" in text
    assert "Hướng dẫn" in text
    assert "Bước 1" in text


def test_chat_with_rag_strips_markdown(monkeypatch):
    """The non-streaming chat path strips markdown too."""
    svc = LLMService()
    svc.has_deepseek = True
    svc.has_gemini = False
    svc.has_cf = False

    def _fake_generate(prompt, temperature=0.3, max_tokens=None, top_p=None):
        return "**Đậm** và _nghiêng_ với `code`"

    monkeypatch.setattr(svc, "_deepseek_generate", _fake_generate)

    async def _run():
        with patch("services.vector_store.vector_store") as mock_vs, \
             patch.object(llm_module.cache_service, "get", return_value=None), \
             patch.object(llm_module.cache_service, "set"):
            mock_vs.query.return_value = {"documents": [[]], "metadatas": [[]], "ids": [[]]}
            return await svc.chat_with_rag("Xin chào")

    res = asyncio.run(_run())
    assert res["reply"] == "Đậm và nghiêng với code"


def test_stream_template_fallback_strips_markdown_when_no_provider(monkeypatch):
    """No provider configured (HF free tier) → the streaming template fallback
    must still be plain text.

    Regression: ``chat_with_rag_stream`` had an early-exit branch for
    ``not self.is_ready`` that streamed ``_chat_fallback_reply()`` directly.
    That template contains ``**Câu hỏi của bạn:**`` and ``**<title>**``, so with
    zero API keys every chat reply showed literal asterisks in the bubble. The
    provider path stripped markdown; this branch did not.
    """
    svc = LLMService()
    svc.is_ready = False

    def _markdown_reply(message, sources, context):
        return "**Câu hỏi của bạn:** xin chào\n1. **Trường A**: mô tả"

    monkeypatch.setattr(svc, "_chat_fallback_reply", _markdown_reply)

    async def _collect():
        with patch("services.vector_store.vector_store") as mock_vs, \
             patch.object(llm_module.cache_service, "get", return_value=None), \
             patch.object(llm_module.cache_service, "set"):
            mock_vs.query.return_value = {"documents": [[]], "metadatas": [[]], "ids": [[]]}
            return [chunk async for chunk in svc.chat_with_rag_stream("xin chào")]

    chunks = asyncio.run(_collect())
    body = "".join(chunks)
    assert '"token"' in body, "the fallback reply must be streamed"
    assert "**" not in body, "markdown asterisks leaked into the chat bubble"
    text = _plain_text(chunks)
    assert "Câu hỏi của bạn:" in text
    assert "Trường A" in text
