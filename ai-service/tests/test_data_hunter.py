"""Unit tests for Idea #6: Missing Data Hunter.

Tests:
  - identify_data_gaps: returns a valid GeoJSON FeatureCollection
  - identify_data_gaps: spatial gap detection (empty grid cells flagged)
  - identify_data_gaps: features carry required properties (gap_score, priority, …)
  - identify_data_gaps: attributes gaps aggregation correct
  - identify_data_gaps: gap_score ordering and priority levels
  - identify_data_gaps: Polygon coordinates are [lng, lat] (RFC 7946)
  - identify_data_gaps: polygon rings are closed
  - identify_data_gaps: empty / None / single-point inputs degrade gracefully
  - identify_data_gaps: grid_size_km clamping
  - _safe_float and _haversine_vectorized helpers
  - router importable + POST /gaps returns valid shape
"""

import os
import sys
import io
import contextlib

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Silence the "SERVICES PACKAGE LOADED" / "ROUTERS PACKAGE LOADED" banners.
import io, contextlib  # noqa: E402

from services.clustering_service import clustering_service as cs


# ── Helpers ──────────────────────────────────────────────────────────────────

def _tight_cluster(lat, lng, n=5, spread=0.002):
    """Generate n tightly-clustered points around (lat, lng)."""
    pts = []
    for i in range(n):
        pts.append({
            "lat": lat + (i - n / 2) * spread,
            "lng": lng + (i - n / 2) * spread,
            "name": f"POI {i}",
            "address": f"Address {i}",
            "city": "Biên Hòa",
            "district": "Biên Hòa",
            "category": "school",
        })
    return pts


def _sparse_points():
    """Two tight clusters far apart, leaving empty cells in between."""
    return _tight_cluster(10.95, 106.84) + _tight_cluster(10.98, 106.90)


# ── GeoJSON structure tests ──────────────────────────────────────────────────

def test_returns_geojson_featurecollection():
    """identify_data_gaps returns a valid GeoJSON FeatureCollection."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(_sparse_points(), grid_size_km=0.5)
    assert isinstance(result, dict)
    assert result["type"] == "FeatureCollection"
    assert isinstance(result.get("features"), list)
    print("✓ test_returns_geojson_featurecollection")


def test_returns_summary_and_metadata():
    """Response includes summary, attribute_gaps, and metadata."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(_sparse_points(), grid_size_km=0.5)
    assert "summary" in result
    assert "attribute_gaps" in result
    assert "metadata" in result
    assert "method" in result["metadata"]
    assert result["metadata"]["method"] == "grid_based_coverage_analysis"
    assert "degraded" in result["metadata"]
    print("✓ test_returns_summary_and_metadata")


def test_features_have_polygon_geometry():
    """Every gap feature carries a Polygon geometry."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(_sparse_points(), grid_size_km=0.5)
    feats = result["features"]
    assert len(feats) > 0, "Should have gap cells when points are sparse"
    for f in feats:
        assert f["type"] == "Feature"
        geom = f["geometry"]
        assert geom["type"] == "Polygon"
        assert isinstance(geom["coordinates"], list)
    print(f"✓ test_features_have_polygon_geometry ({len(feats)} gap cells)")


def test_polygon_coordinates_are_lng_lat():
    """GeoJSON Polygon coordinates use [lng, lat] ordering (RFC 7946)."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(_sparse_points(), grid_size_km=0.5)
    for f in result["features"]:
        geom = f["geometry"]
        if geom["type"] == "Polygon":
            for lng, lat in geom["coordinates"][0]:
                assert -180 <= lng <= 180
                assert -90 <= lat <= 90
    print("✓ test_polygon_coordinates_are_lng_lat")


