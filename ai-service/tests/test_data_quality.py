"""Unit tests for the AI Data Trust & Anomaly Detector service.

Kiểm tra:
  - parse_coords: mọi định dạng tọa độ (EWKT, GeoJSON, JSON string, array)
  - _run_rules: luật thiếu tọa độ, tọa độ sai, trùng lặp, lỗi thời, thiếu trường
  - _compute_confidence: confidence >= 0.7 cho IsolationForest-only (risk mitigation)
  - _run_isolation_forest: chunking + trả về scores cho điểm bất thường
  - report(): degraded khi không có dữ liệu, cấu trúc response đúng shape
  - _haversine: độ chính xác khoảng cách
"""

import asyncio
import os
import sys
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure NO real providers + SQLite mode
os.environ["DB_TYPE"] = "sqlite"
os.environ["DB_SQLITE_PATH"] = "/tmp/edumap_test.db"
for _v in [
    "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "OPENROUTER_API_KEY",
    "NVIDIA_API_KEY", "OPENROUTER_EMBEDDING_MODEL",
]:
    os.environ[_v] = ""
os.environ["AI_PREFLIGHT"] = "false"

from services.data_quality import (
    parse_coords,
    _haversine,
    _normalize_name,
    _name_similarity,
    _compute_confidence,
    _run_rules,
    _run_isolation_forest,
    _normalize_poi,
    DataQualityService,
    data_quality_service,
    VIETNAM_LAT_MIN, VIETNAM_LAT_MAX,
    VIETNAM_LNG_MIN, VIETNAM_LNG_MAX,
    RULE_WEIGHTS,
    MIN_CONFIDENCE_IFOREST,
)


# ── parse_coords tests ─────────────────────────────────────────────────────

def test_parse_coords_ewkt():
    """EWKT string 'SRID=4326;POINT(lng lat)' được parse đúng."""
    lng, lat = parse_coords("SRID=4326;POINT(106.8430 10.9570)")
    assert lng is not None and lat is not None
    assert abs(lng - 106.8430) < 0.001
    assert abs(lat - 10.9570) < 0.001
    print("✓ test_parse_coords_ewkt")


def test_parse_coords_geojson_dict():
    """GeoJSON dict {'type':'Point','coordinates':[lng,lat]}."""
    lng, lat = parse_coords({"type": "Point", "coordinates": [106.8430, 10.9570]})
    assert lng is not None and lat is not None
    assert abs(lng - 106.8430) < 0.001
    assert abs(lat - 10.9570) < 0.001
    print("✓ test_parse_coords_geojson_dict")


def test_parse_coords_json_string():
    """GeoJSON JSON string được parse."""
    lng, lat = parse_coords('{"type":"Point","coordinates":[106.8430,10.9570]}')
    assert lng is not None and lat is not None
    assert abs(lng - 106.8430) < 0.001
    print("✓ test_parse_coords_json_string")


def test_parse_coords_array():
    """Plain array [lng, lat]."""
    lng, lat = parse_coords([106.8430, 10.9570])
    assert lng is not None and lat is not None
    print("✓ test_parse_coords_array")


def test_parse_coords_none():
    """None / rỗng trả về (None, None)."""
    assert parse_coords(None) == (None, None)
    assert parse_coords("") == (None, None)
    print("✓ test_parse_coords_none")


def test_parse_coords_invalid():
    """Giá trị không hợp lệ trả về (None, None)."""
    assert parse_coords("not a coordinate") == (None, None)
    assert parse_coords({"foo": "bar"}) == (None, None)
    assert parse_coords([1]) == (None, None)
    print("✓ test_parse_coords_invalid")


# ── _haversine tests ─────────────────────────────────────────────────────────

def test_haversine_dntu_to_lhu():
    """Khoảng cách DNTU → LHU (~8km) phải nằm trong ngưỡng 7–9km."""
    # DNTU: 10.98448, 106.86965 ; LHU: 10.95322, 106.80245
    d = _haversine(10.98448, 106.86965, 10.95322, 106.80245)
    assert 7000 < d < 9000, f"Expected ~8km, got {d}m"
    print(f"✓ test_haversine_dntu_to_lhu ({d:.0f}m)")


