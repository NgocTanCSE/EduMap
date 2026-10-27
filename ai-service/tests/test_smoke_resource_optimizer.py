"""Smoke test #12 — End-to-end test for the MCLP Resource Optimizer (Idea #1).

Exercises the full FastAPI router → ResourceOptimizer pipeline via
TestClient, verifying that POST /api/ai/resource/optimize returns a valid
GeoJSON response with three plans, gap features, and metadata.

This is the integration smoke test that ties together T1 + T2:
  - T1: services/resource_optimizer.py  (scipy.milp MCLP solver)
  - T2: routers/resource.py             (FastAPI POST endpoint)

Run:  cd ai-service && python3 -m pytest tests/test_smoke_resource_optimizer.py -v -s
"""
import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Import the FastAPI app from main.py (routers auto-included via try/except)
os.environ.setdefault("OPENROUTER_API_KEY", "")
os.environ.setdefault("HF_TOKEN", "")
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_smoke_optimize_endpoint_returns_valid_geojson():
    """POST /api/ai/resource/optimize → 200, valid FeatureCollection."""
    response = client.post("/api/ai/resource/optimize", json={
        "budget": 25_000_000,
        "demand_points": [
            {"lat": 10.950, "lng": 106.840, "weight": 50, "name": "Trường THCS A"},
            {"lat": 10.952, "lng": 106.841, "weight": 40, "name": "Trường THCS B"},
            {"lat": 10.920, "lng": 106.800, "weight": 60, "name": "Trường THCS C"},
            {"lat": 10.980, "lng": 106.880, "weight": 70, "name": "Trường THCS D"},
            {"lat": 11.050, "lng": 106.700, "weight": 80, "name": "Cộng đồng L (đông lạnh)"},
        ],
        "candidate_locations": [
            {"lat": 10.951, "lng": 106.840, "facility_type": "wifi", "cost": 1_500_000, "name": "Site A"},
            {"lat": 10.921, "lng": 106.800, "facility_type": "wifi", "cost": 1_500_000, "name": "Site B"},
            {"lat": 10.981, "lng": 106.880, "facility_type": "wifi", "cost": 1_500_000, "name": "Site C"},
            {"lat": 11.050, "lng": 106.700, "facility_type": "library", "cost": 15_000_000, "name": "Site F"},
        ],
    })

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()

    # Valid GeoJSON FeatureCollection
    assert body["type"] == "FeatureCollection"
    assert isinstance(body["features"], list)

    # Three plans present
    assert "plans" in body
    for p in ("A", "B", "C"):
        assert p in body["plans"]
        plan = body["plans"][p]
        assert plan["selected"] is not None
        assert plan["total_cost"] is not None
        assert plan["total_served"] is not None
        assert plan["coverage_pct"] is not None
        assert plan["solver"] == "scipy.milp"

    # Coverage increases A <= B <= C
    served_a = body["plans"]["A"]["total_served"]
    served_b = body["plans"]["B"]["total_served"]
    served_c = body["plans"]["C"]["total_served"]
    assert served_a <= served_b
    assert served_b <= served_c

    # Gaps present
    assert "gaps" in body
    assert body["gaps"]["type"] == "FeatureCollection"
    assert isinstance(body["gaps"]["features"], list)

    # Summary with required fields
    assert "summary" in body
    for key in ("budget", "candidate_count", "demand_count", "pre_filtered",
                 "elapsed_ms", "best_plan"):
        assert key in body["summary"]

    print(f"✓ Smoke test passed: A={served_a}, B={served_b}, C={served_c}, "
          f"candidates={body['summary']['candidate_count']}, "
          f"demand={body['summary']['demand_count']}")


def test_smoke_optimize_empty_budget_degrades():
    """POST with zero budget → still returns 200 with valid structure."""
    response = client.post("/api/ai/resource/optimize", json={
        "budget": 0,
        "demand_points": [{"lat": 10.95, "lng": 106.84, "weight": 100, "name": "Test"}],
        "candidate_locations": [],
    })
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "FeatureCollection"
    assert "plans" in body
    print("✓ Smoke test empty budget degraded gracefully")


def test_smoke_optimize_no_body_defaults():
    """POST with empty JSON body → defaults are used, returns 200."""
    response = client.post("/api/ai/resource/optimize", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "FeatureCollection"
    assert "plans" in body
    for p in ("A", "B", "C"):
        assert p in body["plans"]
    print(f"✓ Smoke test no-body: A picked {body['plans']['A']['selected']}, "
          f"C picked {body['plans']['C']['selected']}")