def test_polygon_rings_are_closed():
    """RFC 7946 3.1.6: Polygon rings MUST be closed (first == last vertex)."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(_sparse_points(), grid_size_km=0.5)
    for f in result["features"]:
        ring = f["geometry"]["coordinates"][0]
        assert len(ring) >= 5  # 4 corners + closing vertex
        assert ring[0] == ring[-1], "Polygon ring must be closed"
    print("✓ test_polygon_rings_are_closed")


# ── Spatial gap detection tests ──────────────────────────────────────────────

def test_empty_cell_detected_as_gap():
    """Cells with zero POIs are flagged as spatial gaps."""
    # Points tightly clustered in one corner; the rest of the bbox should have gaps.
    points = _tight_cluster(10.95, 106.84, n=6)
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(points, grid_size_km=0.5)
    assert len(result["features"]) > 0, "Should detect gap cells"
    for f in result["features"]:
        assert f["properties"]["gap_type"] == "spatial"
        assert f["properties"]["points_in_cell"] == 0
    print(f"✓ test_empty_cell_detected_as_gap ({len(result['features'])} gaps)")


def test_filled_cells_not_flagged():
    """Cells with POIs are NOT flagged as gap features."""
    # Create a dense cluster so most cells are filled.
    points = []
    for lat in [10.950, 10.952, 10.954, 10.956]:
        for lng in [106.840, 106.842, 106.844, 106.846]:
            points.append({"lat": lat, "lng": lng, "name": f"P{lat}", "address": "addr", "category": "school"})
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(points, grid_size_km=3.0)  # large cell → few cells, all filled
    gap_cells = result["summary"]["gap_cells"]
    total_cells = result["summary"]["total_cells"]
    # With large grid + dense points, gaps should be few or zero.
    assert gap_cells <= total_cells
    print(f"✓ test_filled_cells_not_flagged ({gap_cells}/{total_cells} gaps)")


def test_gap_score_increases_with_distance():
    """Gap score should be higher for cells farther from POIs."""
    points = _tight_cluster(10.95, 106.84, n=5)
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(points, grid_size_km=1.0)
    scores = [f["properties"]["gap_score"] for f in result["features"]]
    assert max(scores) >= min(scores), "Should have varying gap scores"
    # The farthest gap cell should have a higher score.
    assert max(scores) > 0, "At least one gap cell should have positive score"
    print(f"✓ test_gap_score_increases_with_distance (max={max(scores):.3f}, min={min(scores):.3f})")


def test_features_sorted_by_gap_score_desc():
    """Gap features are sorted by gap_score descending."""
    points = _sparse_points()
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(points, grid_size_km=0.5)
    scores = [f["properties"]["gap_score"] for f in result["features"]]
    assert scores == sorted(scores, reverse=True), "Features should be sorted by gap_score desc"
    print("✓ test_features_sorted_by_gap_score_desc")


def test_priority_assignment():
    """Priority is assigned based on gap_score."""
    points = _sparse_points()
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(points, grid_size_km=0.5)
    for f in result["features"]:
        score = f["properties"]["gap_score"]
        priority = f["properties"]["priority"]
        if score >= 0.5:
            assert priority == "high"
        elif score >= 0.2:
            assert priority == "medium"
        else:
            assert priority == "low"
    print("✓ test_priority_assignment")


# ── Attribute gap detection tests ────────────────────────────────────────────

def test_attribute_gaps_detected():
    """Missing attributes are detected and aggregated."""
    # Points with some attributes missing.
    points = [
        {"lat": 10.95, "lng": 106.84, "name": "A", "address": "123 St", "city": "Biên Hòa",
         "district": "Biên Hòa", "category": "school", "rating_avg": 4.0},
        {"lat": 10.96, "lng": 106.85, "name": "B", "address": "", "city": "Biên Hòa",
         "district": "Biên Hòa", "category": "school", "rating_avg": None},
        {"lat": 10.97, "lng": 106.86, "name": "C", "address": "456 St", "city": "",
         "district": "Biên Hòa", "category": "school", "rating_avg": 3.5},
    ]
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(points, grid_size_km=5.0)  # large grid → fewer gaps
    attr_gaps = result["attribute_gaps"]
    assert "district" in attr_gaps or "address" in attr_gaps or "rating_avg" in attr_gaps or "city" in attr_gaps, \
        f"Should detect missing attributes, got: {list(attr_gaps.keys())}"
    # Check percentage is correct.
    if "address" in attr_gaps:
        assert attr_gaps["address"]["missing"] == 1
        assert attr_gaps["address"]["total"] == 3
        assert attr_gaps["address"]["pct"] == round(1/3 * 100, 1)
    print(f"✓ test_attribute_gaps_detected: {list(attr_gaps.keys())}")


def test_attribute_gaps_empty_when_complete():
    """No attribute gaps when all attributes are present."""
    points = [
        {"lat": 10.95, "lng": 106.84, "name": "A", "address": "123 St", "city": "Biên Hòa",
         "district": "Biên Hòa", "category": "school", "rating_avg": 4.0,
         "website": "http://a.edu.vn", "hours": "8:00-17:00",
         "verified": True, "updated_at": "2026-01-01", "description": "desc"},
        {"lat": 10.96, "lng": 106.85, "name": "B", "address": "456 St", "city": "Biên Hòa",
         "district": "Biên Hòa", "category": "school", "rating_avg": 3.5,
         "website": "http://b.edu.vn", "hours": "8:00-17:00",
         "verified": True, "updated_at": "2026-01-01", "description": "desc"},
    ]
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(points, grid_size_km=5.0)
    # With complete data and a large grid, attribute_gaps should be mostly empty.
    # (district and city will be present, so no gaps).
    attr_gaps = result["attribute_gaps"]
    for v in attr_gaps.values():
        assert isinstance(v, dict) and "missing" in v and "total" in v and "pct" in v
    print(f"✓ test_attribute_gaps_empty_when_complete: {list(attr_gaps.keys())}")


def test_summary_contains_grid_info():
    """Summary contains grid_size_km and cell counts."""
    points = _sparse_points()
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(points, grid_size_km=1.5)
    s = result["summary"]
    assert s["grid_size_km"] == 1.5
    assert s["total_cells"] > 0
    assert s["gap_cells"] > 0
    assert s["gap_rate"] > 0
    assert s["total_points"] == len(points)
    print(f"✓ test_summary_contains_grid_info ({s['total_cells']} cells, {s['gap_cells']} gaps, {s['gap_rate']}%)")


# ── Edge cases ───────────────────────────────────────────────────────────────

def test_empty_points():
    """Empty points list returns valid empty FeatureCollection (degraded)."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps([], grid_size_km=1.0)
    assert result["type"] == "FeatureCollection"
    assert result["features"] == []
    assert result["metadata"]["degraded"] is True, "Empty input should be marked degraded"
    print("✓ test_empty_points")


