"""Unit tests for the Opportunity Radar (F-16b) AI matching path.

Mirrors the preamble in ``test_ai_fallbacks.py``: every provider env var is
blanked and ``AI_PREFLIGHT=false`` so the LLMService starts with no
providers configured. This exercises the keyword-based degradation fallback
(``_opportunity_match_fallback``) which is the *real* path on HF Spaces.
"""

import asyncio
import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure NO real providers are configured before importing
for _v in [
    "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "XKIRO_API_KEY",
    "NVIDIA_API_KEY", "NIM_API_KEY",
]:
    os.environ[_v] = ""
os.environ["AI_PREFLIGHT"] = "false"

from services.llm_service import LLMService
from models.opportunity_models import (
    OpportunityMatchRequest, UserProfile, OpportunityCandidate,
)


def _fresh_service():
    """Return a brand-new LLMService with all providers disabled."""
    return LLMService()


def _sample_request():
    profile = UserProfile(
        id="test-student", major="Công nghệ thông tin",
        skills=["Python", "React"], interests=["AI"],
        location="Hồ Chí Minh", role="student", gpa=3.5,
    )
    candidates = [
        OpportunityCandidate(
            id="sch-1", title="Học bổng Australia Awards",
            description="Học bổng toàn phần cho ngành CNTT",
            type="scholarship", organization="AUSTRADE",
            requirements="GPA >= 3.0, tiếng Anh IELTS 6.5",
            url="https://australiaawards.gov.vn",
            field_tags=["CNTT", "AI"], region="Hồ Chí Minh",
            deadline="2099-12-31", status="active",
        ),
        OpportunityCandidate(
            id="job-1", title="Thực tập sinh Python",
            description="Công ty fintech tuyển thực tập sinh Python",
            type="internship", organization="Momo",
            requirements="Python, Django", url="",
            field_tags=["Python"], region="Hà Nội",
            deadline="2020-01-01",  # expired — must be filtered
            status="active",
        ),
    ]
    return OpportunityMatchRequest(user_profile=profile, opportunities=candidates)


def test_match_opportunities_degraded_fallback():
    """When all providers are down, match_opportunities degrades to the
    keyword heuristic and still returns a valid-shaped response."""
    svc = _fresh_service()
    assert svc.is_ready is False

    req = _sample_request()
    result = asyncio.run(svc.match_opportunities(req))

    assert isinstance(result, dict)
    # Response structure
    assert "user_id" in result
    assert result["user_id"] == "test-student"
    assert "matches" in result
    assert isinstance(result["matches"], list)
    assert "total" in result
    assert "filtered_count" in result
    assert "degraded" in result
    assert result["degraded"] is True
    assert result["reason"] is not None and len(result["reason"]) > 0

    # Expired opportunity filtered out
    assert result["filtered_count"] == 1
    assert result["total"] == 1

    m = result["matches"][0]
    for key in ("id", "title", "organization", "type", "url", "deadline",
                "region", "match_score", "confidence", "confidence_level",
                "is_eligible", "extracted_criteria", "match_reasons",
                "checklist"):
        assert key in m, f"Missing key in match item: {key}"
    assert m["id"] == "sch-1"
    assert m["match_score"] >= 0
    assert 0.0 <= m["confidence"] <= 1.0
    # Keyword fallback caps confidence low
    assert m["confidence"] == 0.3
    assert m["confidence_level"] == "low"
    # Checklist has at least the CV base item
    assert len(m["checklist"]) >= 1
    print("✓ test_match_opportunities_degraded_fallback")


def test_match_opportunities_empty_candidates():
    """An empty opportunity list returns an empty (non-degraded) response."""
    svc = _fresh_service()
    profile = UserProfile(
        id="u1", major="CNTT", skills=["Python"],
        interests=[], location="HCM", role="student", gpa=3.0,
    )
    req = OpportunityMatchRequest(user_profile=profile, opportunities=[])
    result = asyncio.run(svc.match_opportunities(req))

    assert result["total"] == 0
    assert result["matches"] == []
    assert result["degraded"] is False


def test_match_opportunities_filters_expired_deadline():
    """Expired opportunities are excluded from the matches list."""
    svc = _fresh_service()
    req = _sample_request()
    result = asyncio.run(svc.match_opportunities(req))
    # The only live candidate is 'sch-1'
    assert all(m["deadline"] != "2020-01-01" for m in result["matches"])
    titles = [m["title"] for m in result["matches"]]
    assert "Học bổng Australia Awards" in titles
    assert "Thực tập sinh Python" not in titles


def test_match_opportunities_matches_profile_terms():
    """The keyword fallback should boost opportunities sharing profile terms."""
    svc = _fresh_service()
    req = _sample_request()  # major=CNTT, skills=Python,React, interests=AI, location=HCM
    result = asyncio.run(svc.match_opportunities(req))
    m = result["matches"][0]
    # 'CNTT' and 'AI' both appear in field_tags → score should reflect hits
    assert m["match_score"] > 0
    assert any("Khớp" in r or "Khu vực" in r for r in m["match_reasons"])
    print("✓ test_match_opportunities_matches_profile_terms")


if __name__ == "__main__":
    test_match_opportunities_degraded_fallback()
    test_match_opportunities_empty_candidates()
    test_match_opportunities_filters_expired_deadline()
    test_match_opportunities_matches_profile_terms()
    print("\n✅ All opportunity match tests passed!")