def test_haversine_same_point():
    """Cùng một điểm → khoảng cách 0."""
    assert _haversine(10.0, 106.0, 10.0, 106.0) == 0.0
    print("✓ test_haversine_same_point")


# ── Rule-based detection tests ───────────────────────────────────────────────

def _make_poi(id, name="Test POI", lat=10.95, lng=106.84, address="123 Test St",
              city="Biên Hòa", district="Trảng Dài", category="university",
              status="active", updated_at=None, source="test"):
    if updated_at is None:
        updated_at = datetime.now() - timedelta(days=30)
    return _normalize_poi(
        id=id, name=name, lat=lat, lng=lng, address=address,
        city=city, district=district, category=category, source=source,
        updated_at=updated_at, created_at=updated_at, status=status,
    )


def test_rule_missing_coordinates():
    """POI thiếu tọa độ → trigger missing_coordinates."""
    points = [_make_poi("1", lat=None, lng=None)]
    result = _run_rules(points)
    assert "1" in result
    assert "missing_coordinates" in result["1"]
    print("✓ test_rule_missing_coordinates")


def test_rule_invalid_coordinates():
    """Tọa độ ngoài biên giới VN → trigger invalid_coordinates."""
    # Tọa độ ở ngoài biển (giữa biển Đông)
    points = [_make_poi("2", lat=5.0, lng=120.0, address="Test")]
    result = _run_rules(points)
    assert "invalid_coordinates" in result.get("2", [])
    print("✓ test_rule_invalid_coordinates")


def test_rule_stale_data():
    """Dữ liệu cũ > 365 ngày → trigger stale_data."""
    old_date = datetime.now() - timedelta(days=400)
    points = [_make_poi("3", updated_at=old_date)]
    result = _run_rules(points)
    assert "stale_data" in result.get("3", [])
    print("✓ test_rule_stale_data")


def test_rule_missing_name():
    """Tên POI rỗng → trigger missing_name."""
    points = [_make_poi("4", name="")]
    result = _run_rules(points)
    assert "missing_name" in result.get("4", [])
    print("✓ test_rule_missing_name")


def test_rule_missing_address():
    """Địa chỉ rỗng → trigger missing_address."""
    points = [_make_poi("5", address=None)]
    result = _run_rules(points)
    assert "missing_address" in result.get("5", [])
    print("✓ test_rule_missing_address")


def test_rule_duplicate_name():
    """Hai POI cùng tên + gần nhau (<200m) → trigger duplicate_name."""
    now = datetime.now() - timedelta(days=30)
    p1 = _make_poi("p1", name="DNTU", lat=10.98448, lng=106.86965,
                   address="Nguyễn Khuyến", updated_at=now)
    p2 = _make_poi("p2", name="DNTU", lat=10.98450, lng=106.86970,
                   address="Nguyễn Khuyến", updated_at=now)
    result = _run_rules([p1, p2])
    assert "duplicate_name" in result.get("p1", [])
    assert "duplicate_name" in result.get("p2", [])
    print("✓ test_rule_duplicate_name")


def test_rule_valid_poi_no_anomalies():
    """POI hợp lệ → không trigger rule nào."""
    points = [_make_poi("ok1")]
    result = _run_rules(points)
    assert "ok1" not in result or len(result.get("ok1", [])) == 0
    print("✓ test_rule_valid_poi_no_anomalies")


# ── Confidence scoring tests ─────────────────────────────────────────────────

def test_confidence_iforest_only():
    """IsolationForest-only anomaly → confidence >= 0.7 (risks mitigation)."""
    conf = _compute_confidence([], iforest_anomaly=True)
    assert conf >= MIN_CONFIDENCE_IFOREST, f"Expected >= {MIN_CONFIDENCE_IFOREST}, got {conf}"
    print(f"✓ test_confidence_iforest_only ({conf})")


