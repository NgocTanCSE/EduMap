"""
Tests for the SafeRoute AI explain endpoint (Idea #12: T3).

Covers:
  1. Degraded fallback when all LLM providers are disabled — returns valid
     template explanation with ``degraded=True``.
  2. LLM enrichment path (mocked llm_service) — returns LLM explanation with
     ``degraded=False``.
  3. Empty routes list edge case.
  4. LLM returns non-JSON → fallback triggered.
"""

import os
import asyncio
import json
from unittest.mock import MagicMock, AsyncMock, patch

import pytest

# ── Disable all AI providers to force regex/template fallback ────────────
_PROVIDER_ENV_VARS = [
    "XKIRO_API_KEY", "XKIRO_MODEL", "XKIRO_BASE_URL",
    "NVIDIA_API_KEY", "NVIDIA_BASE_URL", "KIMI_API_KEY", "KIMI_BASE_URL",
    "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "GEMINI_API_KEY",
    "HF_TOKEN", "HF_API_TOKEN", "HUGGING_FACE_HUB_TOKEN",
]
for _v in _PROVIDER_ENV_VARS:
    os.environ.pop(_v, None)
os.environ["AI_PREFLIGHT"] = "false"

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import sys
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

from routers.route import _route_explain_fallback, explain_route
import routers.route as route_module
from models.route_models import (
    RouteExplainRequest,
    RouteExplainPreferences,
    SafeRouteSummary,
    SafetyFactors,
)


def _make_routes():
    """Create 3 mock scored routes for testing."""
    return [
        SafeRouteSummary(
            safetyScore=92,
            safetyFactors=SafetyFactors(distanceScore=88, durationScore=95, floodRisk=0, trafficRisk=5),
            distance=2500,
            duration=240,
            explanation="Quãng đường 2.5 km, khoảng 4 phút. Không ngập, ít tắc nghẽn.",
            isPrimary=True,
            floodWarnings=[],
            trafficAnalysis=None,
        ),
        SafeRouteSummary(
            safetyScore=75,
            safetyFactors=SafetyFactors(distanceScore=60, durationScore=70, floodRisk=25, trafficRisk=10),
            distance=3000,
            duration=360,
            explanation="Quãng đường 3.0 km, khoảng 6 phút. Rủi ro ngập thấp.",
            isPrimary=False,
            floodWarnings=[],
            trafficAnalysis=None,
        ),
        SafeRouteSummary(
            safetyScore=58,
            safetyFactors=SafetyFactors(distanceScore=40, durationScore=50, floodRisk=60, trafficRisk=30),
            distance=4200,
            duration=480,
            explanation="Quãng đường 4.2 km, khoảng 8 phút. Có ngập và tắc nghẽn.",
            isPrimary=False,
            floodWarnings=[{"id": "z1", "name": "Khu vực ngập lũ khu phố 3", "riskLevel": "high"}],
            trafficAnalysis=None,
        ),
    ]


def _make_request():
    return RouteExplainRequest(
        routes=_make_routes(),
        preferences=RouteExplainPreferences(
            avoidFlood=True, avoidTraffic=True, safetyWeight=0.3
        ),
        origin={"lng": 106.843, "lat": 10.957},
        destination={"lng": 106.870, "lat": 10.945},
    )


# ── Tests ───────────────────────────────────────────────────────────────


def test_fallback_returns_valid_structure():
    """Template fallback (no LLM) returns all required fields."""
    data = _make_request()
    result = _route_explain_fallback(data, "test error")

    assert isinstance(result, dict)
    assert "explanation" in result
    assert "route_reasons" in result
    assert result["degraded"] is True
    assert result["source"] == "template"
    assert len(result["route_reasons"]) == 3
    for rr in result["route_reasons"]:
        assert "route_index" in rr
        assert "reason" in rr
        assert isinstance(rr["reason"], str)
        assert len(rr["reason"]) > 10


def test_fallback_explanation_mentions_scores():
    """Fallback explanation includes safety scores for each route."""
    data = _make_request()
    result = _route_explain_fallback(data, "test")

    # The best route (92/100) should be mentioned
    assert "92" in result["explanation"]
    assert "2.5" in result["explanation"]  # distance in km


def test_fallback_with_empty_routes():
    """Empty routes list → fallback still returns valid structure."""
    data = RouteExplainRequest(routes=[], preferences=RouteExplainPreferences())
    result = _route_explain_fallback(data, "no routes")

    assert result["degraded"] is True
    assert result["route_reasons"] == []
    assert "Không có lộ trình" in result["explanation"]


