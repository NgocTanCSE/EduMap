"""Unit tests for the AI Impact Measurement service (Idea #19).

Verifies:
  - measure() returns a response that round-trips through ImpactMeasureResponse.
  - Impact score is in [0, 100] and the confidence interval is well-ordered.
  - Before/after diff is self-consistent (after.access_rate >= 0).
  - Synthetic baseline flag is set when no real "before" data exists.
  - Causal notes are returned (transparent risk caveats).
  - Graceful degradation: a request far from any facility still returns a
    valid-shaped report with degraded=True (never a crash / 502).
  - 24 h in-process cache returns consistent results on repeat calls.
  - Refusal markers in an LLM narrative fall back to the deterministic template.
"""

import os
import sys
from unittest.mock import patch

# Make ai-service importable.
_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure SQLite mode against the real seeded DB (no PostgreSQL needed).
os.environ["DB_TYPE"] = "sqlite"
os.environ["AI_PREFLIGHT"] = "false"
os.environ["DB_SQLITE_PATH"] = os.path.abspath(
    os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db")
)
# No real LLM providers in this environment → narrative falls back to template.
os.environ["OWM_API_KEY"] = ""

import pytest
from services.impact_measure import (
    impact_measure,
    ImpactMeasurementService,
    SYNTHETIC_BEFORE_ACCESS_RATE,
    W_COVERAGE,
    W_ACCESS,
    W_USAGE,
    _is_informative_narrative,
    _REFUSAL_MARKERS,
    _wilson_interval,
)
from models.impact_measure_models import ImpactMeasureRequest, ImpactMeasureResponse


# ── Geometry / weights ──────────────────────────────────────────────────────

def test_weights_sum_to_one():
    total = W_COVERAGE + W_ACCESS + W_USAGE
    assert abs(total - 1.0) < 0.001


def test_synthetic_before_access_rate_is_0_7():
    assert SYNTHETIC_BEFORE_ACCESS_RATE == 0.70


def test_wilson_interval_bounds():
    lo, hi = _wilson_interval(85, 100)
    assert 0.0 <= lo <= hi <= 1.0
    assert lo > 0.7  # 85 % success → lower bound still high


def test_wilson_interval_zero_total():
    lo, hi = _wilson_interval(0, 0)
    assert lo == 0.0 and hi == 0.0


def test_refusal_markers_present():
    assert "tôi không thể" in _REFUSAL_MARKERS
    assert "i'm sorry" in _REFUSAL_MARKERS


def test_is_informative_narrative_rejects_refusal():
    assert _is_informative_narrative("Tôi không thể cung cấp thông tin...") is False
    assert _is_informative_narrative("Xin lỗi, tôi là một mô hình ngôn ngữ...") is False
    assert _is_informative_narrative("i'm sorry, i cannot help with that.") is False


def test_is_informative_narrative_accepts_real():
    text = "Sau triển khai, tỉ lệ tiếp cận tăng từ 70.0% lên 84.9% (+21.3%). Điểm tác động AI đo đạt 37.0/100."
    assert _is_informative_narrative(text) is True


# ── Full report against the real seeded DB ───────────────────────────────────

def _measure():
    req = ImpactMeasureRequest(
        min_lat=10.9, max_lat=11.0, min_lng=106.8, max_lng=107.0,
        deployment_date="2025-01-01", region="Biên Hòa, Đồng Nai",
    )
    return impact_measure.measure(req)


def test_measure_returns_valid_response():
    result = _measure()
    # Round-trips through the pydantic response model (shape contract).
    ImpactMeasureResponse(**result)
    assert result["region"] == "Biên Hòa, Đồng Nai"
    assert isinstance(result["bbox"], list) and len(result["bbox"]) == 4
    assert result["population_estimate"] > 0


def test_impact_score_in_range():
    result = _measure()
    assert 0.0 <= result["impact_score"] <= 100.0


def test_confidence_interval_ordered():
    result = _measure()
    ci = result["confidence_interval"]
    assert 0.0 <= ci["lower"] <= ci["upper"] <= 100.0
    assert ci["level"] == 0.95
    assert "method" in ci


def test_before_after_self_consistent():
    result = _measure()
    b, a = result["before"], result["after"]
    assert b["access_rate"] >= 0.0
    assert a["access_rate"] >= 0.0
    assert a["facility_count"] >= 0
    # After cohort is non-empty on the real DB.
    assert a["facility_count"] > 0


def test_synthetic_baseline_flag():
    """No real 'before' data on the seeded DB → synthetic baseline flagged."""
    result = _measure()
    assert result["before"]["synthetic_baseline"] is True
    assert result["degraded"] is True  # synthetic baseline → degraded
    assert result["confidence_interval"]["method"] == "wilson_score+synthetic_baseline_widen"


def test_causal_notes_present():
    result = _measure()
    notes = result["causal_notes"]
    assert isinstance(notes, list) and len(notes) >= 2
    # Every note is a non-empty Vietnamese string.
    assert all(isinstance(n, str) and len(n) > 10 for n in notes)


def test_people_in_radius():
    result = _measure()
    people = result["people_in_radius"]
    assert people["before"] > 0
    assert people["after"] >= people["before"]  # after >= before on the tight bbox
    assert people["radius_km"] == 5.0


def test_trend_structure():
    result = _measure()
    trend = result["trend"]
    assert trend["trend"] in ("tăng", "giảm", "ổn định")
    assert isinstance(trend["growth_rate_pct"], (int, float))
    assert isinstance(trend["monthly"], list)


def test_narrative_is_informative():
    """With no LLM providers, the template narrative must still be used."""
    result = _measure()
    assert _is_informative_narrative(result["narrative"])


def test_cache_returns_same_result():
    req = ImpactMeasureRequest(
        min_lat=10.9, max_lat=11.0, min_lng=106.8, max_lng=107.0,
        deployment_date="2025-01-01", region="Biên Hòa, Đồng Nai",
    )
    r1 = impact_measure.measure(req)
    r2 = impact_measure.measure(req)
    assert r1["impact_score"] == r2["impact_score"]
    assert r2["metadata"].get("cached") is True


# ── Graceful degradation: far from any facility ─────────────────────────────

def test_degraded_region_returns_valid_report():
    """A region with no facilities must still return a valid-shaped report."""
    req = ImpactMeasureRequest(
        min_lat=12.0, max_lat=12.1, min_lng=109.0, max_lng=109.1,  # South China Sea
        deployment_date="2025-01-01", region="Vùng biển",
    )
    result = impact_measure.measure(req)
    ImpactMeasureResponse(**result)  # shape contract
    assert result["degraded"] is True
    assert result["before"]["synthetic_baseline"] is True


def test_service_singleton_type():
    assert isinstance(impact_measure, ImpactMeasurementService)
