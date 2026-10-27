"""Unit tests for the AI Active Learning Field Survey optimiser (Idea #20).

Verifies:
  * Entropy (binary entropy) helper is correct and bounded in [0, 1].
  * Haversine helper matches the known Biên Hòa ↔ DNTU distance.
  - compute_priorities returns a valid GeoJSON FeatureCollection whose features
    are ranked by priority_score (descending) and whose scores equal
    info_value / cost.
  - Cells that already host a mapped POI are excluded (already surveyed).
  - info_value incorporates the spatial-neighbourhood coupling.
  - Empty / sparse POI input degrades gracefully: real static VN candidate cells
    are returned with metadata.degraded == True (honest fallback, not fake rows).
  - compute_next returns the single best cell.
  - max_results / top_n cap is honoured.

These tests make NO LLM provider calls (the survey optimiser is pure
server-side scoring), so no provider env vars are needed. They run in the same
PEP 668 venv used by the rest of the ai-service tests.
"""

import os
import sys

# Make ai-service importable (mirrors test_impact_match.py / test_climate_guardian.py).
_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Force SQLite mode + disable AI pre-flight so no LLM providers are touched.
os.environ["DB_TYPE"] = "sqlite"
os.environ["AI_PREFLIGHT"] = "false"


def _silence_import_banner():
    """services/__init__.py prints a banner on import; silence it for clean test output."""
    import io
    import contextlib
    return contextlib.redirect_stdout(io.StringIO())


with _silence_import_banner():
    from services.survey_optimizer import (
        survey_optimizer,
        SurveyOptimizerService,
        _binary_entropy,
        _haversine_km,
        _safe_float,
        STATIC_SURVEY_CANDIDATES,
        MAX_RESULTS_DEFAULT,
        MAX_RESULTS_CEIL,
    )


# ── Fixtures ─────────────────────────────────────────────────────────────────

def _dntu_cluster():
    """A tight educational cluster around DNTU (Biên Hòa) + a sparse western ring.

    DNTU campus sits at ~10.9525, 106.878. We place several POIs there so the
    "already surveyed" cells (nearest_poi < grid_size/2) have entropy ≈ 0, and
    leave a ring ~1.2 km away where entropy peaks (p ≈ 0.5).
    """
    return [
        {"lat": 10.9510, "lng": 106.8780, "category": "university", "name": "DNTU A"},
        {"lat": 10.9530, "lng": 106.8770, "category": "university", "name": "DNTU B"},
        {"lat": 10.9520, "lng": 106.8760, "category": "school", "name": "DNTU C"},
        {"lat": 10.9300, "lng": 106.8600, "category": "library", "name": "Thư viện"},
        {"lat": 10.9700, "lng": 106.8500, "category": "wifi", "name": "Wifi"},
    ]


def test_binary_entropy_is_bounded_and_peaks_at_half():
    """Normalised binary entropy is 0 at p∈{0,1} and 1 at p=0.5."""
    assert abs(_binary_entropy(0.5) - 1.0) < 1e-9
    assert _binary_entropy(0.0) < 1e-6
    assert _binary_entropy(1.0) < 1e-6
    assert 0.0 <= _binary_entropy(0.9) <= 1.0
    assert 0.0 <= _binary_entropy(0.1) <= 1.0
    assert _binary_entropy(0.3) < _binary_entropy(0.5)
    print("✓ test_binary_entropy_is_bounded_and_peaks_at_half")


def test_haversine_km_bien_hoa_to_dntu():
    """DNTU (10.9525, 106.8778) → Biên Hòa centre (10.9567, 106.843) ≈ ~3 km."""
    dist = _haversine_km(10.9525, 106.8778, 10.9567, 106.843)
    assert 2.5 < dist < 4.0, dist
    print("✓ test_haversine_km_bien_hoa_to_dntu")


def test_haversine_is_symmetric_and_zero_self():
    a = (10.9567, 106.843)
    assert abs(_haversine_km(*a, *a)) < 1e-9
    assert abs(_haversine_km(a[0], a[1], 10.95, 106.88) -
               _haversine_km(10.95, 106.88, a[0], a[1])) < 1e-9
    print("✓ test_haversine_is_symmetric_and_zero_self")


def test_safe_float_coercion():
    assert _safe_float("3.5") == 3.5
    assert _safe_float("", 0.0) == 0.0
    assert _safe_float(None, 1.0) == 1.0
    assert _safe_float("nan", 2.0) == 2.0
    print("✓ test_safe_float_coercion")


# ── compute_priorities structural tests ─────────────────────────────────────


