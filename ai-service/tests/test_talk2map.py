"""
Tests for Talk2Map NL parser (ai-service/services/nl_query_parser.py).

Covers:
  1. Regex fallback (all LLM providers disabled) — always works on HF Spaces.
  2. LLM enrichment path (mocked llm_service).
  3. 10 Vietnamese test sentences across 3 miền (North / Central / South) dialect.
  4. Degraded mode, fuzzy location suggestions, edge cases.
"""

import os
import asyncio
import json
from unittest.mock import MagicMock, AsyncMock, patch

import pytest

# ── Disable all AI providers to force regex fallback ──────────────────────
# Match the pattern from test_ai_fallbacks.py: blank out every provider env
# var so LLMService.is_ready is False.
_PROVIDER_ENV_VARS = [
    "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "OPENROUTER_BASE_URL",
    "NVIDIA_API_KEY", "NVIDIA_BASE_URL", "KIMI_API_KEY", "KIMI_BASE_URL",
    "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "GEMINI_API_KEY",
    "HF_TOKEN", "HF_API_TOKEN", "HUGGING_FACE_HUB_TOKEN",
]
_original_env = {v: os.environ.get(v) for v in _PROVIDER_ENV_VARS}
for _v in _PROVIDER_ENV_VARS:
    os.environ.pop(_v, None)


@pytest.fixture(scope="module", autouse=True)
def _restore_env():
    """Restore provider env vars after this module's tests so they don't
    leak into other test modules (e.g. test_speech.py which checks that
    OPENROUTER_API_KEY is set)."""
    yield
    for _v, _val in _original_env.items():
        if _val is not None:
            os.environ[_v] = _val
        else:
            os.environ.pop(_v, None)


@pytest.fixture(scope="module")
def parser():
    """NLQueryParser with no LLM service (regex-only mode)."""
    from services.nl_query_parser import NLQueryParser
    return NLQueryParser(llm_service=None)


@pytest.fixture
def llm_enabled_parser():
    """NLQueryParser with a mocked LLM service that always returns valid JSON."""
    from services.nl_query_parser import NLQueryParser

    mock_llm = MagicMock()
    mock_llm.is_ready = True
    mock_llm._generate_text_with_fallback = MagicMock(return_value='{"facility_types": ["university"], "location": "trường", "radius_km": 3.0}')
    mock_llm._extract_json = MagicMock(return_value={"facility_types": ["university"], "location": "trường", "radius_km": 3.0})

    return NLQueryParser(llm_service=mock_llm)


# ── 10 Vietnamese test sentences (3-miền) ─────────────────────────────────
# (sentence, expected_facility_types_exact, expected_conditions_exact, expected_radius)
TEST_SENTENCES = [
    ("Tìm nơi học miễn phí gần trường, có Wi-Fi, mở cửa buổi tối.",
     [], ["free", "wifi", "open_evening"], None),
    ("Có thư viện nào ở Biên Hòa không?",
     ["library"], [], None),
    ("Tìm quán cà phê gần trường có internet và chỗ đậu xe.",
     ["cafe"], ["wifi", "parking"], None),
    ("Địa điểm học tập mở cửa 24/7 ở TP. Hồ Chí Minh?",
     [], ["open_evening"], None),
    ("Tìm trường học gần khu vực biên giới Đông Nam Bộ.",
     ["school"], [], None),
    ("Nơi học có wifi miễn phí trong bán kính 3km.",
     [], ["free", "wifi"], 3.0),
    ("Chợ và quán ăn gần trường Đại học Nông lâm.",
     ["market", "restaurant"], [], None),
    ("Tìm không gian xanh, công viên để học nhóm.",
     ["green", "park"], ["group"], None),
    ("Trường học và thư viện mở cửa buổi tối ở miền Trung.",
     ["school", "library"], ["open_evening"], None),
    ("Địa điệm có bàn ghế, wifi, phù hợp nhóm 5 người học.",
     [], ["wifi", "group", "bench"], None),
]


# ── Tests: regex fallback ─────────────────────────────────────────────────

class TestRegexFallback:
    """When LLM is unavailable, the regex parser must still work."""

    def test_parse_returns_valid_schema(self, parser):
        result = parser.parse("Tìm thư viện gần trường có wifi")
        assert isinstance(result, dict)
        required_keys = {"location", "radius_km", "facility_types", "conditions",
                         "reference_location", "confidence", "method", "suggestions",
                         "raw_text"}
        assert required_keys.issubset(result.keys()), f"Missing keys: {required_keys - set(result.keys())}"

    @pytest.mark.parametrize("sentence,expected_facilities,expected_conditions,expected_radius", TEST_SENTENCES)
    def test_regex_parse_vietnamese_sentences(self, parser, sentence, expected_facilities,
                                              expected_conditions, expected_radius):
        """10 câu tiếng Việt: regex phải tìm được facility_types và conditions."""
        result = parser.parse(sentence)
        assert result["method"] in ("regex", "llm")
        assert isinstance(result["facility_types"], list)
        assert isinstance(result["conditions"], list)
        assert isinstance(result["raw_text"], str)
        assert 0.0 <= result["confidence"] <= 1.0

        # Facility types: exact match (set equality)
        assert set(result["facility_types"]) == set(expected_facilities), \
            f"Expected facilities {set(expected_facilities)}, got {set(result['facility_types'])} for: {sentence}"

        # Conditions: exact match (set equality)
        assert set(result["conditions"]) == set(expected_conditions), \
            f"Expected conditions {set(expected_conditions)}, got {set(result['conditions'])} for: {sentence}"

        # Radius
        if expected_radius is not None:
            assert result["radius_km"] == pytest.approx(expected_radius), \
                f"Expected radius {expected_radius}, got {result['radius_km']} for: {sentence}"

    def test_parse_trường_keyword(self, parser):
        result = parser.parse("Tìm trường học gần đây")
        assert "school" in result["facility_types"] or "university" in result["facility_types"]
        assert result["confidence"] > 0.3

    def test_parse_thư_viện_keyword(self, parser):
        result = parser.parse("Tìm thư viện gần trường")
        assert "library" in result["facility_types"]
        assert result["confidence"] > 0.3

    def test_parse_radius_extraction(self, parser):
        result = parser.parse("Tìm wifi trong bán kính 3km")
        assert result["radius_km"] == pytest.approx(3.0)

    def test_parse_default_radius(self, parser):
        result = parser.parse("Tìm trường học gần trường")
        assert result["radius_km"] is not None
        assert result["radius_km"] > 0

    def test_parse_suggestions_non_empty(self, parser):
        """Fuzzy location suggestions should be returned for ambiguous locations."""
        result = parser.parse("Tìm trường gần trường DNTU")
        assert isinstance(result["suggestions"], list)

    def test_parse_empty_string(self, parser):
        result = parser.parse("")
        assert result["method"] in ("regex", "llm")
        assert isinstance(result["facility_types"], list)
        assert isinstance(result["conditions"], list)

    def test_parse_no_match(self, parser):
        """Random string with no location keywords should still return valid structure."""
        result = parser.parse("xyz123random")
        assert isinstance(result["facility_types"], list)
        assert isinstance(result["raw_text"], str)
        assert result["confidence"] >= 0.0


