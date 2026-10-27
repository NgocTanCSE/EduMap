"""Smoke test — End-to-end test for Knowledge Graph router (T2).

Exercises the full FastAPI router → KnowledgeGraphService pipeline via
TestClient, verifying all /api/ai/knowledge/* endpoints return 200 and valid
response structures.

This is the integration smoke test tying together T1 + T2:
  - T1: services/knowledge_graph.py  (KnowledgeGraphService)
  - T2: routers/knowledge.py          (FastAPI endpoints)

Run:  cd ai-service && python3 -m pytest tests/test_smoke_knowledge_graph.py -v -s
"""
import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

os.environ.setdefault("OPENROUTER_API_KEY", "")
os.environ.setdefault("HF_TOKEN", "")
os.environ["DB_TYPE"] = "sqlite"
os.environ["DB_SQLITE_PATH"] = os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db")
os.environ.setdefault("AI_PREFLIGHT", "false")

from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

# ── Env guard ────────────────────────────────────────────────────────────────
# Other test modules (test_data_quality.py, test_predictive_service.py) mutate
# the global DB_SQLITE_PATH during their fixtures and restore it to a throw-away
# DB (/tmp/test_edumap_dq.db). Since the ai-service startup daemon + router
# read DB_SQLITE_PATH at call time (see knowledge_graph.py), we must pin it
# back to the real edumap.db before every smoke test.
_REAL_DB = os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db")
os.environ["DB_SQLITE_PATH"] = _REAL_DB

import pytest  # noqa: E402

@pytest.fixture(autouse=True)
def _knowledge_graph_env():
    _prev = os.environ.get("DB_SQLITE_PATH")
    os.environ["DB_SQLITE_PATH"] = _REAL_DB
    try:
        yield
    finally:
        if _prev is not None:
            os.environ["DB_SQLITE_PATH"] = _prev


def test_smoke_seed_endpoint():
    """POST /api/ai/knowledge/seed → 200, returns nodes + edges count."""
    response = client.post("/api/ai/knowledge/seed", json={})
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()
    assert body["status"] == "success"
    assert "nodes" in body
    assert "edges" in body
    assert body["nodes"] > 0
    print(f"✓ POST /seed: {body['nodes']} nodes, {body['edges']} edges")


def test_smoke_graph_endpoint():
    """GET /api/ai/knowledge/graph → 200, valid {nodes, edges, meta}."""
    response = client.get("/api/ai/knowledge/graph")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()

    assert "nodes" in body
    assert "edges" in body
    assert "meta" in body
    assert isinstance(body["nodes"], list)
    assert isinstance(body["edges"], list)

    if body["nodes"]:
        n = body["nodes"][0]
        assert "id" in n
        assert "type" in n
        assert "name" in n
        assert "confidence" in n

    print(f"✓ GET /graph: {len(body['nodes'])} nodes, {len(body['edges'])} edges")


def test_smoke_graph_node_types_filter():
    """GET /api/ai/knowledge/graph?node_types=sponsor → only sponsor nodes."""
    response = client.get("/api/ai/knowledge/graph?node_types=sponsor")
    assert response.status_code == 200
    body = response.json()

    for n in body["nodes"]:
        assert n["type"] == "sponsor"

    print(f"✓ GET /graph?node_types=sponsor: {len(body['nodes'])} sponsor nodes")


def test_smoke_query_endpoint():
    """POST /api/ai/knowledge/query → 200, valid 1-degree traversal."""
    # First get a node to query from
    graph_resp = client.get("/api/ai/knowledge/graph?node_types=scholarship&limit=5")
    body = graph_resp.json()

    if not body["nodes"]:
        assert False, "No scholarship nodes available to query"

    node_id = body["nodes"][0]["id"]
    response = client.post("/api/ai/knowledge/query", json={
        "node_id": node_id,
        "depth": 1,
        "limit": 50,
    })

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    result = response.json()

    assert "start_node" in result
    assert "neighbors" in result
    assert "edges" in result
    assert isinstance(result["neighbors"], list)
    assert isinstance(result["edges"], list)
    assert result["start_node"]["id"] == node_id

    print(f"✓ POST /query: start={result['start_node']['name']}, "
          f"{len(result['neighbors'])} neighbors, {len(result['edges'])} edges")


def test_smoke_query_invalid_node():
    """POST /query with nonexistent node → 200, empty neighbors (not 500)."""
    response = client.post("/api/ai/knowledge/query", json={
        "node_id": "definitely_not_a_real_node_id",
        "depth": 1,
    })
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    result = response.json()
    assert result["neighbors"] == []
    print("✓ POST /query(invalid): returns 200 with empty neighbors")


def test_smoke_suggest_partners():
    """POST /api/ai/knowledge/suggest-partners → 200, ranked suggestions."""
    response = client.post("/api/ai/knowledge/suggest-partners", json={
        "query": "học bổng hàn quốc",
        "limit": 10,
        "focus_type": "sponsor",
    })

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()

    assert "query" in body
    assert "count" in body
    assert "suggestions" in body
    assert isinstance(body["suggestions"], list)

    # Verify ranking (scores descending)
    if len(body["suggestions"]) > 1:
        scores = [s["match_score"] for s in body["suggestions"]]
        assert scores == sorted(scores, reverse=True), "Suggestions not ranked by score"

    print(f"✓ POST /suggest-partners: {body['count']} suggestions, "
          f"top={body['suggestions'][0]['name'] if body['suggestions'] else 'N/A'}")


def test_smoke_suggest_partners_empty():
    """POST /suggest-partners with empty query → 200, empty list."""
    response = client.post("/api/ai/knowledge/suggest-partners", json={
        "query": "",
        "limit": 10,
    })
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 0
    print("✓ POST /suggest-partners(''): returns 0 suggestions")


def test_smoke_extract_entities():
    """POST /api/ai/knowledge/extract → 200, entities + linked_nodes."""
    response = client.post("/api/ai/knowledge/extract", json={
        "text": "Tôi đang tìm học bổng hàn quốc tại Đại học Quốc gia Hà Nội",
    })

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()

    assert "entities" in body
    assert "linked_nodes" in body
    assert "confidence" in body
    assert "degraded" in body
    assert isinstance(body["entities"], list)

    print(f"✓ POST /extract: {len(body['entities'])} entities, "
          f"{len(body['linked_nodes'])} linked, degraded={body['degraded']}")


def test_smoke_extract_no_text():
    """POST /extract with empty body → 422 (validation error, not 500)."""
    response = client.post("/api/ai/knowledge/extract", json={})
    assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    print("✓ POST /extract({}): returns 422 (validation)")


def test_smoke_reviews_endpoint():
    """GET /api/ai/knowledge/reviews → 200, list of review entries."""
    response = client.get("/api/ai/knowledge/reviews")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()
    assert "reviews" in body
    assert isinstance(body["reviews"], list)
    print(f"✓ GET /reviews: {len(body['reviews'])} pending reviews")


if __name__ == "__main__":
    # Allow running directly: python3 test_smoke_knowledge_graph.py
    test_smoke_seed_endpoint()
    test_smoke_graph_endpoint()
    test_smoke_graph_node_types_filter()
    test_smoke_query_endpoint()
    test_smoke_query_invalid_node()
    test_smoke_suggest_partners()
    test_smoke_suggest_partners_empty()
    test_smoke_extract_entities()
    test_smoke_extract_no_text()
    test_smoke_reviews_endpoint()
    print("\n✅ Tất cả smoke tests đã vượt qua!")