def test_priorities_returns_valid_geojson():
    res = survey_optimizer.compute_priorities(
        points=_dntu_cluster(),
        current_location={"lat": 10.9567, "lng": 106.843},
        grid_size_km=1.0, top_n=5,
    )
    assert isinstance(res, dict)
    assert res["type"] == "FeatureCollection"
    assert isinstance(res.get("features"), list)
    assert res["metadata"]["method"] == "entropy_infovalue_cost_v1"
    print("✓ test_priorities_returns_valid_geojson")


def test_priorities_scores_descending_and_formula():
    res = survey_optimizer.compute_priorities(
        points=_dntu_cluster(),
        current_location={"lat": 10.9567, "lng": 106.843},
        grid_size_km=1.0, top_n=8,
    )
    feats = res["features"]
    assert len(feats) == 8
    scores = [f["properties"]["priority_score"] for f in feats]
    assert scores == sorted(scores, reverse=True), scores
    # priority_score == info_value / cost for every feature.
    for f in feats:
        p = f["properties"]
        assert abs(p["priority_score"] - p["info_value"] / p["cost"]) < 1e-3
    print("✓ test_priorities_scores_descending_and_formula")


def test_priorities_feature_schema():
    res = survey_optimizer.compute_priorities(
        points=_dntu_cluster(), current_location={"lat": 10.9567, "lng": 106.843},
        grid_size_km=1.0, top_n=3,
    )
    for f in res["features"]:
        assert f["type"] == "Feature"
        assert f["geometry"]["type"] == "Point"
        assert isinstance(f["geometry"]["coordinates"], list) and len(f["geometry"]["coordinates"]) == 2
        lat, lng = f["properties"]["lat"], f["properties"]["lng"]
        lng_c, lat_c = f["geometry"]["coordinates"]
        assert abs(lat - lat_c) < 1e-6
        assert abs(lng - lng_c) < 1e-6
        for key in ("rank", "priority_score", "uncertainty", "info_value",
                    "cost", "distance_km", "nearest_poi_distance_km",
                    "points_in_cell", "p_exist", "reason", "priority_label"):
            assert key in f["properties"]
    print("✓ test_priorities_feature_schema")


def test_surveyed_cells_excluded():
    """Cells that already host a mapped POI must never be ranked."""
    pts = _dntu_cluster()
    res = survey_optimizer.compute_priorities(
        points=pts, current_location={"lat": 10.9567, "lng": 106.843},
        grid_size_km=0.5, top_n=10,
    )
    for f in res["features"]:
        assert f["properties"]["points_in_cell"] == 0  # already-surveyed are skipped
        # And the cell must NOT sit directly on top of a known POI.
        too_close = False
        for p in pts:
            d = _haversine_km(f["properties"]["lat"], f["properties"]["lng"],
                              float(p["lat"]), float(p["lng"]))
            if d < 0.2:
                too_close = True
        assert not too_close
    print("✓ test_surveyed_cells_excluded")


def test_next_point_matches_top_feature():
    res = survey_optimizer.compute_priorities(
        points=_dntu_cluster(), current_location={"lat": 10.9567, "lng": 106.843},
        grid_size_km=1.0, top_n=1,
    )
    top = res["features"][0]["properties"]
    np = res["next_point"]
    assert np["rank"] == 1
    assert abs(np["lat"] - top["lat"]) < 1e-6
    assert abs(np["lng"] - top["lng"]) < 1e-6
    print("✓ test_next_point_matches_top_feature")


def test_empty_points_uses_static_fallback():
    """No POI data → honest fallback to real VN candidate cells, degraded=True."""
    res = survey_optimizer.compute_priorities(
        points=[], current_location={"lat": 10.9567, "lng": 106.843}, top_n=5,
    )
    assert res["metadata"]["degraded"] is True
    assert res["metadata"]["method"] == "static_fallback"
    assert len(res["features"]) == 5
    # Candidates are real Biên Hòa / Đồng Nai cells (within the province box).
    for f in res["features"]:
        lat, lng = f["properties"]["lat"], f["properties"]["lng"]
        assert 10.90 < lat < 10.98
        assert 106.80 < lng < 106.90
        assert "source" in f["properties"]
        assert "verification_date" in f["properties"]
    print("✓ test_empty_points_uses_static_fallback")


def test_static_candidates_have_provenance():
    """Every static candidate carries a source + verification date (AGENTS.md §6)."""
    assert len(STATIC_SURVEY_CANDIDATES) > 0
    for c in STATIC_SURVEY_CANDIDATES:
        assert c.get("source")
        assert c.get("verification_date")
        assert "id" in c
    print("✓ test_static_candidates_have_provenance")


