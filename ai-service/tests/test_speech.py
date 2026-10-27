"""
Tests for Voice-to-Geo AI (Idea #16).

Covers:
  1. SpeechService.transcribe — OpenRouter Whisper STT via curl, with
     graceful-degradation (no key, circuit breaker, auth error, success).
  2. NLQueryParser.extract_intent — intent classification (geo_recommend /
     report_form / geo_query) reusing the Talk2Map regex baseline.
  3. Intent classification against the 5 voice-sample scenarios from the plan:
     "Tìm thư viện gần đây" → geo_recommend
     "Báo wifi hỏng ở trường X" → report_form
  4. Router smoke (FastAPI TestClient) — degraded + success paths.

OpenRouter STT API reference (source-verified):
https://openrouter.ai/docs/api/api-reference/stt/create-transcription.md
"""

import os
import sys
import json
from unittest.mock import patch, MagicMock

# Make ai-service importable.
_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure SQLite mode + no real HTTP calls during tests.
os.environ["DB_TYPE"] = "sqlite"
os.environ["AI_PREFLIGHT"] = "false"
# OPENROUTER_API_KEY is set in setup_module() (below) so that it is
# established AFTER all test modules are collected — test_talk2map.py
# strips provider env vars at import time, which would clobber a
# module-level set here.
os.environ.setdefault("DB_SQLITE_PATH", os.path.abspath(
    os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db")
))


def setup_module(module):
    """Set the test STT key after collection so it survives talk2map's
    env stripping (which runs at import / collection time)."""
    os.environ["OPENROUTER_API_KEY"] = "test-key-not-real"


import pytest
from unittest.mock import patch

# Import SpeechService at module level so patch.object can reference it.
from services.speech import SpeechService


# ── 1. SpeechService unit tests ──────────────────────────────────────────

class TestSpeechService:
    """Verify STT transcription with mocked subprocess (no real HTTP)."""

    def setup_method(self):
        from services.speech import SpeechService
        self.svc = SpeechService()

    def _mock_proc(self, stdout_text, returncode=0, stderr=""):
        """Build a fake subprocess.CompletedProcess."""
        proc = MagicMock()
        proc.stdout = stdout_text
        proc.stderr = stderr
        proc.returncode = returncode
        return proc

    def test_transcribe_success(self):
        """Whisper returns clean text → method='whisper', degraded=False."""
        fake_response = {"text": "Tìm thư viện gần trường có wifi", "usage": {"seconds": 9.2}}
        with patch("services.speech.subprocess.run",
                   return_value=self._mock_proc(json.dumps(fake_response))):
            result = self.svc.transcribe("AAAA", "wav", "vi")
        assert result["text"] == "Tìm thư viện gần trường có wifi"
        assert result["method"] == "whisper"
        assert result["degraded"] is False
        assert result["language"] == "vi"

    def test_transcribe_no_api_key(self):
        """When OPENROUTER_API_KEY is absent → degraded, client-side fallback."""
        with patch.object(SpeechService, "_get_openrouter_key", return_value=""):
            result = self.svc.transcribe("AAAA", "wav", "vi")
        assert result["degraded"] is True
        assert result["text"] == ""
        assert "OPENROUTER_API_KEY" in (result["error"] or "")
        assert result["method"] == "fallback"

    def test_transcribe_circuit_breaker(self):
        """When circuit breaker is active → degraded immediately, no curl call."""
        self.svc._down_until = 9999999999.0  # far future
        try:
            with patch("services.speech.subprocess.run") as mock_run:
                result = self.svc.transcribe("AAAA", "wav", "vi")
            assert result["degraded"] is True
            assert "circuit breaker" in (result["error"] or "").lower()
            mock_run.assert_not_called()  # curl must NOT be invoked
        finally:
            self.svc._down_until = 0.0  # reset

    def test_transcribe_auth_error_sets_circuit_breaker(self):
        """401/auth error → circuit breaker engaged for 5 min."""
        old_cb = self.svc._down_until
        err_response = {"error": {"code": 401, "message": "Invalid API key"}}
        with patch("services.speech.subprocess.run",
                   return_value=self._mock_proc(json.dumps(err_response), returncode=0)):
            result = self.svc.transcribe("AAAA", "wav", "vi")
        assert result["degraded"] is True
        assert self.svc._down_until > old_cb  # circuit breaker was set

    def test_transcribe_strips_data_uri(self):
        """Frontend may send a data-URI prefixed string → must be stripped."""
        fake_response = {"text": "Xin chào"}
        with patch("services.speech.subprocess.run",
                   return_value=self._mock_proc(json.dumps(fake_response))) as mock_run:
            self.svc.transcribe("data:audio/wav;base64,AAAA", "wav", "vi")
        # The curl payload should NOT contain "data:"
        call_args = mock_run.call_args[0][0]
        assert "data:audio/wav;base64" not in call_args

    def test_transcribe_empty_audio(self):
        """Empty audio_base64 → degraded without calling curl."""
        with patch("services.speech.subprocess.run") as mock_run:
            result = self.svc.transcribe("", "wav", "vi")
        assert result["degraded"] is True
        assert "empty" in (result["error"] or "").lower()
        mock_run.assert_not_called()


