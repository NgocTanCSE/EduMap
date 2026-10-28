"""Unit tests for the ImpactMatch LLM ranking method and graceful degradation.

Mirrors ``tests/test_ai_fallbacks.py``: when ALL LLM providers are disabled
(empty API keys), ``rank_impact_matches`` must return a valid-shaped dict
with template-based fallback scores instead of raising a 502.
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
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN",
]:
    os.environ[_v] = ""
os.environ["AI_PREFLIGHT"] = "false"

from services.llm_service import LLMService
from models.impactmatch_models import (
    ImpactMatchRequest,
    NeedSponsorPair,
    NeedInfo,
    SponsorInfo,
)


def _fresh_service():
    """Return a brand-new LLMService with all providers disabled."""
    return LLMService()


def _make_pair(need_id: str = "n1", sponsor_id: str = "s1") -> NeedSponsorPair:
    return NeedSponsorPair(
        need_id=need_id,
        sponsor_id=sponsor_id,
        need=NeedInfo(
            id=need_id,
            title="Xây thư viện STEM",
            description="Cần trang thiết bị cho thư viện STEM",
            category="education_equipment",
            urgency="high",
            cost_estimate=200000000,
            location="Biên Hòa, Đồng Nai",
            tags=["stem", "library"],
        ),
        sponsor=SponsorInfo(
            id=sponsor_id,
            name="Bộ Giáo dục và Đào tạo",
            description="Bộ nhà nước phụ trách giáo dục",
            focus_areas=["education", "infrastructure"],
            budget_amount=5000000000,
            location="Hà Nội",
        ),
        category_match=False,
    )


def test_rank_impact_matches_degraded_fallback():
    """rank_impact_matches returns template-based results with degraded=True
    instead of raising when all LLM providers are down."""
    svc = _fresh_service()
    data = ImpactMatchRequest(
        pairs=[_make_pair(), _make_pair("n2", "s2")],
    )
    result = asyncio.run(svc.rank_impact_matches(data))

    assert isinstance(result, dict)
    assert "ranked_matches" in result
    assert isinstance(result["ranked_matches"], list)
    assert result["degraded"] is True
    assert result["reason"] is not None
    assert "unavailable" in result["reason"].lower() or "degradation" in result["reason"].lower()
    print("✓ test_rank_impact_matches_degraded_fallback")


def test_rank_impact_matches_template_scores():
    """Template fallback must produce valid score ordering (cost-fit heuristic).

    With all providers down, the template fallback scores pairs by
    budget/cost ratio. Verify the result has the expected shape and
    scores are 0-100.
    """
    svc = _fresh_service()
    pairs = [
        # sponsor has 5B budget for 200M need → high cost fit
        _make_pair("n1", "s1"),
        # sponsor has 5B budget for 200M need → same high cost fit
        _make_pair("n2", "s2"),
    ]
    data = ImpactMatchRequest(pairs=pairs)
    result = asyncio.run(svc.rank_impact_matches(data))

    matches = result["ranked_matches"]
    assert len(matches) == 2
    for m in matches:
        assert "need_id" in m
        assert "sponsor_id" in m
        assert 0 <= m["match_score"] <= 100
        assert isinstance(m["match_reasons"], list)
        assert isinstance(m["next_steps"], list)
    print("✓ test_rank_impact_matches_template_scores")


def test_rank_impact_matches_empty_pairs():
    """With no pairs, returns empty ranked_matches (no crash)."""
    svc = _fresh_service()
    data = ImpactMatchRequest(pairs=[])
    result = asyncio.run(svc.rank_impact_matches(data))

    assert isinstance(result, dict)
    assert result["ranked_matches"] == []
    assert result["degraded"] is True
    assert "reason" in result
    print("✓ test_rank_impact_matches_empty_pairs")


def test_rank_impact_matches_safety_cap():
    """Safety-net cap: even if input has 30 pairs, only 15 are processed."""
    svc = _fresh_service()
    pairs = [_make_pair(f"n{i}", f"s{i}") for i in range(30)]
    data = ImpactMatchRequest(pairs=pairs, max_results=15)
    # With all providers down, this goes straight to fallback.
    # But we verify _no_ exception is raised (safety cap doesn't break things).
    result = asyncio.run(svc.rank_impact_matches(data))
    assert isinstance(result, dict)
    # Fallback may return up to 15 template matches
    assert len(result["ranked_matches"]) <= 15
    assert result["degraded"] is True
    print("✓ test_rank_impact_matches_safety_cap")


def test_impactmatch_models_validate():
    """ImpactMatchRequest accepts NeedSponsorPair with proper fields."""
    pair = _make_pair()
    assert pair.need_id == "n1"
    assert pair.sponsor_id == "s1"
    assert pair.need.category == "education_equipment"
    assert pair.sponsor.budget_amount == 5000000000
    assert pair.category_match is False
    print("✓ test_impactmatch_models_validate")


def test_rank_impact_matches_returns_degraded_flag():
    """The fallback dict must carry 'degraded' (not '_degraded') so the
    FastAPI router can detect graceful degradation for the frontend."""
    svc = _fresh_service()
    data = ImpactMatchRequest(pairs=[_make_pair()])
    result = asyncio.run(svc.rank_impact_matches(data))

    assert "degraded" in result
    assert "reason" in result
    # Ensure no underscore-prefixed keys leak to the router
    assert "_degraded" not in result
    assert "_reason" not in result
    print("✓ test_rank_impact_matches_returns_degraded_flag")


if __name__ == "__main__":
    test_rank_impact_matches_degraded_fallback()
    test_rank_impact_matches_template_scores()
    test_rank_impact_matches_empty_pairs()
    test_rank_impact_matches_safety_cap()
    test_impactmatch_models_validate()
    test_rank_impact_matches_returns_degraded_flag()
    print("\n✅ All ImpactMatch tests passed!")
