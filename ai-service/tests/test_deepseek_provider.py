"""DeepSeek primary provider + markdown stripping tests (2026-10-30).

DeepSeek replaced Cloudflare Workers AI as the primary text-generation
provider; TinyLlama was removed completely. These tests cover the contract
that the rest of the service relies on:

  1. ``DEEPSEEK_API_KEY`` alone makes the service ready, and DeepSeek is tried
     before Gemini/Cloudflare.
  2. ``_deepseek_generate`` speaks the OpenAI-compatible ``/chat/completions``
     shape and calls ``curl --ipv4 --insecure`` (HF Spaces TLS workaround).
  3. Auth failures open a 5-minute circuit breaker instead of hammering the
     API on every request.
  4. ``_deepseek_generate_stream`` parses OpenAI SSE deltas.
  5. Chat output is flattened to plain text (no ``**``/``#``/``` markers),
     because the UI has no markdown renderer.
  6. The TinyLlama entry points are gone.
"""

import json
import os
import subprocess
import sys

import pytest

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

os.environ["DB_TYPE"] = "sqlite"
os.environ["AI_PREFLIGHT"] = "false"

import services.llm_service as llm_module  # noqa: E402
from services.llm_service import LLMService, _strip_markdown  # noqa: E402


# ── helpers ────────────────────────────────────────────────────────────────

def _deepseek_only(monkeypatch, key="sk-test-deepseek"):
    """Build an LLMService where DeepSeek is the only configured provider."""
    monkeypatch.setenv("DEEPSEEK_API_KEY", key)
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-chat,deepseek-reasoner")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("CLOUDFLARE_API_TOKEN", raising=False)
    monkeypatch.delenv("CLOUDFLARE_ACCOUNT_ID", raising=False)
    return LLMService()


class _Completed:
    def __init__(self, stdout="", stderr="", returncode=0):
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode


# ── configuration ──────────────────────────────────────────────────────────

def test_deepseek_key_alone_makes_service_ready(monkeypatch):
    svc = _deepseek_only(monkeypatch)
    assert svc.has_deepseek is True
    assert svc.is_ready is True
    assert svc.deepseek_model_name == "deepseek-chat"
    assert svc.deepseek_base_url == "https://api.deepseek.com"


