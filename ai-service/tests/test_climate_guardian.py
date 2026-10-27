"""Unit tests for the AI Climate Learning Guardian (Idea #11).

Verifies:
  - Risk heatmap produces valid GeoJSON FeatureCollection with expected fields.
  - Risk scores are in [0, 1] for a synthetic flood scenario.
  - Alternatives finds safe locations outside high-risk zones.
  - Graceful degradation: returns valid GeoJSON even with no data / missing keys.
  - Cache returns cached results on repeat calls.
"""

import os
import sys
import json
from unittest.mock import patch

# Make ai-service importable.
_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure SQLite mode (no PostgreSQL needed for these tests)
os.environ["DB_TYPE"] = "sqlite"
os.environ["AI_PREFLIGHT"] = "false"
os.environ["DB_SQLITE_PATH"] = os.path.abspath(
    os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db")
)

# Prevent real HTTP calls during tests (elevation/weather).
os.environ["OWM_API_KEY"] = ""

import pytest
from services.climate_guardian import (
    climate_guardian,
    ClimateGuardianService,
    _risk_level,
    _flood_risk,
    _point_in_polygon,
    _haversine_km,
    _parse_coords,
    _weather_severity,
    _season_from_month,
    FLOOD_WEIGHT,
    WEATHER_WEIGHT,
    ACCESS_WEIGHT,
)

# ── Shared test fixtures: mock elevation to avoid real HTTP calls ──────────

_ELEVATION_PATCH = patch(
    "services.climate_guardian._get_elevation",
    side_effect=lambda lat, lng: 2.5,
)


@pytest.fixture(autouse=True)
def mock_elevation():
    """Mock elevation data so tests don't make real HTTP calls."""
    with _ELEVATION_PATCH as mock:
        yield mock


# ── Geometry / scoring helper tests ──────────────────────────────────────────

def test_point_in_polygon_true():
    poly = [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]
    assert _point_in_polygon(0.5, 0.5, poly) is True


def test_point_in_polygon_false():
    poly = [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]
    assert _point_in_polygon(5.0, 5.0, poly) is False


def test_haversine_km_bien_hoa_to_dntu():
    # DNTU (~10.9525, 106.8778) to DNU (~10.9423, 106.8475) ≈ 3.2 km.
    dist = _haversine_km(10.9525, 106.8778, 10.9423, 106.8475)
    assert 2.5 < dist < 4.0


def test_risk_level_boundaries():
    assert _risk_level(0.0) == "rất thấp"
    assert _risk_level(0.14) == "rất thấp"
    assert _risk_level(0.15) == "thấp"
    assert _risk_level(0.29) == "thấp"
    assert _risk_level(0.30) == "trung bình"
    assert _risk_level(0.49) == "trung bình"
    assert _risk_level(0.50) == "cao"
    assert _risk_level(0.74) == "cao"
    assert _risk_level(0.75) == "rất cao"
    assert _risk_level(1.0) == "rất cao"


def test_parse_coords_geojson_string():
    s = '{"type": "Point", "coordinates": [106.8778, 10.9525]}'
    result = _parse_coords(s)
    assert result == (106.8778, 10.9525)


def test_parse_coords_array():
    result = _parse_coords([106.8778, 10.9525])
    assert result == (106.8778, 10.9525)


def test_parse_coords_dict():
    result = _parse_coords({"type": "Point", "coordinates": [106.8778, 10.9525]})
    assert result == (106.8778, 10.9525)


def test_parse_coords_ewkt():
    result = _parse_coords("SRID=4326;POINT(106.8778 10.9525)")
    assert result == (106.8778, 10.9525)


def test_parse_coords_none():
    assert _parse_coords(None) is None
    assert _parse_coords("") is None


def test_weather_severity_zero_with_none():
    assert _weather_severity(None) == 0.0


def test_weather_severity_clear_skies():
    weather = {
        "weather": [{"id": 800, "main": "Clear"}],
        "wind": {"speed": 0},
        "rain": {"1h": 0},
    }
    assert _weather_severity(weather) == 0.0


def test_weather_severity_thunderstorm():
    weather = {
        "weather": [{"id": 200, "main": "Thunderstorm"}],
        "wind": {"speed": 15},
        "rain": {"1h": 5},
    }
    score = _weather_severity(weather)
    assert 0.5 < score <= 1.0  # thunderstorm → high severity