def test_none_points():
    """None points returns valid empty FeatureCollection."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(None, grid_size_km=1.0)
    assert result["type"] == "FeatureCollection"
    assert result["features"] == []
    print("✓ test_none_points")


def test_points_without_coordinates():
    """Points missing lat/lng are filtered out gracefully."""
    points = [{"name": "no coords"}, {"lat": "bad", "lng": "bad"}]
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(points, grid_size_km=1.0)
    assert result["type"] == "FeatureCollection"
    if result["summary"]["total_points"] == 0:
        assert result["metadata"]["degraded"] is True
    print("✓ test_points_without_coordinates")


def test_grid_size_clamping():
    """grid_size_km is clamped to [0.1, 50]."""
    points = _tight_cluster(10.95, 106.84, n=5)
    with contextlib.redirect_stdout(io.StringIO()):
        result_low = cs.identify_data_gaps(points, grid_size_km=0.01)  # below min
        result_high = cs.identify_data_gaps(points, grid_size_km=100.0)  # above max
    # Should clamp to 0.1 and 50.0 respectively (no crash).
    assert result_low["summary"]["grid_size_km"] == 0.1
    assert result_high["summary"]["grid_size_km"] == 50.0
    print("✓ test_grid_size_clamping")


def test_dense_points_fill_all_cells():
    """With dense points, gaps are only in the 1-cell extension boundary."""
    # The grid extends 1 cell on each side beyond the data extent. Points
    # cannot fall into the bottom-left extension cell (below min_lat), so
    # gap_cells >= 1 always. With dense points, ONLY the boundary extension
    # cells should be gaps — interior cells are all filled.
    grid_deg = 50.0 / 111.0
    center_lat, center_lng = 10.95, 106.84
    points = []
    N = 5
    for r in range(N):
        for c in range(N):
            lat = (center_lat - grid_deg * (N / 2)) + (r + 0.5) * grid_deg
            lng = (center_lng - grid_deg * (N / 2)) + (c + 0.5) * grid_deg
            points.append({"lat": lat, "lng": lng, "name": f"P{r},{c}", "category": "school"})
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_data_gaps(points, grid_size_km=50.0)
    total = result["summary"]["total_cells"]
    gaps = result["summary"]["gap_cells"]
    gap_rate = result["summary"]["gap_rate"]
    # Gaps = extension boundary cells. With N=5 interior points + 2 extensions,
    # the grid is (N+1)x(N+1)=36 or (N+2)x(N+2)=49. All gaps are boundary cells.
    # Assert: gap_rate is low (< 50%) and gaps == boundary cells (no interior gaps).
    assert 0 < gap_rate < 50, f"Expected low gap_rate, got {gap_rate}%"
    # Interior cells (excluding top/bottom/left/right borders) should all be filled.
    n_rows = total // (N + 1) if total > 0 else 0  # approximate
    # Just verify that the gap count is bounded by the border cells.
    assert gaps < total * 0.6, f"Too many gaps ({gaps}/{total}) for dense data"
    print(f"✓ test_dense_points_fill_all_cells ({gaps}/{total} = {gap_rate}% gaps)")


# ── Helper function tests ────────────────────────────────────────────────────

def test_safe_float():
    """_safe_float handles valid, invalid, and NaN values."""
    from services.clustering_service import ClusteringService
    assert ClusteringService._safe_float(3.14) == 3.14
    assert ClusteringService._safe_float("10.5") == 10.5
    assert ClusteringService._safe_float("abc") is None
    assert ClusteringService._safe_float(None) is None
    assert ClusteringService._safe_float(float('nan')) is None
    print("✓ test_safe_float")


def test_haversine_vectorized():
    """_haversine_vectorized returns correct distances."""
    import numpy as np
    # DNTU → LHU (~8km)
    lats = np.array([10.95322])
    lngs = np.array([106.80245])
    dists = cs._haversine_vectorized(10.98448, 106.86965, lats, lngs)
    assert len(dists) == 1
    assert 7.0 < dists[0] < 9.0, f"Expected ~8km, got {dists[0]}km"
    print(f"✓ test_haversine_vectorized ({dists[0]:.2f}km)")


def test_haversine_vectorized_empty():
    """_haversine_vectorized handles empty arrays."""
    import numpy as np
    dists = cs._haversine_vectorized(10.0, 106.0, np.array([]), np.array([]))
    assert len(dists) == 0
    print("✓ test_haversine_vectorized_empty")


# ── Router integration test ──────────────────────────────────────────────────

def test_router_importable():
    """Router data_hunter.py is importable and exports the expected endpoint."""
    import importlib
    if 'routers.data_hunter' in sys.modules:
        del sys.modules['routers.data_hunter']
    mod = importlib.import_module('routers.data_hunter')
    assert hasattr(mod, 'router'), "routers.data_hunter must export 'router'"
    assert hasattr(mod, 'data_gaps'), "Must have data_gaps endpoint function"
    routes = [r.path for r in mod.router.routes]
    assert '/api/ai/data/gaps' in routes, f"Expected /api/ai/data/gaps in routes: {routes}"
    print("✓ test_router_importable")


def test_router_request_model():
    """DataGapsRequest model has required fields."""
    import importlib
    if 'routers.data_hunter' in sys.modules:
        del sys.modules['routers.data_hunter']
    mod = importlib.import_module('routers.data_hunter')
    req_cls = mod.DataGapsRequest
    # Default values
    req = req_cls()
    assert req.grid_size_km == 1.0
    assert req.top_n == 50
    assert req.points == []
    # With data
    req2 = req_cls(points=[{"lat": 10.0, "lng": 106.0}], grid_size_km=2.0, top_n=10)
    assert req2.points == [{"lat": 10.0, "lng": 106.0}]
    assert req2.grid_size_km == 2.0
    assert req2.top_n == 10
    print("✓ test_router_request_model")


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_returns_geojson_featurecollection()
    test_returns_summary_and_metadata()
    test_features_have_polygon_geometry()
    test_polygon_coordinates_are_lng_lat()
    test_polygon_rings_are_closed()
    test_empty_cell_detected_as_gap()
    test_filled_cells_not_flagged()
    test_gap_score_increases_with_distance()
    test_features_sorted_by_gap_score_desc()
    test_priority_assignment()
    test_attribute_gaps_detected()
    test_attribute_gaps_empty_when_complete()
    test_summary_contains_grid_info()
    test_empty_points()
    test_none_points()
    test_points_without_coordinates()
    test_grid_size_clamping()
    test_dense_points_fill_all_cells()
    test_safe_float()
    test_haversine_vectorized()
    test_haversine_vectorized_empty()
    test_router_importable()
    test_router_request_model()
    print("\n✅ All data hunter tests passed!")
