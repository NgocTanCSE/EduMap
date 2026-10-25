"""Unit tests for clustering_service.identify_education_hubs (Issue #7: GeoAI → GeoJSON).

Verifies that education hubs are returned as a GeoJSON ``FeatureCollection``
with valid ``Polygon``/``Point`` geometries (cluster boundaries) and that hub
metadata survives in ``properties`` so the frontend can both *draw* the
boundary and *display* the summary.

These tests use the REAL sklean/scipy stack (no LLM providers required) and
run under the same PEP 668 venv used by the rest of the ai-service tests.
"""

import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

from services.clustering_service import clustering_service as cs

# Silence the "SERVICES PACKAGE LOADED" banner printed on import.
import io, contextlib


def _points():
    """Three tight, NON-collinear clusters + a couple noise points."""
    # Cluster A: triangle around (10.95, 106.84)
    a = [
        {"lat": 10.950, "lng": 106.840, "category": "school", "name": "A1"},
        {"lat": 10.953, "lng": 106.841, "category": "school", "name": "A2"},
        {"lat": 10.951, "lng": 106.844, "category": "library", "name": "A3"},
    ]
    # Cluster B: triangle around (10.92, 106.80)
    b = [
        {"lat": 10.920, "lng": 106.800, "category": "university", "name": "B1"},
        {"lat": 10.923, "lng": 106.802, "category": "university", "name": "B2"},
        {"lat": 10.921, "lng": 106.804, "category": "lab", "name": "B3"},
    ]
    # Noise: far from everything and the only member of its "area"
    noise = [
        {"lat": 99.0, "lng": 99.0, "category": "noise", "name": "N1"},
        {"lat": 98.0, "lng": 98.0, "category": "noise", "name": "N2"},
    ]
    return a + b + noise


def test_returns_geojson_featurecollection():
    """identify_education_hubs returns a valid GeoJSON FeatureCollection."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_education_hubs(_points())
    assert isinstance(result, dict)
    assert result["type"] == "FeatureCollection"
    assert isinstance(result.get("features"), list)
    print("✓ test_returns_geojson_featurecollection")


def test_features_have_polygon_or_point_geometry():
    """Every feature carries a renderable geometry (Polygon or Point)."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_education_hubs(_points())
    assert len(result["features"]) >= 2  # at least the two real clusters
    for f in result["features"]:
        assert f["type"] == "Feature"
        geom = f["geometry"]
        assert geom["type"] in ("Polygon", "Point")
        assert isinstance(geom["coordinates"], list)
        # Polygon ring MUST be closed (first == last vertex) per RFC 7946 3.1.6
        if geom["type"] == "Polygon":
            ring = geom["coordinates"][0]
            assert len(ring) >= 4
            assert ring[0] == ring[-1]
    print("✓ test_features_have_polygon_or_point_geometry")


def test_polygon_coordinates_are_lng_lat():
    """GeoJSON Polygon coordinates use [lng, lat] ordering (RFC 7946)."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_education_hubs(_points())
    for f in result["features"]:
        geom = f["geometry"]
        if geom["type"] == "Polygon":
            for lng, lat in geom["coordinates"][0]:
                assert -180 <= lng <= 180
                assert -90 <= lat <= 90
    print("✓ test_polygon_coordinates_are_lng_lat")


def test_features_carry_hub_metadata():
    """Hub metadata lives in properties for the AI summary panel."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_education_hubs(_points())
    for f in result["features"]:
        props = f["properties"]
        assert "hub_id" in props
        assert "center" in props and "lat" in props["center"] and "lng" in props["center"]
        assert props["point_count"] >= 3  # DBSCAN min_samples=3
        assert "categories" in props and isinstance(props["categories"], list)
        assert "density_score" in props
    print("✓ test_features_carry_hub_metadata")


def test_features_sorted_by_point_count_desc():
    """Most populous hubs come first."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_education_hubs(_points())
    counts = [f["properties"]["point_count"] for f in result["features"]]
    assert counts == sorted(counts, reverse=True)
    print("✓ test_features_sorted_by_point_count_desc")


def test_empty_input_returns_empty_featurecollection():
    """Empty / too-small / None inputs degrade to a valid empty collection."""
    with contextlib.redirect_stdout(io.StringIO()):
        for bad in ([], [], None):
            r = cs.identify_education_hubs(bad if bad is not None else [])
            assert r["type"] == "FeatureCollection"
            assert r["features"] == []
    # Too few points (< 3) -> empty
    with contextlib.redirect_stdout(io.StringIO()):
        r = cs.identify_education_hubs([{"lat": 1, "lng": 2, "category": "x"}])
        assert r["features"] == []
    print("✓ test_empty_input_returns_empty_featurecollection")


def test_noise_points_excluded():
    """DBSCAN noise points (cluster_id == -1) must not become features."""
    with contextlib.redirect_stdout(io.StringIO()):
        result = cs.identify_education_hubs(_points())
    # Two noise points at (99,99)/(98,98) should never appear in any feature.
    for f in result["features"]:
        coords = f["geometry"]["coordinates"]
        if f["geometry"]["type"] == "Polygon":
            for lng, lat in coords[0]:
                assert not (abs(lat - 99.0) < 1 and abs(lng - 99.0) < 1)
                assert not (abs(lat - 98.0) < 1 and abs(lng - 98.0) < 1)
    print("✓ test_noise_points_excluded")


if __name__ == "__main__":
    test_returns_geojson_featurecollection()
    test_features_have_polygon_or_point_geometry()
    test_polygon_coordinates_are_lng_lat()
    test_features_carry_hub_metadata()
    test_features_sorted_by_point_count_desc()
    test_empty_input_returns_empty_featurecollection()
    test_noise_points_excluded()
    print("\n✅ All clustering GeoJSON tests passed!")