def test_explain_route_degraded_when_no_providers():
    """When all LLM providers are disabled, explain_route returns degraded fallback."""
    data = _make_request()

    # Reset lazy loading so _get_llm_service picks up the disabled state
    import routers.route as route_module
    route_module._services_loaded = False
    route_module._llm_service = None

    result = asyncio.run(explain_route(data))

    assert isinstance(result, dict)
    assert result["degraded"] is True
    assert "explanation" in result
    assert len(result["explanation"]) > 20
    assert len(result["route_reasons"]) == 3
    assert result["source"] == "template"


def test_explain_route_empty_routes():
    """Empty routes → immediate fallback without calling LLM."""
    data = RouteExplainRequest(routes=[], preferences=RouteExplainPreferences())
    result = asyncio.run(explain_route(data))

    assert result["degraded"] is True
    assert len(result["route_reasons"]) == 0
    assert "Không có lộ trình" in result["explanation"]


def test_explain_route_llm_success():
    """When LLM returns valid JSON, result is non-degraded."""
    data = _make_request()

    # Mock the LLM service
    mock_llm = MagicMock()
    mock_llm.is_ready = True
    mock_llm._extract_json.return_value = {
        "explanation": "Tuyến đầu tiên an toàn nhất vì không qua khu vực ngập.",
        "route_reasons": [
            {"route_index": 0, "reason": "Không ngập, ít tắc nghẽn"},
            {"route_index": 1, "reason": "Qua khu vực có ngập thấp"},
            {"route_index": 2, "reason": "Rủi ro cao, tránh nếu không cần thiết"},
        ],
    }
    mock_llm._generate_text_with_fallback.return_value = '{"explanation": "ok", "route_reasons": []}'

    with patch.object(route_module, "_get_llm_service", return_value=mock_llm):
        result = asyncio.run(explain_route(data))

    assert result["degraded"] is False
    assert result["source"] == "llm"
    assert "an toàn nhất" in result["explanation"]
    assert len(result["route_reasons"]) == 3
    mock_llm._generate_text_with_fallback.assert_called_once()
    mock_llm._extract_json.assert_called_once()


def test_explain_route_llm_returns_invalid_json():
    """When LLM returns non-JSON, fallback is triggered."""
    data = _make_request()

    mock_llm = MagicMock()
    mock_llm.is_ready = True
    mock_llm._extract_json.return_value = None  # invalid JSON
    mock_llm._generate_text_with_fallback.return_value = "garbage text"

    with patch.object(route_module, "_get_llm_service", return_value=mock_llm):
        result = asyncio.run(explain_route(data))

    assert result["degraded"] is True
    assert result["source"] == "template"


def test_explain_route_llm_returns_missing_keys():
    """When LLM returns JSON missing required keys, fallback is triggered."""
    data = _make_request()

    mock_llm = MagicMock()
    mock_llm.is_ready = True
    # Missing 'route_reasons' key
    mock_llm._extract_json.return_value = {"explanation": "only explanation"}
    mock_llm._generate_text_with_fallback.return_value = '{"explanation": "..."}'

    with patch.object(route_module, "_get_llm_service", return_value=mock_llm):
        result = asyncio.run(explain_route(data))

    assert result["degraded"] is True
    assert result["source"] == "template"


def test_route_explain_request_model():
    """RouteExplainRequest model accepts and validates input."""
    req = RouteExplainRequest(
        routes=_make_routes(),
        preferences=RouteExplainPreferences(avoidFlood=False, avoidTraffic=True),
        origin={"lng": 106.84, "lat": 10.96},
        destination={"lng": 106.87, "lat": 10.94},
    )
    assert req.preferences.avoidFlood is False
    assert req.preferences.avoidTraffic is True
    assert len(req.routes) == 3
    assert req.routes[0].safetyFactors.floodRisk == 0


def test_route_explain_response_model():
    """RouteExplainResponse model accepts the return shape."""
    from models.route_models import RouteExplainResponse
    resp = RouteExplainResponse(
        explanation="Test explanation",
        route_reasons=[{"route_index": 0, "reason": "Test reason"}],
        degraded=False,
        reason=None,
        source="llm",
    )
    assert resp.explanation == "Test explanation"
    assert resp.degraded is False


# ── Import sys at top level ──────────────────────────────────────────────