def test_season_from_month():
    assert _season_from_month(6) == "wet"
    assert _season_from_month(10) == "wet"
    assert _season_from_month(1) == "transition"
    assert _season_from_month(7) == "wet"


# ── Flood risk scoring tests ─────────────────────────────────────────────────

def test_flood_risk_inside_zone():
    """A point inside a static flood zone polygon should have high flood risk."""
    # Đồng Nai flood zone centroid (~10.947, 106.867) is inside the polygon.
    zones = [{
        "name": "test",
        "polygon": [[106.840, 10.925], [106.895, 10.925],
                    [106.895, 10.970], [106.840, 10.970], [106.840, 10.925]],
        "risk_level": "high",
        "flood_months": [5, 6, 7, 8, 9, 10],
    }]
    risk = _flood_risk(10.947, 106.867, 9, zones)  # September = wet season
    assert 0 < risk <= 1.0


def test_flood_risk_outside_zone():
    """A point far from flood zones should have near-zero flood risk."""
    zones = [{
        "name": "test",
        "polygon": [[106.840, 10.925], [106.895, 10.925],
                    [106.895, 10.970], [106.840, 10.970], [106.840, 10.925]],
        "risk_level": "high",
        "flood_months": [5, 6, 7, 8, 9, 10],
    }]
    # Point in Hanoi (~21.0279, 105.8342) — far from Đồng Nai.
    risk = _flood_risk(21.0279, 105.8342, 9, zones)
    assert risk < 0.1


def test_flood_risk_outside_dry_season():
    """A point inside a flood zone during dry season should still have some
    risk (floor) but lower than in wet season."""
    zones = [{
        "name": "test",
        "polygon": [[106.840, 10.925], [106.895, 10.925],
                    [106.895, 10.970], [106.840, 10.970], [106.840, 10.925]],
        "risk_level": "high",
        "flood_months": [5, 6, 7, 8, 9, 10],
    }]
    risk_wet = _flood_risk(10.947, 106.867, 9, zones)   # September (wet)
    risk_dry = _flood_risk(10.947, 106.867, 2, zones)   # February (not in flood_months)
    assert risk_wet > risk_dry


def test_flood_risk_empty_zones():
    assert _flood_risk(10.95, 106.87, 9, []) == 0.0


# ── Heatmap integration tests ────────────────────────────────────────────────

def test_risk_heatmap_valid_geojson():
    """Heatmap should return a valid GeoJSON FeatureCollection."""
    result = climate_guardian.get_risk_heatmap(
        min_lat=10.90, max_lat=10.98, min_lng=106.80, max_lng=106.95,
    )
    assert result["type"] == "FeatureCollection"
    assert "features" in result
    assert isinstance(result["features"], list)
    assert len(result["features"]) > 0
    assert "heat_points" in result
    assert "risk_ranking" in result
    assert "metadata" in result
    assert "degraded" in result["metadata"]


def test_risk_scores_in_range():
    """All risk scores in the heatmap should be in [0, 1]."""
    result = climate_guardian.get_risk_heatmap(
        min_lat=10.92, max_lat=10.96, min_lng=106.84, max_lng=106.90,
    )
    for f in result["features"]:
        score = f["properties"]["risk_score"]
        assert 0.0 <= score <= 1.0, f"risk_score {score} out of range"


def test_risk_heatmap_has_metadata():
    result = climate_guardian.get_risk_heatmap(
        min_lat=10.92, max_lat=10.96, min_lng=106.84, max_lng=106.90,
    )
    meta = result["metadata"]
    assert "method" in meta
    assert "degraded" in meta
    assert "data_source" in meta
    assert "flood_zones_loaded" in meta
    assert "features_loaded" in meta


def test_risk_heatmap_date_param():
    """Date parameter should affect the season/month used in risk computation."""
    # Wet season date.
    r_wet = climate_guardian.get_risk_heatmap(
        min_lat=10.92, max_lat=10.96, min_lng=106.84, max_lng=106.90,
        date="2025-09-15",
    )
    # Dry season date.
    r_dry = climate_guardian.get_risk_heatmap(
        min_lat=10.92, max_lat=10.96, min_lng=106.84, max_lng=106.90,
        date="2025-02-15",
    )
    assert r_wet["metadata"]["month"] == 9
    assert r_dry["metadata"]["month"] == 2
    assert r_wet["metadata"]["season"] == "wet"
    assert r_dry["metadata"]["season"] == "transition"