def test_confidence_high_severity():
    """missing_coordinates + invalid_coordinates → confidence cao."""
    conf = _compute_confidence(["missing_coordinates", "invalid_coordinates"], iforest_anomaly=False)
    assert conf > 0.5, f"Expected high confidence, got {conf}"
    print(f"✓ test_confidence_high_severity ({conf})")


def test_confidence_rule_plus_iforest():
    """Rule + iforest anomaly → confidence tăng."""
    conf_no_if = _compute_confidence(["duplicate_name"], iforest_anomaly=False)
    conf_with_if = _compute_confidence(["duplicate_name"], iforest_anomaly=True)
    assert conf_with_if >= conf_no_if
    print(f"✓ test_confidence_rule_plus_iforest ({conf_no_if} → {conf_with_if})")


# ── IsolationForest tests ────────────────────────────────────────────────────

def test_isolation_forest_no_valid_points():
    """Không có tọa độ hợp lệ → trả về dict rỗng."""
    points = [{"id": "1", "lat": None, "lng": None}]
    scores = _run_isolation_forest(points)
    assert scores == {}
    print("✓ test_isolation_forest_no_valid_points")


def test_isolation_forest_detects_outlier():
    """IsolationForest phát hiện điểm outlier rõ rệt."""
    # 50 điểm tập trung quanh TP.HCM + 1 điểm ở miền Bắc (Hà Nội)
    points = []
    for i in range(50):
        points.append({
            "id": f"p{i}",
            "lat": 10.8 + (i % 5) * 0.001,
            "lng": 106.7 + (i % 5) * 0.001,
        })
    points.append({"id": "outlier", "lat": 21.0279, "lng": 105.8342})

    scores = _run_isolation_forest(points)
    assert "outlier" in scores, "Outlier point should get a score"
    # Hà Nội (21.x) nên là outlier — điểm số âm hơn (anomalous)
    # so với các điểm ở TP.HCM
    outlier_score = scores.get("outlier", 0)
    normal_score = scores.get("p0", 0)
    assert outlier_score < normal_score, f"Outlier score ({outlier_score}) should be lower than normal ({normal_score})"
    print(f"✓ test_isolation_forest_detects_outlier (outlier={outlier_score:.4f} vs normal={normal_score:.4f})")


def test_isolation_forest_chunking():
    """IsolationForest chạy đúng cách chunk > 1000 hàng."""
    # Tạo 1200 điểm — vượ qua chunk size 1000
    points = [{"id": f"c{i}", "lat": 10.8 + i * 0.0001, "lng": 106.7 + i * 0.0001} for i in range(1200)]
    scores = _run_isolation_forest(points, chunk_size=1000)
    assert len(scores) == 1200, f"Expected 1200 scores, got {len(scores)}"
    print("✓ test_isolation_forest_chunking")


# ── Name normalization & similarity ─────────────────────────────────────────

def test_normalize_name_abbrev():
    """Tên viết tắt được chuẩn hóa."""
    assert _normalize_name("Đại học") == "đại học"
    assert _normalize_name("ĐH Quốc gia") == "đại học quốc gia"
    assert _normalize_name("Trường ĐNTU (Campus A)") == "trường đại học nông lâm"
    print("✓ test_normalize_name_abbrev")


def test_name_similarity_high():
    """Tên giống hệt → similarity 1.0."""
    assert _name_similarity("DNTU", "Đại học Nông lâm") >= 0.8 or \
           _name_similarity("Đại học Công nghệ", "Đại học Công nghệ") == 1.0
    print("✓ test_name_similarity_high")


# ── Report / DataQualityService tests ────────────────────────────────────────

def test_report_empty_when_no_data():
    """Khi không có dữ liệu (SQLite path không tồn tại) → degraded = True, anomalies rỗng."""
    os.environ["DB_SQLITE_PATH"] = "/tmp/nonexistent_db.db"
    svc = DataQualityService()
    result = svc.report()
    assert result["summary"]["degraded"] is True
    assert result["anomalies"] == []
    assert result["summary"]["total_checked"] == 0
    print("✓ test_report_empty_when_no_data")