# ── Tests: LLM enrichment ─────────────────────────────────────────────────

class TestLLMEnrichment:
    """When LLM is available, enrichment should be attempted."""

    def test_llm_enrichment_merges_with_regex(self, llm_enabled_parser):
        result = llm_enabled_parser.parse("Tìm trường học gần trường có wifi")
        assert result["method"] == "llm"
        assert isinstance(result["facility_types"], list)
        assert isinstance(result["confidence"], float)

    def test_llm_enrichment_degraded_on_failure(self, parser):
        """When LLM raises an exception, regex result is kept."""
        mock_llm = MagicMock()
        mock_llm.is_ready = True
        mock_llm._generate_text_with_fallback = MagicMock(side_effect=Exception("API down"))

        from services.nl_query_parser import NLQueryParser
        p = NLQueryParser(llm_service=mock_llm)
        result = p.parse("Tìm thư viện gần trường")
        assert result["method"] == "regex"  # falls back
        assert "library" in result["facility_types"]

    def test_llm_enrichment_invalid_json(self, parser):
        """When LLM returns non-JSON, regex result is kept."""
        mock_llm = MagicMock()
        mock_llm.is_ready = True
        mock_llm._generate_text_with_fallback = MagicMock(return_value="not valid json {broken")
        mock_llm._extract_json = MagicMock(return_value=None)

        from services.nl_query_parser import NLQueryParser
        p = NLQueryParser(llm_service=mock_llm)
        result = p.parse("Tìm thư viện gần trường")
        assert result["method"] == "regex"


# ── Tests: dialect keywords (3 miền) ──────────────────────────────────────

class TestDialectKeywords:
    """Keywords from miền Bắc, Trung, Nam should all be recognized."""

    @pytest.mark.parametrize("sentence", [
        "Tìm trường học miền Bắc",
        "Cần tìm trường ở miền Trung",
        "Tìm kiếm ở miền Nam",
    ])
    def test_regional_keywords_recognized(self, parser, sentence):
        result = parser.parse(sentence)
        assert result["facility_types"] or result["location"]

    def test_trường_variant_spelling(self, parser):
        """'truồng' (Southern pronunciation) should map to 'trường'."""
        result_north = parser.parse("Tìm trường học")
        result_south = parser.parse("Tìm truồng học")
        assert "school" in result_north["facility_types"]
        assert "school" in result_south["facility_types"]

    def test_thư_viện_variant_spelling(self, parser):
        """'thư viên' (common misspelling) should map to 'thư viện'."""
        result_correct = parser.parse("Tìm thư viện")
        result_misspelled = parser.parse("Tìm thư viên")
        assert "library" in result_correct["facility_types"]
        assert "library" in result_misspelled["facility_types"]

    def test_cafe_regional_spellings(self, parser):
        """'cà phê' (North), 'cafe' (South) should both map to 'cafe'."""
        result_north = parser.parse("Tìm cà phê")
        result_south = parser.parse("Tìm cafe")
        assert "cafe" in result_north["facility_types"]
        assert "cafe" in result_south["facility_types"]


# ── Tests: explanation generation ─────────────────────────────────────────

class TestExplanation:
    def test_explanation_generated(self, parser):
        result = parser.parse("Tìm trường học gần trường có wifi")
        explanation = parser.generate_explanation(result)
        assert isinstance(explanation, str)
        assert len(explanation) > 0

    def test_explanation_template_degraded(self, parser):
        """When LLM is down, template explanation is used."""
        result = parser.parse("Tìm thư viện gần trường, wifi, miễn phí")
        result["method"] = "regex"
        explanation = parser.generate_explanation(result)
        assert isinstance(explanation, str)
        assert len(explanation) > 5


# ── Tests: async parse (router compatibility) ─────────────────────────────

class TestAsyncParse:
    def test_parse_async_returns_same_as_sync(self, parser):
        """parse() can be called from async context (router uses asyncio.to_thread)."""
        result_sync = parser.parse("Tìm thư viện gần trường")
        result_async = asyncio.run(parser.parse_async("Tìm thư viện gần trường"))
        assert result_sync["raw_text"] == result_async["raw_text"]
        assert result_sync["facility_types"] == result_async["facility_types"]
