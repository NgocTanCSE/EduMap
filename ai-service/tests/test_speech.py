"""
Tests for Voice-to-Geo AI (Idea #16).

Covers:
  1. SpeechService.transcribe — always degrades (no server-side STT provider
     configured on HF Spaces free plan); returns degraded=True with empty text.
  2. NLQueryParser.extract_intent — intent classification (geo_recommend /
     report_form / geo_query) reusing the Talk2Map regex baseline.
  3. Intent classification against the 5 voice-sample scenarios from the plan:
     "Tìm thư viện gần đây" → geo_recommend
     "Báo wifi hỏng ở trường X" → report_form
  4. Router smoke (FastAPI TestClient) — always degraded (no provider).

The SpeechService always returns degraded=True because no server-side STT
provider is configured (XKIRO has been removed from the provider chain and
did not support STT anyway). The frontend falls back to the client-side Web
Speech API, which captures audio in-browser (privacy-first).
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
os.environ["STT_TIMEOUT_SECONDS"] = "25"
os.environ.setdefault("DB_SQLITE_PATH", os.path.abspath(
    os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db")
))

import pytest

# Import SpeechService at module level so patch.object can reference it.
from services.speech import SpeechService


# ── 1. SpeechService unit tests ──────────────────────────────────────────

class TestSpeechService:
    """Verify STT transcription always degrades gracefully (no provider)."""

    def setup_method(self):
        self.svc = SpeechService()

    def test_transcribe_always_degraded(self):
        """No server-side STT provider configured → degraded=True, empty text."""
        result = self.svc.transcribe("AAAA", "wav", "vi")
        assert result["degraded"] is True
        assert result["text"] == ""
        assert result["method"] == "fallback"
        assert result["error"] is not None
        assert "Web Speech API" in result["error"] or "client-side" in result["error"].lower()

    def test_transcribe_empty_audio(self):
        """Empty audio_base64 → degraded without any provider call."""
        result = self.svc.transcribe("", "wav", "vi")
        assert result["degraded"] is True
        assert "empty" in (result["error"] or "").lower()

    def test_transcribe_strips_data_uri(self):
        """Frontend may send a data-URI prefixed string → must be stripped
        before the (always-degraded) check."""
        result = self.svc.transcribe("data:audio/wav;base64,AAAA", "wav", "vi")
        assert result["degraded"] is True
        assert result["text"] == ""

    def test_transcribe_preserves_language(self):
        """Language field should be echoed even in degraded mode."""
        result = self.svc.transcribe("AAAA", "wav", "vi")
        assert result["language"] == "vi"

    def test_degraded_response_matches_schema(self):
        """Degraded response should match the SpeechToTextResponse schema."""
        result = self.svc.transcribe("AAAA", "wav", "vi")
        assert isinstance(result, dict)
        for key in ("text", "language", "method", "confidence", "degraded", "error"):
            assert key in result, f"Missing key: {key}"
        assert isinstance(result["text"], str)
        assert isinstance(result["degraded"], bool)
        assert result["confidence"] is None


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
    """Verify POST /api/ai/speech/to-text returns valid schema.

    All paths return degraded=True because no server-side STT provider
    is configured. The frontend falls back to the client-side Web Speech API.
    """

    def _get_client(self):
        from fastapi import FastAPI
        from routers.speech import router as speech_router
        app = FastAPI()
        app.include_router(speech_router)
        from fastapi.testclient import TestClient
        return TestClient(app)

    def test_always_degraded_no_provider(self):
        """Without a STT provider, the endpoint always returns degraded=True."""
        client = self._get_client()
        resp = client.post("/api/ai/speech/to-text", json={
            "audio_base64": "AAAA", "audio_format": "wav", "language": "vi"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["degraded"] is True
        assert data["text"] == ""
        assert data["error"] is not None

    def test_empty_audio_rejected_gracefully(self):
        """Empty audio should not crash the endpoint."""
        client = self._get_client()
        resp = client.post("/api/ai/speech/to-text", json={
            "audio_base64": "", "audio_format": "wav", "language": "vi"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["degraded"] is True
        assert data["text"] == ""

    def test_response_schema_complete(self):
        """All required fields in SpeechToTextResponse should be present."""
        client = self._get_client()
        resp = client.post("/api/ai/speech/to-text", json={
            "audio_base64": "AAAA", "audio_format": "wav", "language": "vi"
        })
        assert resp.status_code == 200
        data = resp.json()
        for key in ("text", "language", "method", "confidence", "degraded", "error"):
            assert key in data, f"Missing key: {key}"
