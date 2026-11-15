"""Provider-level unit tests: Groq chat + Jina embeddings.

No network access: ``subprocess.run`` / ``subprocess.Popen`` are stubbed, so the
tests assert the request shape (curl flags, headers, payload) and the response
parsing (OpenAI-compatible JSON / SSE, error handling, circuit breaker).
"""

import json
import os
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.llm_service import LLMService


class FakeProc:
    def __init__(self, stdout="", stderr="", returncode=0):
        self.stdout = stdout
        self.stderr = stderr
        self.returncode = returncode


def _chat_json(text="xin chào", model="openai/gpt-oss-120b"):
    return json.dumps({"choices": [{"message": {"content": text}}], "model": model})


@pytest.fixture
def groq(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-120b")
    monkeypatch.delenv("GROQ_BASE_URL", raising=False)
    return LLMService()


def test_init_reads_groq_env(groq):
    assert groq.has_chat is True
    assert groq.is_ready is True
    assert groq.chat_model_name == "openai/gpt-oss-120b"
    assert groq.chat_base_url == "https://api.groq.com/openai"


def test_init_without_key_is_not_ready(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    svc = LLMService()
    assert svc.has_chat is False
    assert svc.is_ready is False


def test_generate_posts_to_groq_with_curl_ipv4(groq, monkeypatch):
    captured = {}

    def fake_run(cmd, **kwargs):
        captured["cmd"] = cmd
        captured["kwargs"] = kwargs
        return FakeProc(stdout=_chat_json("Chào bạn"))

    monkeypatch.setattr(subprocess, "run", fake_run)

    assert groq._chat_generate("cho tôi một mẹo học") == "Chào bạn"

    cmd = captured["cmd"]
    assert cmd[:3] == ["curl", "--ipv4", "--insecure"]
    assert "https://api.groq.com/openai/chat/completions" in cmd
    assert "Authorization: Bearer gsk_test" in cmd
    body = json.loads(cmd[cmd.index("-d") + 1])
    assert body["model"] == "openai/gpt-oss-120b"
    assert body["stream"] is False
    assert body["messages"][1]["content"] == "cho tôi một mẹo học"


def test_generate_auth_error_opens_circuit_breaker(groq, monkeypatch):
    err = json.dumps({"error": {"code": 401, "message": "invalid api key"}})
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: FakeProc(stdout=err))

    with pytest.raises(RuntimeError, match="Groq auth error"):
        groq._chat_generate("test")
    assert groq._chat_down_until > 0


def test_generate_rate_limit_falls_through_to_next_model(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("GROQ_MODEL", "model-a,model-b")
    svc = LLMService()
    calls = []

    def fake_run(cmd, **kwargs):
        body = json.loads(cmd[cmd.index("-d") + 1])
        calls.append(body["model"])
        if body["model"] == "model-a":
            return FakeProc(stdout=json.dumps(
                {"error": {"code": 429, "message": "rate limit reached"}}
            ))
        return FakeProc(stdout=_chat_json("từ model-b", model="model-b"))

    monkeypatch.setattr(subprocess, "run", fake_run)

    assert svc._chat_generate("test") == "từ model-b"
    assert calls == ["model-a", "model-b"]


def test_generate_curl_failure_opens_circuit_breaker(groq, monkeypatch):
    monkeypatch.setattr(
        subprocess, "run",
        lambda *a, **k: FakeProc(stdout="", stderr="could not resolve host", returncode=6),
    )
    with pytest.raises(RuntimeError, match="Groq connection failed"):
        groq._chat_generate("test")
    assert groq._chat_down_until > 0


def test_generate_without_key_raises(groq, monkeypatch):
    groq.has_chat = False
    with pytest.raises(RuntimeError, match="GROQ_API_KEY"):
        groq._chat_generate("test")


class FakeStreamProc:
    def __init__(self, lines):
        self.stdout = iter(lines)
        self.stderr = iter([])
        self.killed = False

    def kill(self):
        self.killed = True


def test_stream_yields_tokens_from_sse(groq, monkeypatch):
    lines = [
        'data: {"choices":[{"delta":{"content":"Xin "}}]}',
        "",
        'data: {"choices":[{"delta":{"content":"chào"}}]}',
        "data: [DONE]",
    ]
    monkeypatch.setattr(subprocess, "Popen", lambda *a, **k: FakeStreamProc(lines))

    tokens = list(groq._chat_generate_stream("test"))
    assert tokens == ["Xin ", "chào"]


def test_fallback_chain_raises_without_provider(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    svc = LLMService()
    with pytest.raises(RuntimeError, match="Không thể sinh nội dung"):
        svc._generate_text_with_fallback("test")