def test_report_structure():
    """Report trả về cấu trúc đúng shape."""
    # Tạo SQLite DB giả định để test
    import sqlite3
    db_path = "/tmp/test_edumap_dq.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS map_points (
            id TEXT PRIMARY KEY, name TEXT, description TEXT, type_id INTEGER,
            location TEXT, address TEXT, city TEXT, district TEXT, province TEXT,
            photos TEXT, rating_avg REAL, rating_count INTEGER,
            status TEXT DEFAULT 'pending', verified INTEGER DEFAULT 0,
            created_by TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT
        )
    """)
    conn.execute("""
        INSERT INTO map_points (id, name, type_id, location, address, city, district, province, status, verified, created_at, updated_at)
        VALUES
            ('uuid-1', 'DNTU', 1, 'SRID=4326;POINT(106.86965 10.98448)', 'Nguyễn Khuyến, Biên Hòa', 'Biên Hòa', 'Trảng Dài', 'Đồng Nai', 'active', 1, '2026-06-01', '2026-06-01'),
            ('uuid-2', 'LHU', 1, 'SRID=4326;POINT(106.80245 10.95322)', 'Bửu Long, Biên Hòa', 'Biên Hòa', 'Bửu Long', 'Đồng Nai', 'active', 1, '2026-06-01', '2026-06-01'),
            ('uuid-3', '', 2, 'SRID=4326;POINT(999.0 999.0)', '', 'Biên Hòa', '', '', 'bad_status', 0, '2024-01-01', '2024-01-01'),
            ('uuid-4', 'Trường X', 1, NULL, NULL, NULL, NULL, NULL, 'pending', 0, '2024-01-01', '2024-01-01')
    """)
    conn.commit()
    conn.close()

    os.environ["DB_SQLITE_PATH"] = db_path
    svc = DataQualityService()
    result = svc.report(limit=500)

    assert "summary" in result
    assert "anomalies" in result
    assert "source_counts" in result
    assert result["summary"]["total_checked"] == 4
    assert result["summary"]["total_anomalies"] >= 1, f"Expected at least 1 anomaly, got {result['summary']['total_anomalies']}"

    # POIs uuid-3 (invalid coords + bad status + stale) và uuid-4 (missing coords + missing name + missing address)
    anomaly_ids = [a["id"] for a in result["anomalies"]]
    assert "uuid-3" in anomaly_ids, f"uuid-3 should be flagged, got {anomaly_ids}"
    assert "uuid-4" in anomaly_ids, f"uuid-4 should be flagged, got {anomaly_ids}"

    # Kiểm tra anomaly có confidence
    for a in result["anomalies"]:
        assert 0 <= a["confidence"] <= 1.0
        assert a["priority"] in ("high", "medium", "low")
        assert len(a["reasons"]) > 0
        assert len(a["anomaly_types"]) > 0

    # Dọn dẹp
    os.remove(db_path)

    print(f"✓ test_report_structure ({result['summary']['total_anomalies']} anomalies found)")


def test_report_category_filter():
    """Report lọc theo category."""
    import sqlite3
    db_path = "/tmp/test_edumap_dq_cat.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS map_points (
            id TEXT PRIMARY KEY, name TEXT, type_id INTEGER, location TEXT,
            address TEXT, city TEXT, district TEXT, province TEXT,
            photos TEXT, rating_avg REAL, rating_count INTEGER,
            status TEXT DEFAULT 'pending', verified INTEGER DEFAULT 0,
            created_by TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT
        )
    """)
    conn.execute("""
        INSERT INTO map_points (id, name, type_id, location, address, city, status, created_at, updated_at)
        VALUES
            ('u1', 'School A', 2, 'SRID=4326;POINT(106.80 10.95)', 'Addr 1', 'Biên Hòa', 'active', '2026-06-01', '2026-06-01'),
            ('u2', 'Uni B', 1, 'SRID=4326;POINT(106.81 10.96)', 'Addr 2', 'Biên Hòa', 'active', '2026-06-01', '2026-06-01'),
            ('u3', '', 1, NULL, NULL, NULL, 'pending', '2026-06-01', '2026-06-01')
    """)
    conn.commit()
    conn.close()

    os.environ["DB_SQLITE_PATH"] = db_path
    svc = DataQualityService()

    # Lọc category=school (type_id=2) — u1 (School A) có dữ liệu hợp lệ nên clean,
    # u2 (university) và u3 (university, missing coords) bị lọc ra ngoài
    result = svc.report(category="school", limit=500)
    assert result["summary"]["total_checked"] == 1, f"Expected 1 school, got {result['summary']['total_checked']}"
    # u1 has valid data → 0 anomalies (when include_clean=False)
    assert result["summary"]["total_anomalies"] == 0, f"Expected 0 anomalies for clean school, got {result['summary']['total_anomalies']}"
    assert result["anomalies"] == []

    # include_clean=True → u1 appears dưới dạng clean record
    result_clean = svc.report(category="school", limit=500, include_clean=True)
    assert result_clean["summary"]["total_checked"] == 1
    assert len(result_clean["anomalies"]) == 1
    assert result_clean["anomalies"][0]["id"] == "u1"

    os.remove(db_path)
    print("✓ test_report_category_filter")