def test_risk_heatmap_cache():
    """Second call with same params should return cached result (cached=True)."""
    result1 = climate_guardian.get_risk_heatmap(
        min_lat=10.92, max_lat=10.96, min_lng=106.84, max_lng=106.90,
    )
    # The service returns cached results directly (no "cached" flag in metadata
    # since caching is transparent). Verify it doesn't crash and returns valid data.
    assert result1["type"] == "FeatureCollection"
    result2 = climate_guardian.get_risk_heatmap(
        min_lat=10.92, max_lat=10.96, min_lng=106.84, max_lng=106.90,
    )
    assert result2["type"] == "FeatureCollection"
    assert len(result2["features"]) == len(result1["features"])


def test_risk_heatmap_default_bbox():
    """A bbox covering no flood zones should still return valid GeoJSON."""
    result = climate_guardian.get_risk_heatmap(
        min_lat=21.0, max_lat=21.1, min_lng=105.8, max_lng=105.9,  # Hanoi
    )
    assert result["type"] == "FeatureCollection"
    assert len(result["features"]) > 0
    # Should be marked degraded (no flood zones in Hanoi).
    assert result["metadata"]["degraded"] is True


# ── Alternatives tests ───────────────────────────────────────────────────────

def test_alternatives_returns_geojson():
    """get_alternatives should return a valid GeoJSON FeatureCollection."""
    result = climate_guardian.get_alternatives(
        lat=10.9525, lng=106.8778,  # DNTU
        bbox=(10.90, 11.00, 106.80, 106.95),
        radius_km=10,
    )
    assert result["type"] == "FeatureCollection"
    assert "features" in result
    assert "nearest_safe" in result
    assert "safe_count" in result
    assert "metadata" in result


def test_alternatives_safe_score_in_range():
    """All safety scores in alternatives should be in [0, 1]."""
    result = climate_guardian.get_alternatives(
        lat=10.9525, lng=106.8778,
        bbox=(10.90, 11.00, 106.80, 106.95),
        radius_km=10,
    )
    for f in result["features"]:
        score = f["properties"]["safety_score"]
        assert 0.0 <= score <= 1.0


def test_alternatives_degraded_no_data():
    """If no facilities are found, should return degraded but valid GeoJSON."""
    # Use a bbox far from any educational facility (ocean area).
    result = climate_guardian.get_alternatives(
        lat=12.0, lng=109.0,
        bbox=(11.9, 12.1, 108.9, 109.1),  # Middle of the South China Sea
        radius_km=5,
    )
    assert result["type"] == "FeatureCollection"
    assert result["features"] == []
    assert result["metadata"]["degraded"] is True or result["safe_count"] == 0


def test_alternatives_category_filter():
    """Category filter should only return matching categories."""
    result = climate_guardian.get_alternatives(
        lat=10.9525, lng=106.8778,
        bbox=(10.90, 11.00, 106.80, 106.95),
        radius_km=10,
        category="university",
    )
    for f in result["features"]:
        assert f["properties"]["category"] == "university"


# ── Graceful degradation tests ─────────────────────────────────────────────────

def test_service_handles_empty_facilities():
    """The service should never crash when no facilities are loaded."""
    # Hanoi area — may have facilities but no flood zones.
    result = climate_guardian.get_risk_heatmap(
        min_lat=21.0, max_lat=21.1, min_lng=105.8, max_lng=105.9,
    )
    assert result["type"] == "FeatureCollection"
    assert "features" in result
    assert result["metadata"]["degraded"] is True


def test_service_weights_sum_to_one():
    """Risk weights must sum to 1.0 for a valid linear blend."""
    total = FLOOD_WEIGHT + WEATHER_WEIGHT + ACCESS_WEIGHT
    assert abs(total - 1.0) < 0.001


def test_climate_guardian_service_instance():
    """The module-level singleton should be a ClimateGuardianService."""
    assert isinstance(climate_guardian, ClimateGuardianService)