def test_deepseek_model_cascade_is_configurable(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-x")
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-reasoner")
    monkeypatch.setenv("DEEPSEEK_BASE_URL", "https://proxy.example.com/v1/")
    svc = LLMService()
    assert svc.deepseek_models == ["deepseek-reasoner"]
    assert svc.deepseek_base_url == "https://proxy.example.com/v1"


# ── generation ─────────────────────────────────────────────────────────────

def test_deepseek_generate_parses_openai_response(monkeypatch):
    svc = _deepseek_only(monkeypatch)
    captured = {}

    def _fake_run(cmd, **kwargs):
        captured["cmd"] = cmd
        return _Completed(
            stdout=json.dumps(
                {
                    "choices": [
                        {"message": {"role": "assistant", "content": "  Xin chào  "}}
                    ]
                }
            )
        )

    monkeypatch.setattr(llm_module.subprocess, "run", _fake_run)

    text = svc._deepseek_generate("Giải thích đạo hàm", max_tokens=128, top_p=0.8)

    assert text == "Xin chào"
    cmd = captured["cmd"]
    assert cmd[0] == "curl"
    assert "--ipv4" in cmd and "--insecure" in cmd
    assert "https://api.deepseek.com/chat/completions" in cmd
    assert any("Authorization: Bearer sk-test-deepseek" == part for part in cmd)

    payload = json.loads(cmd[cmd.index("-d") + 1])
    assert payload["model"] == "deepseek-chat"
    assert payload["messages"][1] == {"role": "user", "content": "Giải thích đạo hàm"}
    assert payload["max_tokens"] == 128
    assert payload["top_p"] == 0.8
    assert payload["stream"] is False


def test_deepseek_generate_without_key_raises(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    svc = LLMService()
    svc.has_deepseek = False
    with pytest.raises(RuntimeError, match="DEEPSEEK_API_KEY"):
        svc._deepseek_generate("x")


def test_deepseek_tries_next_model_on_unknown_error(monkeypatch):
    svc = _deepseek_only(monkeypatch)
    svc.deepseek_models = ["deepseek-chat", "deepseek-reasoner"]
    calls = []

    def _fake_run(cmd, **kwargs):
        payload = json.loads(cmd[cmd.index("-d") + 1])
        calls.append(payload["model"])
        if payload["model"] == "deepseek-chat":
            return _Completed(
                stdout=json.dumps({"error": {"code": 500, "message": "server error"}})
            )
        return _Completed(stdout=json.dumps({"choices": [{"message": {"content": "OK"}}]}))

    monkeypatch.setattr(llm_module.subprocess, "run", _fake_run)

    assert svc._deepseek_generate("hi") == "OK"
    assert calls == ["deepseek-chat", "deepseek-reasoner"]


def test_deepseek_auth_error_opens_circuit_breaker(monkeypatch):
    svc = _deepseek_only(monkeypatch)

    def _fake_run(cmd, **kwargs):
        return _Completed(
            stdout=json.dumps({"error": {"code": 401, "message": "invalid api key"}})
        )

    monkeypatch.setattr(llm_module.subprocess, "run", _fake_run)

    with pytest.raises(RuntimeError, match="auth error"):
        svc._deepseek_generate("hi")
    assert svc._deepseek_down_until > 0

    # Second call short-circuits without touching the network.
    def _explode(*args, **kwargs):
        raise AssertionError("must not call curl while the breaker is open")

    monkeypatch.setattr(llm_module.subprocess, "run", _explode)
    with pytest.raises(RuntimeError, match="temporarily disabled"):
        svc._deepseek_generate("hi")


def test_deepseek_insufficient_balance_is_not_retried(monkeypatch):
    svc = _deepseek_only(monkeypatch)
    calls = []

    def _fake_run(cmd, **kwargs):
        calls.append(1)
        return _Completed(
            stdout=json.dumps({"error": {"code": 402, "message": "Insufficient Balance"}})
        )

    monkeypatch.setattr(llm_module.subprocess, "run", _fake_run)

    with pytest.raises(RuntimeError, match="insufficient balance"):
        svc._deepseek_generate("hi")
    assert len(calls) == 1, "a wallet-level failure must not retry the other model"


def test_deepseek_stream_parses_sse_deltas(monkeypatch):
    svc = _deepseek_only(monkeypatch)

    lines = [
        'data: {"choices":[{"delta":{"content":"Xin "}}]}',
        'data: {"choices":[{"delta":{"content":"chào"}}]}',
        "data: [DONE]",
    ]

    class _Proc:
        def __init__(self):
            self.stdout = iter([line + "\n" for line in lines])
            self.stderr = None

        def kill(self):
            pass

    monkeypatch.setattr(llm_module.subprocess, "Popen", lambda *a, **k: _Proc())

    tokens = list(svc._deepseek_generate_stream("hi"))
    assert tokens == ["Xin ", "chào"]


# ── cascade order ──────────────────────────────────────────────────────────

def test_cascade_prefers_deepseek(monkeypatch):
    svc = _deepseek_only(monkeypatch)
    svc.has_gemini = True
    svc.has_cf = True
    called = []

    monkeypatch.setattr(
        svc, "_deepseek_generate",
        lambda *a, **k: (called.append("deepseek"), "từ DeepSeek")[1],
    )
    monkeypatch.setattr(
        svc, "_gemini_generate",
        lambda *a, **k: (called.append("gemini"), "từ Gemini")[1],
    )
    monkeypatch.setattr(
        svc, "_cloudflare_generate",
        lambda *a, **k: (called.append("cloudflare"), "từ Cloudflare")[1],
    )

    assert svc._generate_text_with_fallback("prompt riêng biệt") == "từ DeepSeek"
    assert called == ["deepseek"]


def test_cascade_falls_back_to_gemini_then_cloudflare(monkeypatch):
    svc = _deepseek_only(monkeypatch)
    svc.has_gemini = True
    svc.has_cf = True
    called = []

    def _fail(name):
        def _inner(*a, **k):
            called.append(name)
            raise RuntimeError(f"{name} down")
        return _inner

    monkeypatch.setattr(svc, "_deepseek_generate", _fail("deepseek"))
    monkeypatch.setattr(svc, "_gemini_generate", _fail("gemini"))
    monkeypatch.setattr(svc, "_cloudflare_generate", _fail("cloudflare"))

    with pytest.raises(RuntimeError) as exc:
        svc._generate_text_with_fallback("prompt khác hoàn toàn")
    assert called == ["deepseek", "gemini", "cloudflare"]
    message = str(exc.value)
    assert "DeepSeek" in message and "Gemini" in message and "Cloudflare" in message


# ── TinyLlama removal ──────────────────────────────────────────────────────

def test_tinyllama_is_gone(monkeypatch):
    svc = _deepseek_only(monkeypatch)
    assert not hasattr(svc, "tinyllama_enabled")
    for name in ("_load_tinyllama", "_tinyllama_generate", "_tinyllama_template_fallback"):
        assert not hasattr(llm_module, name), f"{name} should have been removed"
    assert not hasattr(llm_module, "_TUTOR_TEMPLATES")


# ── markdown stripping ─────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("**Xin chào** bạn", "Xin chào bạn"),
        ("***Quan trọng***: nộp hồ sơ", "Quan trọng: nộp hồ sơ"),
        ("# Tiêu đề\nNội dung", "Tiêu đề\nNội dung"),
        ("```json\n{\"a\": 1}\n```", '{"a": 1}'),
        ("---\nA\n---", "A"),
        ("* mục 1\n* mục 2", "• mục 1\n• mục 2"),
        ("- mục 3", "• mục 3"),
        ("Xem [EduMap](https://edumap.vn)", "Xem EduMap (https://edumap.vn)"),
        ("`code` và _nghiêng_", "code và nghiêng"),
        ("Giá 5*2 = 10", "Giá 5*2 = 10"),
        ("Đăng ký tại https://a.b/c", "Đăng ký tại https://a.b/c"),
    ],
)
def test_strip_markdown(raw, expected):
    assert _strip_markdown(raw) == expected