# ── Smoke test for router integration ────────────────────────────────────────

def test_router_importable():
    """Router data_quality.py phải import được và có router attribute."""
    import importlib
    # Reset module cache to pick up fresh env
    if 'routers.data_quality' in sys.modules:
        del sys.modules['routers.data_quality']
    mod = importlib.import_module('routers.data_quality')
    assert hasattr(mod, 'router'), "routers.data_quality must export 'router'"
    assert hasattr(mod, 'data_quality_report'), "Must have data_quality_report endpoint"
    print("✓ test_router_importable")


# ── Backend admin endpoint guard test (conceptual) ───────────────────────────

def test_admin_controller_guard_structure():
    """Kiểm tra rằng AdminController có endpoint data-quality/report
    với guard và role decoration (được gắn bởi class-level @UseGuards + @Roles)."""
    # Đây là smoke test — chúng ta kiểm tra metadata của decorator trên file nguồn
    # vì TypeScript NestJS decorators không thể introspect ở runtime Python.
    controller_path = os.path.join(
        os.path.dirname(_AI_DIR),
        "backend/src/modules/admin/admin.controller.ts"
    )
    if os.path.exists(controller_path):
        with open(controller_path, "r") as f:
            content = f.read()
        assert "data-quality/report" in content, "AdminController must have data-quality/report endpoint"
        assert "JwtAuthGuard" in content, "AdminController must use JwtAuthGuard"
        assert "RolesGuard" in content, "AdminController must use RolesGuard"
        assert "ADMIN" in content, "AdminController must check ADMIN role"
        print("✓ test_admin_controller_guard_structure")
    else:
        print("⊘ test_admin_controller_guard_structure (backend src not accessible)")


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_parse_coords_ewkt()
    test_parse_coords_geojson_dict()
    test_parse_coords_json_string()
    test_parse_coords_array()
    test_parse_coords_none()
    test_parse_coords_invalid()
    test_haversine_dntu_to_lhu()
    test_haversine_same_point()
    test_rule_missing_coordinates()
    test_rule_invalid_coordinates()
    test_rule_stale_data()
    test_rule_missing_name()
    test_rule_missing_address()
    test_rule_duplicate_name()
    test_rule_valid_poi_no_anomalies()
    test_confidence_iforest_only()
    test_confidence_high_severity()
    test_confidence_rule_plus_iforest()
    test_isolation_forest_no_valid_points()
    test_isolation_forest_detects_outlier()
    test_isolation_forest_chunking()
    test_normalize_name_abbrev()
    test_name_similarity_high()
    test_report_empty_when_no_data()
    test_report_structure()
    test_report_category_filter()
    test_router_importable()
    test_admin_controller_guard_structure()
    print("\n✅ All data_quality tests passed!")
