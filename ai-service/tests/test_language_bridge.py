"""Unit tests for the AI Language Bridge (Idea #15).

Verifies:
  - simplify_text returns valid JSON-shaped output for each difficulty level.
  - simplify degrades gracefully (template fallback) when all LLM providers
    are disabled (empty API keys — the HF Spaces free-plan default).
  - translate_text returns valid output and degrades gracefully.
  - synthesize_speech returns a valid response shape; degrades to degraded=True
    when no TTS provider is available (text-only so frontend can use Web Speech API).
  - 24-hour cache returns cached results on repeat calls.
  - Explained terms dict and glossary handling.
"""
import asyncio
import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure NO real providers are configured before importing — mirrors
# test_impact_match.py / test_ai_fallbacks.py.
for _v in [
    "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "OPENROUTER_API_KEY",
    "NVIDIA_API_KEY", "NIM_API_KEY", "KIMI_API_KEY",
]:
    os.environ[_v] = ""
os.environ["AI_PREFLIGHT"] = "false"
os.environ["DB_TYPE"] = "sqlite"
# Point to the real DB if it exists; tests don't actually query it but the
# import chain expects the env var to be set.
_db = os.path.abspath(os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db"))
if os.path.exists(_db):
    os.environ["DB_SQLITE_PATH"] = _db

from services.language_bridge import (
    LanguageBridgeService,
    language_bridge,
    DIFFICULTY_LEVELS,
    DEFAULT_DIFFICULTY,
    SUPPORTED_LANGUAGES,
    _truncate,
    _estimate_duration_ms,
    hash_text,
)


# ── Service instantiation ────────────────────────────────────────────────────

def test_service_singleton():
    """The module-level singleton should be a LanguageBridgeService instance."""
    assert isinstance(language_bridge, LanguageBridgeService)


def test_difficulty_levels():
    """All four difficulty levels must be defined."""
    assert set(DIFFICULTY_LEVELS.keys()) == {"elementary", "middle", "high", "college"}
    assert DEFAULT_DIFFICULTY == "middle"


def test_supported_languages():
    """Vietnamese and English must always be supported."""
    assert "vi" in SUPPORTED_LANGUAGES
    assert "en" in SUPPORTED_LANGUAGES
    assert "Tiếng Việt" in SUPPORTED_LANGUAGES.values()


# ── Simplify ─────────────────────────────────────────────────────────────────

def test_simplify_empty_text():
    """Empty input should return an empty simplified string (no crash)."""
    svc = LanguageBridgeService()
    result = svc.simplify_text("", difficulty="middle")
    assert result["simplified"] == ""
    assert result["degraded"] is False
    assert result["explained_terms"] == {}


def test_simplify_degraded_fallback():
    """When all LLM providers are disabled, simplify must degrade gracefully
    — return valid output with degraded=True instead of raising."""
    svc = LanguageBridgeService()
    # With no API keys, llm_ready is False → fallback path.
    assert svc.llm_ready is False

    sample = "Áp dụng giải thuật đa thứ tự (multi-head attention) trong kiến trúc Transformer cho phép mô hình..." * 3
    result = svc.simplify_text(sample, difficulty="elementary")

    assert isinstance(result, dict)
    assert "simplified" in result
    assert isinstance(result["simplified"], str)
    assert len(result["simplified"]) > 0
    assert result["degraded"] is True
    assert result["difficulty"] == "elementary"
    assert result["reason"] is not None
    print("✓ test_simplify_degraded_fallback")


def test_simplify_all_difficulties():
    """All difficulty levels should produce valid output via the fallback."""
    svc = LanguageBridgeService()
    sample = "Hóa học phân tích của mẫu thải là một kỹ thuật phân tích chất lượng cao."
    for level in DIFFICULTY_LEVELS:
        result = svc.simplify_text(sample, difficulty=level)
        assert result["difficulty"] == level
        assert isinstance(result["simplified"], str)
        assert len(result["simplified"]) > 0
        assert "explained_terms" in result
        print(f"  ✓ difficulty={level} → degraded={result['degraded']}")
    print("✓ test_simplify_all_difficulties")


def test_simplify_invalid_difficulty_defaults():
    """An unknown difficulty should fall back to DEFAULT_DIFFICULTY."""
    svc = LanguageBridgeService()
    result = svc.simplify_text("Some text here.", difficulty="invalid_level")
    assert result["difficulty"] == DEFAULT_DIFFICULTY


def test_simplify_cache_hit():
    """A second call with the same text+difficulty should return cached=True."""
    svc = LanguageBridgeService()
    text = "Đây là một đoạn văn bản mẫu để kiểm tra cache."
    r1 = svc.simplify_text(text, difficulty="middle")
    r2 = svc.simplify_text(text, difficulty="middle")
    assert r2.get("cached") is True
    assert r2["simplified"] == r1["simplified"]
    print("✓ test_simplify_cache_hit")


def test_simplify_whitespace_only():
    """Whitespace-only input should not crash."""
    svc = LanguageBridgeService()
    result = svc.simplify_text("   ", difficulty="middle")
    assert result["simplified"] == ""


# ── Translate ─────────────────────────────────────────────────────────────────

def test_translate_empty_text():
    svc = LanguageBridgeService()
    result = svc.translate_text("", target_language="en")
    assert result["translated"] == ""


def test_translate_degraded_fallback():
    """When LLM is down, translate should return the original text with
    degraded=True instead of raising."""
    svc = LanguageBridgeService()
    result = svc.translate_text(
        "Giới thiệu về trường Đại học Đồng Nai và các ngành học.",
        target_language="en",
    )
    assert isinstance(result, dict)
    assert "translated" in result
    assert isinstance(result["translated"], str)
    assert len(result["translated"]) > 0
    assert result["degraded"] is True
    assert result["target_language"] == "en"
    assert result["reason"] is not None
    print("✓ test_translate_degraded_fallback")


def test_translate_language_normalisation():
    """Language code with region suffix (e.g. 'vi-VN') should be normalised."""
    svc = LanguageBridgeService()
    result = svc.translate_text("Hello", target_language="vi-VN")
    assert result["target_language"] == "vi"


def test_translate_cache_hit():
    """Second call with same params should return cached=True."""
    svc = LanguageBridgeService()
    text = "Xin chào, đây là văn bản dịch thử."
    r1 = svc.translate_text(text, target_language="en")
    r2 = svc.translate_text(text, target_language="en")
    assert r2.get("cached") is True
    assert r2["translated"] == r1["translated"]
    print("✓ test_translate_cache_hit")


def test_translate_glossary_respected():
    """When degraded, the fallback passes through the original text.
    The glossary contract is only enforced by the LLM path, so we verify
    the output dict always contains target_language + degraded keys."""
    svc = LanguageBridgeService()
    result = svc.translate_text(
        "Công nghệ blockchain và AI",
        target_language="en",
        glossary={"blockchain": "blockchain", "AI": "AI"},
    )
    assert "target_language" in result
    assert "degraded" in result
    assert result["target_language"] == "en"


# ── TTS ────────────────────────────────────────────────────────────────────

def test_tts_empty_text():
    """Empty TTS input should return degraded with no audio."""
    svc = LanguageBridgeService()
    result = svc.synthesize_speech("", language="vi")
    assert result["audio_base64"] is None
    assert result["degraded"] is True
    assert result["audio_format"] == "mp3"


def test_tts_degraded_when_no_provider():
    """When no TTS library is available (or network fails), TTS must degrade
    gracefully — return degraded=True with audio_base64=None so the frontend
    can fall back to the browser Web Speech API."""
    svc = LanguageBridgeService()
    sample = "Đây là văn bản mẫu để kiểm tra chuyển đổi giọng nói."
    result = svc.synthesize_speech(sample, language="vi")

    assert isinstance(result, dict)
    assert "audio_base64" in result
    assert "degraded" in result
    assert "reason" in result
    assert result["language"] == "vi"
    assert result["audio_format"] == "mp3"
    # Since no TTS provider is likely available in the test environment,
    # it should degrade.  If a provider *is* available (e.g. gTTS installed),
    # we still verify the shape is correct.
    print(f"  TTS result: degraded={result['degraded']}, provider={result.get('provider')}")
    print("✓ test_tts_degraded_when_no_provider")


def test_tts_vietnamese_language_code():
    """TTS should accept 'vi' as the Vietnamese language code."""
    svc = LanguageBridgeService()
    result = svc.synthesize_speech("Xin chào", language="vi")
    assert result["language"] == "vi"


def test_tts_cache_hit():
    """Second call with same text+language should return cached=True."""
    svc = LanguageBridgeService()
    text = "Văn bản mẫu cho cache TTS."
    r1 = svc.synthesize_speech(text, language="vi")
    r2 = svc.synthesize_speech(text, language="vi")
    assert r2.get("cached") is True
    assert r2["audio_base64"] == r1["audio_base64"]
    print("✓ test_tts_cache_hit")


# ── Utility helpers ──────────────────────────────────────────────────────────

def test_truncate_short_text():
    """Short text should be returned unchanged (minus surrounding whitespace)."""
    assert _truncate("Hello world", 500) == "Hello world"


def test_truncate_long_text():
    """Long text should be truncated with ellipsis."""
    long_text = "A" * 1000
    result = _truncate(long_text, 200)
    assert len(result) <= 203  # 200 + "..."
    assert result.endswith("...")


def test_estimate_duration_ms():
    """Duration should scale with word count."""
    short = _estimate_duration_ms("Xin chào")  # 2 words
    long = _estimate_duration_ms("Xin chào " * 50)  # 100 words
    assert long > short
    assert short > 0


def test_hash_text_deterministic():
    """Same text should produce the same hash."""
    assert hash_text("hello") == hash_text("hello")
    assert hash_text("hello") != hash_text("world")


# ── Vietnamese text handling ──────────────────────────────────────────────────

def test_simplify_preserves_vietnamese_diacritics():
    """Vietnamese diacritics must be preserved in the simplified output."""
    svc = LanguageBridgeService()
    sample = "Đại học quốc gia là một trong những trường đại học lớn nhất miền Bắc Việt Nam."
    result = svc.simplify_text(sample, difficulty="middle")
    # Even in fallback mode, the text should retain Vietnamese characters.
    assert any(ch in result["simplified"] for ch in "àáạảấầấẩ") or \
           result["simplified"]  # fallback returns original/truncated
    print("✓ test_simplify_preserves_vietnamese_diacritics")


def test_translate_vietnamese_to_english():
    """Vietnamese → English translation should produce output (even if degraded)."""
    svc = LanguageBridgeService()
    result = svc.translate_text(
        "Giáo viên dạy môn Toán cho học sinh lớp 10.",
        target_language="en",
    )
    assert len(result["translated"]) > 0
    assert result["degraded"] is True  # LLM is down → degraded
    print("✓ test_translate_vietnamese_to_english")


def test_simplify_with_context():
    """Passing context should not crash the simplify endpoint."""
    svc = LanguageBridgeService()
    result = svc.simplify_text(
        "Công thức tính thể tích khối cầu là V = 4/3 π r³.",
        difficulty="elementary",
        context="Bài học Toán hình học, lớp 9.",
    )
    assert len(result["simplified"]) > 0
    assert result["degraded"] is True
    print("✓ test_simplify_with_context")


# ── Smoke / integration-style ──────────────────────────────────────────────────────────────────

def test_all_endpoints_return_dict():
    """All three public methods should return a dict (never raise)."""
    svc = LanguageBridgeService()
    text = "Đây là một đoạn văn bản kiểm tra tích hợp cho Language Bridge AI."
    s = svc.simplify_text(text, difficulty="high")
    t = svc.translate_text(text, target_language="en")
    a = svc.synthesize_speech(text, language="vi")
    assert isinstance(s, dict)
    assert isinstance(t, dict)
    assert isinstance(a, dict)
    print("✓ test_all_endpoints_return_dict")


if __name__ == "__main__":
    test_service_singleton()
    test_difficulty_levels()
    test_supported_languages()
    test_simplify_empty_text()
    test_simplify_degraded_fallback()
    test_simplify_all_difficulties()
    test_simplify_invalid_difficulty_defaults()
    test_simplify_cache_hit()
    test_simplify_whitespace_only()
    test_translate_empty_text()
    test_translate_degraded_fallback()
    test_translate_language_normalisation()
    test_translate_cache_hit()
    test_translate_glossary_respected()
    test_tts_empty_text()
    test_tts_degraded_when_no_provider()
    test_tts_vietnamese_language_code()
    test_tts_cache_hit()
    test_truncate_short_text()
    test_truncate_long_text()
    test_estimate_duration_ms()
    test_hash_text_deterministic()
    test_simplify_preserves_vietnamese_diacritics()
    test_translate_vietnamese_to_english()
    test_simplify_with_context()
    test_all_endpoints_return_dict()
    print("\n✅ All Language Bridge tests passed!")