def test_strip_markdown_is_idempotent_and_null_safe():
    text = "**Đậm**\n# Mục\n* một"
    once = _strip_markdown(text)
    assert _strip_markdown(once) == once
    assert _strip_markdown(None) == ""
    assert _strip_markdown("") == ""


def test_chat_reply_is_stripped_end_to_end(monkeypatch):
    """`chat_with_rag` must return plain text (no markdown markers)."""
    import asyncio
    from unittest.mock import patch

    svc = _deepseek_only(monkeypatch)
    svc.has_gemini = False
    svc.has_cf = False
    monkeypatch.setattr(
        svc, "_deepseek_generate",
        lambda *a, **k: "**Học bổng** DNTU\n# Điều kiện\n- GPA ≥ 3.0",
    )

    async def _run():
        with patch("services.vector_store.vector_store") as mock_vs, \
             patch.object(llm_module.cache_service, "get", return_value=None), \
             patch.object(llm_module.cache_service, "set"):
            mock_vs.query.return_value = {"documents": [[]], "metadatas": [[]], "ids": [[]]}
            return await svc.chat_with_rag("Học bổng DNTU?")

    reply = asyncio.run(_run())["reply"]
    assert "**" not in reply
    assert "#" not in reply
    assert "Học bổng DNTU" in reply
    assert "GPA ≥ 3.0" in reply