# ── 2. Intent extraction (T3) ────────────────────────────────────────────

class TestIntentExtraction:
    """NLQueryParser.extract_intent — reuses Talk2Map regex baseline."""

    @pytest.fixture
    def parser(self):
        from services.nl_query_parser import NLQueryParser
        return NLQueryParser(llm_service=None)

    def _parse_and_intent(self, parser, text):
        parsed = parser.parse(text)
        intent = parser.extract_intent(parsed)
        return parsed, intent

    @pytest.mark.parametrize("sentence", [
        "Tìm thư viện gần trường có wifi",
        "Tìm nơi học miễn phí gần trường, mở cửa buổi tối",
        "Có quán cà phê nào gần đây không?",
        "Tìm trường học ở Biên Hòa",
        "Địa điểm có bàn ghế, wifi, phù hợp nhóm 5 người học",
    ])
    def test_find_intent_is_geo_recommend(self, parser, sentence):
        """5 voice samples for 'find' → geo_recommend intent."""
        _, intent = self._parse_and_intent(parser, sentence)
        assert intent["intent"] == "geo_recommend"
        assert 0.0 < intent["confidence"] <= 1.0

    @pytest.mark.parametrize("sentence", [
        "Báo wifi hỏng ở trường DNTU",
        "Mạng internet tại thư viện bị lỗi, không kết nối được",
        "Báo cáo ngập nước ở khu vực trường",
        "Wifi ở cà phê gần đây bị đứt, gửi báo cáo",
        "Đóng góp báo cáo điểm dữ liệu thiếu ở khu vực này",
    ])
    def test_report_intent_is_report_form(self, parser, sentence):
        """5 voice samples for 'report' → report_form intent."""
        _, intent = self._parse_and_intent(parser, sentence)
        assert intent["intent"] == "report_form"
        assert intent["confidence"] > 0.0

    @pytest.mark.parametrize("sentence", [
        "Trường DNTU ở đâu?",
        "Địa chỉ thư viện quốc gia là gì?",
        "Giờ mở cửa của cà phê này là bao nhiêu?",
        "TP. Hồ Chí Minh có bao nhiêu trường đại học không?",
    ])
    def test_info_query_is_geo_query(self, parser, sentence):
        """Pure information questions → geo_query intent."""
        _, intent = self._parse_and_intent(parser, sentence)
        assert intent["intent"] == "geo_query"
        assert intent["confidence"] > 0.0

    def test_default_intent_is_geo_recommend(self, parser):
        """Unparseable gibberish → safe default geo_recommend."""
        parsed = parser.parse("xyz123random")
        intent = parser.extract_intent(parsed)
        assert intent["intent"] == "geo_recommend"

    def test_report_keyword_beats_find(self, parser):
        """A report keyword should win even if 'tìm' also appears."""
        _, intent = self._parse_and_intent(parser, "Tìm wifi để biết trường có hỏng không")
        # 'hỏng' present → report_form (report takes priority)
        assert intent["intent"] == "report_form"

    def test_intent_detail_is_vietnamese(self, parser):
        """The detail string should be human-readable Vietnamese."""
        _, intent = self._parse_and_intent(parser, "Tìm thư viện gần trường có wifi")
        assert isinstance(intent["detail"], str)
        assert len(intent["detail"]) > 0


# ── 3. Router smoke test (FastAPI TestClient) ────────────────────────────

class TestSpeechRouter:
    """Verify POST /api/ai/speech/to-text returns valid schema in both
    degraded and success paths (no real HTTP)."""

    def _get_client(self):
        from fastapi import FastAPI
        from routers.speech import router as speech_router
        app = FastAPI()
        # The router has its own prefix (/api/ai/speech), so include WITHOUT
        # an additional prefix — matches how main.py registers it.
        app.include_router(speech_router)
        from fastapi.testclient import TestClient
        return TestClient(app)

    def test_degraded_when_no_key(self):
        client = self._get_client()
        with patch.object(SpeechService, "_get_openrouter_key", return_value=""):
            resp = client.post("/api/ai/speech/to-text", json={
                "audio_base64": "AAAA", "audio_format": "wav", "language": "vi"
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["degraded"] is True
        assert data["text"] == ""
        assert data["error"] is not None

    def test_success_with_mocked_whisper(self):
        client = self._get_client()
        fake_response = {"text": "Tìm trường học gần đây", "usage": {}}
        proc = MagicMock()
        proc.stdout = json.dumps(fake_response)
        proc.stderr = ""
        proc.returncode = 0
        with patch("services.speech.subprocess.run", return_value=proc):
            resp = client.post("/api/ai/speech/to-text", json={
                "audio_base64": "AAAA", "audio_format": "wav", "language": "vi"
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["degraded"] is False
        assert data["text"] == "Tìm trường học gần đây"
        assert data["method"] == "whisper"

    def test_empty_audio_rejected_gracefully(self):
        client = self._get_client()
        resp = client.post("/api/ai/speech/to-text", json={
            "audio_base64": "", "audio_format": "wav", "language": "vi"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["degraded"] is True
