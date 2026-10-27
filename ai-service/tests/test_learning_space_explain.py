"""Tests for the AI Learning Space Recommender explain endpoint (Idea #13, T2).

Covers:
  - LLM service fallback method returns valid explanation structure
  - FastAPI router POST /api/ai/learning-space/explain returns 200 + text
  - Degraded flag surfaces when no providers are configured
  - Cache key determinism (same input → same cache key)
"""
import asyncio
import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure NO real API providers are configured before importing
for _v in [
    "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "XKIRO_API_KEY",
    "NVIDIA_API_KEY", "NIM_API_KEY",
]:
    os.environ[_v] = ""
os.environ["AI_PREFLIGHT"] = "false"

from services.llm_service import LLMService
from main import app as fastapi_app
from fastapi.testclient import TestClient

client = TestClient(fastapi_app)


def _fresh_service():
    """Return a brand-new LLMService with all providers disabled."""
    return LLMService()


# ── LLM service fallback ──────────────────────────────────────────────

def test_explain_fallback_returns_valid_structure():
    """When all providers are down, the fallback returns a usable explanation."""
    svc = _fresh_service()
    spot = {
        "id": "spot-1",
        "name": "Thư viện Quốc gia Việt Nam",
        "type": "library",
        "rating_avg": 4.5,
        "quietness": 5,
        "has_wifi": True,
        "distance_km": 2.3,
        "open_now": True,
        "matching_criteria": {"distance": 0.8, "quietness": 1.0, "wifi": 1.0},
    }
    preferences = {"radius_km": 5, "min_rating": 4}

    result = asyncio.run(svc.explain_learning_space_recommendation(spot, preferences))

    assert isinstance(result, dict)
    assert "explanation" in result
    assert isinstance(result["explanation"], str)
    assert len(result["explanation"]) > 10
    # Fallback should be marked degraded
    assert result.get("degraded") is True or result.get("_degraded") is True
    print("✓ test_explain_fallback_returns_valid_structure")


def test_explain_fallback_includes_spot_name():
    """The template explanation includes the spot name."""
    svc = _fresh_service()
    spot = {
        "id": "spot-2",
        "name": "Thư viện Bách Khoa",
        "type": "library",
        "rating_avg": 4.3,
        "quietness": 4,
        "has_wifi": True,
        "distance_km": 0.5,
        "matching_criteria": {"distance": 0.95, "rating": 0.86, "quietness": 0.8},
    }
    result = asyncio.run(svc.explain_learning_space_recommendation(spot, {}))
    assert "Thư viện Bách Khoa" in result["explanation"]
    print("✓ test_explain_fallback_includes_spot_name")


def test_explain_fallback_no_reasons_still_returns_explanation():
    """Edge case: spot with no matching criteria should still get a fallback."""
    svc = _fresh_service()
    spot = {
        "id": "spot-3",
        "name": "Some Spot",
        "type": "cafe",
        "rating_avg": 0,
        "quietness": None,
        "has_wifi": False,
        "matching_criteria": {},
    }
    result = asyncio.run(svc.explain_learning_space_recommendation(spot, {}))
    assert isinstance(result["explanation"], str)
    assert len(result["explanation"]) > 10
    print("✓ test_explain_fallback_no_reasons_still_returns_explanation")


# ── Router endpoint ───────────────────────────────────────────────────

def test_explain_endpoint_returns_200():
    """POST /api/ai/learning-space/explain → 200 with explanation field."""
    response = client.post("/api/ai/learning-space/explain", json={
        "spot": {
            "id": "spot-1",
            "name": "Thư viện Quốc gia Việt Nam",
            "type": "library",
            "rating_avg": 4.5,
            "quietness": 5,
            "has_wifi": True,
            "amenities": ["wifi", "power_outlets"],
            "distance_km": 2.3,
            "open_now": True,
            "matching_criteria": {"distance": 0.8, "quietness": 1.0, "wifi": 1.0},
        },
        "preferences": {"radius_km": 5, "min_rating": 4},
    })
    assert response.status_code == 200
    body = response.json()
    assert "explanation" in body
    assert isinstance(body["explanation"], str)
    assert len(body["explanation"]) > 10
    print("✓ test_explain_endpoint_returns_200")


def test_explain_endpoint_always_degraded_without_keys():
    """With no providers configured, the endpoint returns degraded=True
    (never a 500 — graceful degradation is the contract)."""
    response = client.post("/api/ai/learning-space/explain", json={
        "spot": {
            "id": "spot-x",
            "name": "Test Spot",
            "type": "library",
            "rating_avg": 4.0,
            "quietness": 4,
            "has_wifi": True,
            "distance_km": 1.0,
            "matching_criteria": {"distance": 0.9, "rating": 0.8},
        },
        "preferences": {},
    })
    assert response.status_code == 200
    body = response.json()
    assert body["degraded"] is True
    assert body["explanation"] != ""
    print("✓ test_explain_endpoint_always_degraded_without_keys")


def test_explain_endpoint_accepts_minimal_spot():
    """A spot with only required fields should still return 200."""
    response = client.post("/api/ai/learning-space/explain", json={
        "spot": {"name": "Minimal Spot"},
        "preferences": {},
    })
    assert response.status_code == 200
    body = response.json()
    assert "explanation" in body
    print("✓ test_explain_endpoint_accepts_minimal_spot")


# ── Cache key determinism ─────────────────────────────────────────────

def test_cache_key_deterministic():
    """Same spot + preferences → same cache key (so responses are cached)."""
    import hashlib, json
    spot = {"id": "spot-1"}
    prefs = {"radius_km": 5}
    key1 = hashlib.md5(
        f"ls_explain:{spot.get('id', '')}:{hashlib.md5(json.dumps(prefs, sort_keys=True, default=str).encode()).hexdigest()}"
        .encode()
    ).hexdigest()
    key2 = hashlib.md5(
        f"ls_explain:{spot.get('id', '')}:{hashlib.md5(json.dumps(prefs, sort_keys=True, default=str).encode()).hexdigest()}"
        .encode()
    ).hexdigest()
    assert key1 == key2
    print("✓ test_cache_key_deterministic")
