"""Smoke test #14 — End-to-end test for AI Impact Measurement (Idea #19).

Exercises the full FastAPI router → ImpactMeasurementService pipeline via
TestClient, verifying that POST /api/ai/impact/measure returns a valid
response with before/after diff, impact_score, confidence_interval, trend,
and a narrative.

Smoke integration tying together T1 + T2:
  - T2: ai-service services/impact_measure.py + routers/impact_measure.py
  - T1: backend ImpactMeasurementService computes the before/after diff that
        the dashboard renders; this smoke test pins the ai-service shape.

Run:  cd ai-service && python3 -m pytest tests/test_smoke_impact_measure.py -v -s
"""
import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# No real LLM providers → narrative falls back to the deterministic template.
os.environ["DB_TYPE"] = "sqlite"
os.environ["AI_PREFLIGHT"] = "false"
os.environ["DB_SQLITE_PATH"] = os.path.abspath(
    os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db")
)
for _v in ["GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
           "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN"]:
    os.environ[_v] = ""

from main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(app)


def test_smoke_measure_endpoint_returns_valid_report():
    """POST /api/ai/impact/measure → 200, valid impact-measurement report."""
    response = client.post("/api/ai/impact/measure", json={
        "min_lat": 10.9,
        "max_lat": 11.0,
        "min_lng": 106.8,
        "max_lng": 107.0,
        "deployment_date": "2025-01-01",
        "region": "Biên Hòa, Đồng Nai",
    })
    assert response.status_code == 200, response.text
    data = response.json()

    # Core shape (mirrors ImpactMeasureResponse).
    assert "impact_score" in data
    assert 0.0 <= data["impact_score"] <= 100.0
    assert "confidence_interval" in data
    ci = data["confidence_interval"]
    assert 0.0 <= ci["lower"] <= ci["upper"] <= 100.0
    assert "before" in data and "after" in data
    assert "diff" in data
    assert "people_in_radius" in data
    assert "trend" in data
    assert "narrative" in data and isinstance(data["narrative"], str)
    assert "degraded" in data
    print("✓ smoke POST /api/ai/impact/measure → 200 + valid report")
    print(f"  impact_score={data['impact_score']} ci={ci}")
    print(f"  before={data['before']['access_rate']} after={data['after']['access_rate']}")


def test_smoke_measure_default_region():
    """POST /api/ai/impact/measure with no region → falls back to Biên Hòa bbox."""
    response = client.post("/api/ai/impact/measure", json={
        "deployment_date": "2025-01-01",
        "region": "Biên Hòa, Đồng Nai",
    })
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["region"] == "Biên Hòa, Đồng Nai"
    assert data["impact_score"] >= 0
    print("✓ smoke POST /api/ai/impact/measure (default region) → 200")


def test_smoke_measure_degraded_region():
    """POST /api/ai/impact/measure far from any facility → 200, degraded=True."""
    response = client.post("/api/ai/impact/measure", json={
        "min_lat": 12.0, "max_lat": 12.1, "min_lng": 109.0, "max_lng": 109.1,
        "deployment_date": "2025-01-01", "region": "Vùng biển",
    })
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["degraded"] is True
    print("✓ smoke POST /api/ai/impact/measure (degraded region) → 200 + degraded")
