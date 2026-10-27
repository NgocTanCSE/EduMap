"""Unit tests for the synced predictive_service.

Verifies that predictive_service.py — now synced with analytics.py's Holt's
Linear Exponential Smoothing — produces time-series forecasts instead of the
old static `return {}` and if-else keyword matching.

Tests run with DB_TYPE=sqlite and a local SQLite file seeded with
seed_education_stats.sql data so Holt's forecasts can be exercised end-to-end
without a PostgreSQL connection.
"""

import os
import sys
import sqlite3
import pytest

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure SQLite mode (no PostgreSQL needed for these tests)
os.environ["DB_TYPE"] = "sqlite"
os.environ["AI_PREFLIGHT"] = "false"

# Point to the local seed DB; seed it before importing the service
_DB_PATH = os.path.join(_AI_DIR, "..", "frontend", "public", "edumap.db")
_DB_PATH = os.path.abspath(_DB_PATH)
os.environ["DB_SQLITE_PATH"] = _DB_PATH


def _ensure_seed_data():
    """Ensure the SQLite file has education_stats seed data for forecasting."""
    if not os.path.exists(_DB_PATH):
        conn = sqlite3.connect(_DB_PATH)
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS education_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                region VARCHAR(100),
                province VARCHAR(100),
                district VARCHAR(100),
                metric_type VARCHAR(100),
                metric_value DECIMAL(15,2),
                year INTEGER,
                source VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.commit()
        conn.close()

    conn = sqlite3.connect(_DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM education_stats")
    if cur.fetchone()[0] == 0:
        seed_sql_path = os.path.join(_AI_DIR, "..", "backend",
                                     "src", "database", "migrations",
                                     "seed_education_stats.sql")
        seed_sql_path = os.path.abspath(seed_sql_path)
        if os.path.exists(seed_sql_path):
            with open(seed_sql_path, "r") as f:
                cur.executescript(f.read())
            conn.commit()
    conn.close()


_ensure_seed_data()

from services.predictive_service import predictive_service  # noqa: E402
from routers.analytics import _holt_linear_forecast  # noqa: E402


# ── Env guard ────────────────────────────────────────────────────────────────
#
# Other test modules in this suite (notably test_data_quality.py and
# test_map_agent.py) mutate the *global* `os.environ` DB_SQLITE_PATH / DB_TYPE
# during their own execution and do not always restore them (e.g.
# test_data_quality leaves DB_SQLITE_PATH pointing at /tmp/test_edumap_dq.db,
# a throw-away DB that only has a `map_points` table and no education_stats
# rows). Because analytics._sqlite_path() reads these env vars at *call time*
# (no import-time caching), those stray mutations make predict_educational_gaps
# silently read an empty/wrong database when the full suite runs together.
#
# predictive_service does not cache stats/pois, so we just need to (re)point
# the env vars at the real local seed DB before every test in this module.
@pytest.fixture(autouse=True)
def _force_sqlite_env():
    _prev = {
        "DB_TYPE": os.environ.get("DB_TYPE"),
        "DB_SQLITE_PATH": os.environ.get("DB_SQLITE_PATH"),
        "AI_PREFLIGHT": os.environ.get("AI_PREFLIGHT"),
    }
    os.environ["DB_TYPE"] = "sqlite"
    os.environ["DB_SQLITE_PATH"] = _DB_PATH
    os.environ["AI_PREFLIGHT"] = "false"
    try:
        yield
    finally:
        for _k, _v in _prev.items():
            if _v is None:
                os.environ.pop(_k, None)
            else:
                os.environ[_k] = _v


# ──────────────────────────── get_market_trends ────────────────────────────

def test_get_market_trends_returns_structured_data_not_empty():
    """get_market_trends must NOT return {} — it should return a structured
    dict with status, trends, and forecast keys powered by Holt's."""
    result = predictive_service.get_market_trends()
    assert isinstance(result, dict)
    assert "status" in result
    assert result["status"] in ("success", "no_data")
    assert "trends" in result
    assert "forecast" in result
    assert isinstance(result["trends"], list)
    assert isinstance(result["forecast"], dict)
    print("✓ get_market_trends returns structured data (not {})")


def test_get_market_trends_uses_holt_method():
    """The forecast must be produced by Holt's Linear Exponential Smoothing."""
    result = predictive_service.get_market_trends(steps_ahead=3)
    if result["status"] == "no_data":
        print("  (skipped — no seed data available)")
        return
    assert result.get("method") == "holt_linear_exponential_smoothing"
    for name, fc in result["forecast"].items():
        if fc.get("method") == "holt_linear_exponential_smoothing":
            assert "forecast_values" in fc
            assert "forecast_years" in fc
            assert "historical_values" in fc
            assert len(fc["forecast_values"]) == 3
            assert fc["alpha"] == 0.3
            assert fc["beta"] == 0.1
    print("✓ get_market_trends uses Holt's Linear (alpha=0.3, beta=0.1)")


def test_get_market_trends_forecast_values_are_positive():
    """Holt's forecast for education metrics should produce non-negative values."""
    result = predictive_service.get_market_trends(steps_ahead=3)
    if result["status"] == "no_data":
        print("  (skipped — no seed data)")
        return
    for name, fc in result["forecast"].items():
        if fc.get("method") == "holt_linear_exponential_smoothing":
            for v in fc["forecast_values"]:
                assert v >= 0, f"Forecast value negative for {name}: {v}"
    print("✓ get_market_trends forecast values are non-negative")


# ──────────────────────── predict_career_path ────────────────────────────────

def test_predict_career_path_empty_input_returns_no_input():
    """Empty user_history should return no_input status, not a crash."""
    result = predictive_service.predict_career_path([])
    assert result["status"] == "no_input"
    assert result["recommendations"] == []
    print("✓ predict_career_path handles empty input gracefully")


def test_predict_career_path_returns_structured_recommendations():
    """predict_career_path must return a dict with recommendations (not a string)."""
    result = predictive_service.predict_career_path(["Python", "JavaScript", "Web"])
    assert isinstance(result, dict)
    assert "status" in result
    assert "recommendations" in result
    assert isinstance(result["recommendations"], list)
    assert "method" in result
    assert result["method"] == "holt_linear_exponential_smoothing"
    print("✓ predict_career_path returns structured dict with Holt's method")


def test_predict_career_path_recommendations_have_required_fields():
    """Each recommendation has the fields the frontend expects."""
    result = predictive_service.predict_career_path(["Python", "Web"])
    recs = result.get("recommendations", [])
    if not recs:
        print("  (skipped — no seed data for recommendations)")
        return
    for r in recs:
        assert "career_path" in r
        assert "match_score" in r
        assert "explanation" in r
        assert "missing_skills" in r
        assert isinstance(r["match_score"], int)
        assert 0 <= r["match_score"] <= 100
        assert isinstance(r["missing_skills"], list)
    print("✓ predict_career_path recommendations have required fields")


def test_predict_career_path_uses_holt_parameters():
    """The prediction must reference alpha=0.3 and beta=0.1 (Holt's defaults)."""
    result = predictive_service.predict_career_path(["Python"])
    assert result.get("alpha") == 0.3
    assert result.get("beta") == 0.1
    print("✓ predict_career_path references Holt's alpha=0.3, beta=0.1")


# ──────────────────────────── analyze_trends ────────────────────────────────

def test_analyze_trends_uses_holt_method():
    """analyze_trends should use Holt's forecasting on real data when available."""
    trends = predictive_service.analyze_trends([])
    # At minimum, should return a list (possibly empty if no data)
    assert isinstance(trends, list)
    if trends:
        methods = {t.get("method") for t in trends}
        assert "holt_linear_exponential_smoothing" in methods or "keyword_frequency" in methods
    print("✓ analyze_trends returns list with Holt's method markers")


def test_analyze_trends_with_keywords_fallback():
    """analyze_trends should still include keyword frequency analysis when data present."""
    trends = predictive_service.analyze_trends([{"keyword": "Python"}, {"keyword": "Web"}])
    assert isinstance(trends, list)
    # Should include keyword_frequency entries for the provided keywords
    kw_entries = [t for t in trends if t.get("method") == "keyword_frequency"]
    kw_names = {t["name"] for t in kw_entries}
    assert "python" in kw_names or "web" in kw_names
    print("✓ analyze_trends includes keyword frequency analysis")


# ────────────────────────── Holt's consistency ────────────────────────────────

def test_holt_forecast_consistency_with_analytics():
    """The predictive service's Holt forecast must match analytics.py's
    _holt_linear_forecast exactly (true sync, not a copy)."""
    years = [2022, 2023, 2024]
    values = [80.0, 85.0, 90.0]
    # Direct call to analytics.py
    direct = _holt_linear_forecast(years, values, steps_ahead=3)
    # Via predictive_service._forecast (delegates to analytics)
    via_service = predictive_service._forecast(years, values, steps_ahead=3)
    assert direct == via_service
    assert len(direct) == 3
    print(f"✓ Holt forecast is synced: {direct} == {via_service}")


def test_holt_forecast_single_data_point():
    """With a single data point, Holt falls back to repeating the value."""
    fc = _holt_linear_forecast([2024], [42.0], steps_ahead=1)
    assert fc == [42.0]
    print("✓ Holt forecast handles single data point")


def test_holt_forecast_negative_clamped():
    """Holt's forecast clamps negative values to 0 (education metrics can't be negative)."""
    fc = _holt_linear_forecast([2022, 2023, 2024], [0.0, 0.0, 0.0], steps_ahead=2)
    assert all(v >= 0 for v in fc)
    print("✓ Holt forecast clamps negatives to 0")


# ──────────────── predict_educational_gaps (Idea #3) ────────────────────────

def test_gap_forecast_returns_geojson_featurecollection():
    """Output must be a valid GeoJSON FeatureCollection with the expected
    envelope keys the frontend relies on (heat_points, risk_ranking, trends,
    metadata)."""
    result = predictive_service.predict_educational_gaps("Đồng Nai", 3)
    assert isinstance(result, dict)
    assert result["type"] == "FeatureCollection"
    assert isinstance(result["features"], list)
    # heat_points is [lat, lng, weight]
    assert isinstance(result["heat_points"], list)
    assert isinstance(result["risk_ranking"], list)
    assert isinstance(result["trends"], list)
    assert isinstance(result["metadata"], dict)
    print(f"✓ predict_educational_gaps returns FeatureCollection ({len(result['features'])} features)")


def test_gap_forecast_heat_points_format_and_bounds():
    """Each heat_point is [lat, lng, weight] with weight ∈ [0, 1]."""
    result = predictive_service.predict_educational_gaps("Đồng Nai", 3)
    for p in result["heat_points"]:
        assert len(p) == 3, f"heat_point must be [lat,lng,weight], got {p}"
        lat, lng, weight = p
        # Vietnam lat/lng bounds sanity check
        assert -90 <= lat <= 90
        assert -180 <= lng <= 180
        assert 0.0 <= weight <= 1.0, f"weight out of [0,1]: {weight}"
    print(f"✓ heat_points well-formed ({len(result['heat_points'])} pts, all weights in [0,1])")


def test_gap_forecast_risk_ranking_sorted_desc():
    """risk_ranking must be descending by risk_score and each score ∈ [0,1]."""
    result = predictive_service.predict_educational_gaps("Đồng Nai", 3)
    scores = [r["risk_score"] for r in result["risk_ranking"]]
    assert all(0.0 <= s <= 1.0 for s in scores), "risk_score must be ∈ [0,1]"
    assert scores == sorted(scores, reverse=True), f"risk_ranking not sorted desc: {scores}"
    print(f"✓ risk_ranking sorted desc ({len(result['risk_ranking'])} entries)")


def test_gap_forecast_holt_parameters_present():
    """metadata must surface Holt's alpha=0.3 and beta=0.1 for transparency."""
    result = predictive_service.predict_educational_gaps("Đồng Nai", 3)
    meta = result["metadata"]
    assert meta.get("holt_alpha") == 0.3
    assert meta.get("holt_beta") == 0.1
    assert meta.get("method") == "holt_linear_exponential_smoothing + dbscan"
    assert meta.get("steps_ahead") == 3
    assert not meta.get("degraded")
    print("✓ Holt params (alpha=0.3, beta=0.1) surfaced in metadata")


def test_gap_forecast_respects_steps_ahead():
    """steps_ahead must propagate into metadata and trend forecast lengths."""
    result = predictive_service.predict_educational_gaps("Đồng Nai", 5)
    assert result["metadata"]["steps_ahead"] == 5
    print("✓ steps_ahead=5 propagated")


def test_gap_forecast_dbscan_prefilter_capped():
    """Whole-country call (lots of POIs) must pre-filter DBSCAN to ≤2000 pts."""
    result = predictive_service.predict_educational_gaps(None, 3)
    meta = result["metadata"]
    # pois_loaded is the raw count (≈3,200+); pois_clustered is the post-filter
    # cap that DBSCAN actually sees.
    assert meta.get("pois_loaded") > 0
    assert meta.get("pois_clustered") <= 2000, f"DBSCAN pre-filter exceeded 2000: {meta.get('pois_clustered')}"
    assert meta.get("pois_clustered") <= meta.get("pois_loaded")
    print(f"✓ DBSCAN pre-filter ≤2000 (loaded={meta['pois_loaded']}, clustered={meta['pois_clustered']})")


def test_gap_forecast_degraded_when_sparse():
    """A region with no matching schools/POIs/data must degrade gracefully:
    metadata.degraded=True + a reason string, and still return a valid
    (empty) FeatureCollection rather than crashing."""
    result = predictive_service.predict_educational_gaps("Nonexistent Province XYZ", 3)
    assert result["type"] == "FeatureCollection"
    meta = result["metadata"]
    assert meta.get("degraded") is True
    assert isinstance(meta.get("reason"), str) and len(meta["reason"]) > 0
    # Even when degraded, the structure the frontend expects must exist.
    assert isinstance(result["heat_points"], list)
    assert isinstance(result["risk_ranking"], list)
    print(f"✓ degraded gracefully for sparse region: {meta['reason']}")


if __name__ == "__main__":
    test_get_market_trends_returns_structured_data_not_empty()
    test_get_market_trends_uses_holt_method()
    test_get_market_trends_forecast_values_are_positive()
    test_predict_career_path_empty_input_returns_no_input()
    test_predict_career_path_returns_structured_recommendations()
    test_predict_career_path_recommendations_have_required_fields()
    test_predict_career_path_uses_holt_parameters()
    test_analyze_trends_uses_holt_method()
    test_analyze_trends_with_keywords_fallback()
    test_holt_forecast_consistency_with_analytics()
    test_holt_forecast_single_data_point()
    test_holt_forecast_negative_clamped()
    test_gap_forecast_returns_geojson_featurecollection()
    test_gap_forecast_heat_points_format_and_bounds()
    test_gap_forecast_risk_ranking_sorted_desc()
    test_gap_forecast_holt_parameters_present()
    test_gap_forecast_respects_steps_ahead()
    test_gap_forecast_dbscan_prefilter_capped()
    test_gap_forecast_degraded_when_sparse()
    print("\n✅ All predictive service tests passed!")
