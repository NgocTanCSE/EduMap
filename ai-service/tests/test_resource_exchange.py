"""Unit tests for the Resource Exchange AI ranking + greedy scheduling.

Mirrors ``tests/test_impact_match.py``: when ALL LLM providers are disabled
(empty API keys), ``rank_resource_matches`` must return a valid-shaped dict
with template-based fallback scores + a conflict-free transport plan
instead of raising a 502.
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
from models.resource_exchange_models import (
    ResourceExchangeRequest,
    MatchCandidate,
    ResourceInfo,
    RequestInfo,
)


def _fresh_service():
    """Return a brand-new LLMService with all providers disabled."""
    return LLMService()


def _make_pair(rid: str = "r1", reqid: str = "req1", score: float = 75.0) -> MatchCandidate:
    return MatchCandidate(
        resource_id=rid,
        request_id=reqid,
        resource=ResourceInfo(
            id=rid,
            type="device",
            title="Máy tính bảng iPad cũ",
            description="iPad Air thế hệ 4",
            condition=4,
            location="Biên Hòa, Đồng Nai",
            lat=10.9570,
            lng=106.8430,
            available_from="2026-10-27T10:00:00Z",
            cost=0,
            contact_method="library@tranbiennth.edu.vn",
            is_verified=True,
            tags=["device", "tablet"],
            metadata={},
        ),
        request=RequestInfo(
            id=reqid,
            need_type="device",
            title="Cần iPad cho phòng thí nghiệm số",
            description="Trường THCS Nguyễn Trãi cần iPad",
            urgency="high",
            location="Biên Hòa, Đồng Nai",
            lat=10.9425,
            lng=106.8510,
            deadline="2026-11-05T17:00:00Z",
            preferred_min_condition=3,
            contact_method="giaoan@tno.edu.vn",
            tags=["device", "tablet"],
        ),
        match_score=score,
        match_reasons=["Gần khu vực", "Điều kiện đạt"],
    )


def test_rank_resource_matches_degraded_fallback():
    """rank_resource_matches returns template-based results with degraded=True
    instead of raising when all LLM providers are down."""
    svc = _fresh_service()
    data = ResourceExchangeRequest(
        pairs=[_make_pair(), _make_pair("r2", "req2", score=40.0)],
    )
    result = asyncio.run(svc.rank_resource_matches(data))

    assert isinstance(result, dict)
    assert "ranked_matches" in result
    assert isinstance(result["ranked_matches"], list)
    assert result["degraded"] is True
    assert result["reason"] is not None
    assert "unavailable" in result["reason"].lower() or "degradation" in result["reason"].lower()
    print("✓ test_rank_resource_matches_degraded_fallback")


def test_rank_resource_matches_template_scores():
    """Template fallback preserves the SQLite-side score ordering (0–100)."""
    svc = _fresh_service()
    pairs = [
        _make_pair("r1", "req1", score=90.0),   # high score
        _make_pair("r2", "req2", score=30.0),   # low score
    ]
    data = ResourceExchangeRequest(pairs=pairs)
    result = asyncio.run(svc.rank_resource_matches(data))

    matches = result["ranked_matches"]
    assert len(matches) == 2
    # Sorted descending by score
    assert matches[0]["match_score"] >= matches[1]["match_score"]
    for m in matches:
        assert 0 <= m["match_score"] <= 100
        assert isinstance(m["match_reasons"], list)
        assert isinstance(m["next_steps"], list)
        assert "explanation" in m
    print("✓ test_rank_resource_matches_template_scores")


def test_rank_resource_matches_empty_pairs():
    """With no pairs, returns empty ranked_matches (no crash)."""
    svc = _fresh_service()
    data = ResourceExchangeRequest(pairs=[])
    result = asyncio.run(svc.rank_resource_matches(data))

    assert isinstance(result, dict)
    assert result["ranked_matches"] == []
    assert result["degraded"] is True
    assert "reason" in result
    print("✓ test_rank_resource_matches_empty_pairs")


def test_rank_resource_matches_safety_cap():
    """Safety-net cap: even if input has 30 pairs, only 15 are processed."""
    svc = _fresh_service()
    pairs = [_make_pair(f"r{i}", f"req{i}") for i in range(30)]
    data = ResourceExchangeRequest(pairs=pairs, max_results=15)
    result = asyncio.run(svc.rank_resource_matches(data))
    assert isinstance(result, dict)
    # Fallback may return up to 15 template matches
    assert len(result["ranked_matches"]) <= 15
    assert result["degraded"] is True
    print("✓ test_rank_resource_matches_safety_cap")


def test_resource_exchange_fallback_includes_transport_plan():
    """The fallback must attach a (possibly empty) transport_plan so the
    frontend can render a schedule even when the LLM is offline."""
    svc = _fresh_service()
    data = ResourceExchangeRequest(pairs=[_make_pair("r1", "req1"), _make_pair("r2", "req2")])
    result = _fresh_service().__class__ and svc._resource_exchange_fallback(data, "no providers")
    assert isinstance(result, dict)
    assert "transport_plan" in result
    assert isinstance(result["transport_plan"], list)
    # 2 distinct resource/request pairs → 2 conflict-free slots
    assert len(result["transport_plan"]) == 2
    print("✓ test_resource_exchange_fallback_includes_transport_plan")


def test_build_transport_schedule_conflict_free():
    """Greedy scheduler never double-books a resource or a request: each
    resource_id and each request_id appears at most once in the plan."""
    svc = _fresh_service()
    matches = [
        {"resource_id": "r1", "request_id": "req1", "match_score": 95},
        {"resource_id": "r1", "request_id": "req2", "match_score": 90},  # r1 conflict
        {"resource_id": "r2", "request_id": "req1", "match_score": 88},  # req1 conflict
        {"resource_id": "r2", "request_id": "req3", "match_score": 80},
    ]
    plan = svc._build_transport_schedule(matches)
    rids = [s["resource_id"] for s in plan]
    reqids = [s["request_id"] for s in plan]
    assert len(rids) == len(set(rids)), "resource double-booked"
    assert len(reqids) == len(set(reqids)), "request double-booked"
    # r1→req1 wins (highest). r1→req2 skipped. r2→req1 skipped. r2→req3 booked.
    assert {"r1", "r2"} == set(rids)
    assert {"req1", "req3"} == set(reqids)
    assert [s["pickup_order"] for s in plan] == [1, 2]
    print("✓ test_build_transport_schedule_conflict_free")


def test_build_transport_schedule_staggered_slots():
    """Scheduled pickups are staggered by the slot window (2h) with no overlap."""
    svc = _fresh_service()
    matches = [
        {"resource_id": f"r{i}", "request_id": f"req{i}", "match_score": 50}
        for i in range(3)
    ]
    plan = svc._build_transport_schedule(matches)
    assert len(plan) == 3
    times = [s["pickup_datetime"] for s in plan]
    # Each slot is 2h apart
    from datetime import datetime
    t0 = datetime.fromisoformat(times[0])
    t1 = datetime.fromisoformat(times[1])
    t2 = datetime.fromisoformat(times[2])
    assert abs((t1 - t0).total_seconds() - 7200) < 1
    assert abs((t2 - t1).total_seconds() - 7200) < 1
    print("✓ test_build_transport_schedule_staggered_slots")


def test_resource_exchange_models_validate():
    """ResourceExchangeRequest accepts MatchCandidate with proper fields."""
    pair = _make_pair()
    assert pair.resource_id == "r1"
    assert pair.request_id == "req1"
    assert pair.resource.type == "device"
    assert pair.request.need_type == "device"
    assert pair.request.urgency == "high"
    assert pair.match_score == 75.0
    assert "Gần khu vực" in pair.match_reasons[0]
    print("✓ test_resource_exchange_models_validate")


def test_rank_resource_matches_returns_degraded_flag():
    """The fallback dict must carry 'degraded' (not '_degraded') so the
    FastAPI router can detect graceful degradation for the frontend."""
    svc = _fresh_service()
    data = ResourceExchangeRequest(pairs=[_make_pair()])
    result = asyncio.run(svc.rank_resource_matches(data))

    assert "degraded" in result
    assert "reason" in result
    # Ensure no underscore-prefixed keys leak to the router
    assert "_degraded" not in result
    assert "_reason" not in result
    print("✓ test_rank_resource_matches_returns_degraded_flag")


if __name__ == "__main__":
    test_rank_resource_matches_degraded_fallback()
    test_rank_resource_matches_template_scores()
    test_rank_resource_matches_empty_pairs()
    test_rank_resource_matches_safety_cap()
    test_resource_exchange_fallback_includes_transport_plan()
    test_build_transport_schedule_conflict_free()
    test_build_transport_schedule_staggered_slots()
    test_resource_exchange_models_validate()
    test_rank_resource_matches_returns_degraded_flag()
    print("\n✅ All Resource Exchange tests passed!")