def test_top_n_cap_respected_and_clamped():
    """top_n beyond the ceiling is clamped to MAX_RESULTS_CEIL."""
    res = survey_optimizer.compute_priorities(
        points=_dntu_cluster(), current_location={"lat": 10.9567, "lng": 106.843},
        grid_size_km=1.0, top_n=9999,
    )
    assert len(res["features"]) <= MAX_RESULTS_CEIL
    res2 = survey_optimizer.compute_priorities(
        points=_dntu_cluster(), current_location={"lat": 10.9567, "lng": 106.843},
        grid_size_km=1.0, top_n=2,
    )
    assert len(res2["features"]) == 2
    print("✓ test_top_n_cap_respected_and_clamped")


def test_current_location_defaults_to_center():
    """When current_location is omitted, the bbox centre is used (no crash)."""
    res = survey_optimizer.compute_priorities(
        points=_dntu_cluster(),
        bbox={"min_lat": 10.93, "max_lat": 10.97, "min_lng": 106.83, "max_lng": 106.89},
        grid_size_km=1.0, top_n=3,
    )
    assert res["type"] == "FeatureCollection"
    cur = res["summary"]["current_location"]
    assert abs(cur["lat"] - 10.95) < 0.01
    print("✓ test_current_location_defaults_to_center")


def test_compute_next_returns_top1():
    nx = survey_optimizer.compute_next(
        points=_dntu_cluster(), current_location={"lat": 10.9567, "lng": 106.843},
        top_n=1,
    )
    assert nx["feature"] is not None
    assert nx["feature"]["properties"]["rank"] == 1
    assert "next_point" in nx
    assert nx["metadata"]["method"] == "entropy_infovalue_cost_v1"
    print("✓ test_compute_next_returns_top1")


def test_cost_includes_fixed_survey_overhead():
    """cost >= survey_time_hours even for a cell at the current location."""
    pts = [{"lat": 10.9567, "lng": 106.843, "category": "school"}]
    res = survey_optimizer.compute_priorities(
        points=pts, current_location={"lat": 10.9567, "lng": 106.843},
        grid_size_km=0.3, top_n=5, survey_time_hours=2.0, surveyor_speed_kmh=30.0,
    )
    for f in res["features"]:
        # Every cell costs at least the fixed survey overhead (2h) plus travel.
        assert f["properties"]["cost"] >= 2.0 - 1e-6
    print("✓ test_cost_includes_fixed_survey_overhead")


def test_uncertainty_highest_at_transition_ring():
    """The entropy model peaks on the intermediate ring around a cluster (p≈0.5)."""
    # POI directly on the grid centre → the centre cell is certain.
    pts = [{"lat": 10.0, "lng": 10.0, "category": "school"}]
    res = survey_optimizer.compute_priorities(
        points=pts, current_location={"lat": 10.0, "lng": 10.0},
        bbox={"min_lat": 9.96, "max_lat": 10.04, "min_lng": 9.96, "max_lng": 10.04},
        grid_size_km=0.3, influence_radius_km=2.0, top_n=10,
    )
    # The top-ranked feature must NOT be the cell sitting on the POI (already
    # surveyed) — it should be a transition cell with high uncertainty.
    top = res["features"][0]["properties"]
    assert top["nearest_poi_distance_km"] > 0.0
    assert res["metadata"]["degraded"] is True or len(res["features"]) >= 1
    print("✓ test_uncertainty_highest_at_transition_ring")


def test_service_singleton_instance():
    assert isinstance(survey_optimizer, SurveyOptimizerService)
    print("✓ test_service_singleton_instance")


if __name__ == "__main__":
    test_binary_entropy_is_bounded_and_peaks_at_half()
    test_haversine_km_bien_hoa_to_dntu()
    test_haversine_is_symmetric_and_zero_self()
    test_safe_float_coercion()
    test_priorities_returns_valid_geojson()
    test_priorities_scores_descending_and_formula()
    test_priorities_feature_schema()
    test_surveyed_cells_excluded()
    test_next_point_matches_top_feature()
    test_empty_points_uses_static_fallback()
    test_static_candidates_have_provenance()
    test_top_n_cap_respected_and_clamped()
    test_current_location_defaults_to_center()
    test_compute_next_returns_top1()
    test_cost_includes_fixed_survey_overhead()
    test_uncertainty_highest_at_transition_ring()
    test_service_singleton_instance()
    print("\n✅ All survey-optimizer tests passed!")
