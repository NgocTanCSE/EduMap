"""AI Data Trust & Anomaly Detector.

Phát hiện điểm dữ liệu sai, trùng lặp, lỗi thời, tọa độ bất thường trên
các POI (map_points / locations).

Kết hợp hai tầng:
  1. **Rule-based checks (luật kiểm tra)** — nhanh, giải thích được lý do
     ngoại lệ: tọa độ thiếu / sai, trùng tên gần nhau, dữ liệu lỗi thời,
     trường bắt buộc rỗng, trạng thái không hợn lệ, nguồn chưa gán.
  2. **IsolationForest (scikit-learn)** — phát hiện outlier không gian (spatial
     anomaly) mà luật không bắt được. Chạy theo chunk 1000 hàng để tránh
     timeout (xem *Risks* trong AGENTS.md).

Đầu ra: danh sách anomaly được xếp thứ hạng ưu tiên (priority ranking) với
mức confidence [0–1].

HF Spaces: đọc SQLite trực tiếp (db_service = None trong chế độ sqlite).
Local/Dev: dùng db_service (PostgreSQL + PostGIS).
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import sqlite3
import uuid
from collections import defaultdict
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("data_quality")

# ── Constants ────────────────────────────────────────────────────────────────

# Biên giới Việt Nam (mở rộng một chút degress để tránh false positive
# ở các vùng biên giới như Cà Mau, Lạch Tray, mỏm Bắc...):
#   lat:  8.0  – 23.5  (Cà Mau ≈ 8.4, Lũng Cú ≈ 23.4)
#   lng: 102.0 – 110.0  (Bờ cạnh Campuchia/Mỏm Tây miền)
VIETNAM_LAT_MIN = 8.0
VIETNAM_LAT_MAX = 23.5
VIETNAM_LNG_MIN = 102.0
VIETNAM_LNG_MAX = 110.0

# Hai POI cùng tên và cách nhau < 200m thì coi là trùng lặp.
DUPLICATE_PROXIMITY_M = 200.0

# Chunk size cho IsolationForest — tránh timeout (>1000 hàng có thể mất
# nhiều giây trên môi trường HF Spaces giới hạn tài nguyên).
IFOREST_CHUNK_SIZE = 1000

# Anomaly score ngưỡng IsolationForest (giá trị âm — càng âm càng bất thường).
# -0.5 ~ threshold mặc định của sklearn. Tinh chỉnh để cân bằng precision/recall.
IFOREST_THRESHOLD = -0.15

# Dữ liệu cũ hơn 365 ngày thì báo cáo là "lỗi thời".
STALENESS_DAYS = 365

# Type_id → label ánh xạ (trùng với TYPE_NAME_MAP trong db_service.py).
TYPE_NAME_MAP: Dict[int, str] = {
    1: "university", 2: "school", 3: "library", 4: "bookstore",
    5: "lab", 6: "wifi", 7: "green", 8: "cafe", 9: "restaurant",
    10: "market", 11: "convenience",
}

# Nhãn quán trọng cho rule weighting — trùng với MapService CATEGORY_COLOR.
VALID_STATUS_VALUES = {"active", "approved", "pending", "rejected", "inactive"}

# Mọi rule đều có "base weight". Confidence = weighted_sum / max_possible_weight.
RULE_WEIGHTS: Dict[str, float] = {
    "missing_coordinates":       10.0,
    "invalid_coordinates":       8.0,
    "spatial_outlier":           7.0,
    "duplicate_name":            6.0,
    "missing_name":              5.0,
    "missing_address":           3.0,
    "stale_data":                2.0,
    "invalid_status":            2.0,
    "missing_source":            1.0,
}

# Risk note: confidence 0.7 — false positive được giảm bằng cách ép min confidence
# cho IsolationForest-only anomalies ở 0.7.
MIN_CONFIDENCE_IFOREST = 0.7


# ── Coordinate parsing ───────────────────────────────────────────────────────

_EWKT_RE = re.compile(r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", re.IGNORECASE)


def parse_coords(value: Any) -> Tuple[Optional[float], Optional[float]]:
    """Parse a geography value in any supported format → (lng, lat).

    Hỗ trợ:
      - GeoJSON dict / object: {"type":"Point","coordinates":[lng,lat]}
      - JSON string: '{"type":"Point","coordinates":[lng,lat]}'
      - EWKT string: 'SRID=4326;POINT(106.84 10.95)'
      - Array / tuple: [lng, lat]
    Trả về (None, None) nếu không parse được.
    """
    if value is None:
        return None, None

    # Object / dict
    if isinstance(value, dict):
        coords = value.get("coordinates")
        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
            try:
                return float(coords[0]), float(coords[1])
            except (TypeError, ValueError):
                pass
        # Fallback: flat lat/lng keys
        if "lat" in value and "lng" in value:
            try:
                return float(value["lng"]), float(value["lat"])
            except (TypeError, ValueError):
                pass
        if "lat" in value and "lon" in value:
            try:
                return float(value["lon"]), float(value["lat"])
            except (TypeError, ValueError):
                pass
        return None, None

    # List / tuple directly
    if isinstance(value, (list, tuple)):
        if len(value) >= 2:
            try:
                return float(value[0]), float(value[1])
            except (TypeError, ValueError):
                pass
        return None, None

    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None, None
        # Try JSON first
        try:
            parsed = json.loads(s)
            if isinstance(parsed, dict):
                return parse_coords(parsed)
            if isinstance(parsed, list) and len(parsed) >= 2:
                return float(parsed[0]), float(parsed[1])
        except (json.JSONDecodeError, ValueError, TypeError):
            pass
        # EWKT
        m = _EWKT_RE.search(s)
        if m:
            try:
                return float(m.group(1)), float(m.group(2))
            except ValueError:
                pass
        # Comma-separated "lat,lng" — ambiguous, skip (see map.service.ts comment)

    return None, None


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in metres."""
    R = 6371000.0
    to_rad = math.pi / 180.0
    d_lat = (lat2 - lat1) * to_rad
    d_lng = (lng2 - lng1) * to_rad
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(lat1 * to_rad) * math.cos(lat2 * to_rad)
         * math.sin(d_lng / 2) ** 2)
    return 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)) * R


def _normalize_name(name: str) -> str:
    """Chuẩn hóa tên POI để so sánh trùng lặp."""
    if not name:
        return ""
    result = name.lower().strip()
    # Tên viết tắt thường gặp
    result = re.sub(r"\bđh\b", "đại học", result)
    result = re.sub(r"\bđntu\b", "đại học nông lâm", result)
    result = re.sub(r"\bđhql\b", "đại học quốc gia", result)
    result = re.sub(r"\btp\.?\s*hcm\b", "thành phố hồ chí minh", result)
    result = re.sub(r"\bhcm\b", "hồ chí minh", result)
    # Bỏ nội dung trong ngoặc
    result = re.sub(r"\s*\(.*?\)\s*", "", result)
    result = re.sub(r"\s+", " ", result)
    return result.strip()


def _name_similarity(a: str, b: str) -> float:
    """Levenshtein ratio [0–1] trên tên đã chuẩn hóa."""
    sa = _normalize_name(a)
    sb = _normalize_name(b)
    if not sa or not sb:
        return 0.0
    if sa == sb:
        return 1.0
    longer, shorter = (sa, sb) if len(sa) > len(sb) else (sb, sa)
    if len(longer) == 0:
        return 1.0
    dist = _levenshtein(sa, sb)
    return (len(longer) - dist) / len(longer)


def _levenshtein(a: str, b: str) -> int:
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return dp[m][n]


# ── Data loading ─────────────────────────────────────────────────────────────

def _sqlite_path() -> Optional[str]:
    """Trả về đường dẫn SQLite file (chế độ HF Spaces) hoặc None."""
    if os.getenv("DB_TYPE", "postgres").lower() != "sqlite":
        return None
    path = os.getenv("DB_SQLITE_PATH", "/app/frontend/public/edumap.db")
    return path if os.path.exists(path) else None


def _query_sqlite(sql: str, params: Tuple = ()) -> List[Dict[str, Any]]:
    """Chạy query read-only trên SQLite (HF Spaces mode)."""
    path = _sqlite_path()
    if not path:
        return []
    conn = None
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=10)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]
    except Exception as e:
        logger.error(f"SQLite data_quality query failed: {e}")
        return []
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def _load_poi_records() -> List[Dict[str, Any]]:
    """Tải tất cả POI (map_points + locations), chuẩn hoá về schema thống nhất.

    Trong SQLAlchemy/SQLite, `map_points.location` và `locations.coordinates`
    đều có thể là EWKT / GeoJSON string / JSON — parse_coords() xử lý tất cả.
    """
    records: List[Dict[str, Any]] = []

    # ── PostgreSQL mode (db_service) ─────────────────────────────────────────
    try:
        from services.db_service import db_service
        if db_service is not None:
            rows = db_service.get_locations_for_analysis() or []
            for r in rows:
                lng, lat = _safe_float(r.get("lng")), _safe_float(r.get("lat"))
                records.append(_normalize_poi(
                    id=str(r.get("id", "")),
                    name=r.get("name"),
                    lat=lat,
                    lng=lng,
                    address=r.get("address"),
                    city=r.get("city"),
                    district=r.get("district"),
                    category=r.get("type", "other"),
                    source="db_service",
                    updated_at=_parse_dt(r.get("updated_at")),
                    created_at=_parse_dt(r.get("created_at")),
                    status=r.get("status"),
                    description=r.get("description"),
                ))
            if records:
                return records
    except Exception as e:
        logger.warning(f"db_service load failed, falling back to SQLite: {e}")

    # ── SQLite mode (HF Spaces) — đọc trực tiếp 2 bảng ────────────────────
    # map_points
    try:
        mp_rows = _query_sqlite(
            "SELECT id, name, type_id, location, address, city, district, province, "
            "status, verified, created_by, created_at, updated_at, deleted_at "
            "FROM map_points WHERE deleted_at IS NULL LIMIT 50000"
        )
        for r in mp_rows:
            lng, lat = parse_coords(r.get("location"))
            records.append(_normalize_poi(
                id=str(r.get("id", "")),
                name=r.get("name"),
                lat=lat if lat is not None else None,
                lng=lng if lng is not None else None,
                address=r.get("address"),
                city=r.get("city"),
                district=r.get("district"),
                category=TYPE_NAME_MAP.get(r.get("type_id"), "other"),
                source="map_points",
                updated_at=_parse_dt(r.get("updated_at")),
                created_at=_parse_dt(r.get("created_at")),
                status=r.get("status"),
                description=r.get("description"),
                province=r.get("province"),
            ))
    except Exception as e:
        logger.warning(f"SQLite map_points read failed: {e}")

    # locations (crawled / newer TypeORM entity)
    try:
        loc_rows = _query_sqlite(
            "SELECT l.id, l.name, l.category_id, l.coordinates, l.address, "
            "l.city, l.description, l.status, l.is_verified, l.created_by, "
            "l.created_at, l.updated_at, l.deleted_at, c.name as cat_name "
            "FROM locations l "
            "LEFT JOIN location_categories c ON l.category_id = c.id "
            "WHERE l.deleted_at IS NULL LIMIT 50000"
        )
        for r in loc_rows:
            lng, lat = parse_coords(r.get("coordinates"))
            cat = (r.get("cat_name") or "").lower() or "other"
            records.append(_normalize_poi(
                id=str(r.get("id", "")),
                name=r.get("name"),
                lat=lat if lat is not None else None,
                lng=lng if lng is not None else None,
                address=r.get("address"),
                city=r.get("city"),
                district=r.get("district"),
                category=cat,
                source="locations",
                updated_at=_parse_dt(r.get("updated_at")),
                created_at=_parse_dt(r.get("created_at")),
                status=r.get("status"),
                description=r.get("description"),
            ))
    except Exception as e:
        logger.warning(f"SQLite locations read failed: {e}")

    return records


def _normalize_poi(
    id: str,
    name: Optional[str],
    lat: Optional[float],
    lng: Optional[float],
    address: Optional[str],
    city: Optional[str],
    district: Optional[str],
    category: Optional[str],
    source: str,
    updated_at: Optional[datetime],
    created_at: Optional[datetime],
    status: Optional[str] = None,
    description: Optional[str] = None,
    province: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "id": id or str(uuid.uuid4()),
        "name": (name or "").strip() if name else None,
        "lat": _safe_float(lat),
        "lng": _safe_float(lng),
        "address": address,
        "city": city,
        "district": district,
        "province": province,
        "description": description,
        "category": (category or "other").lower(),
        "source": source,
        "status": (status or "").strip() if status else None,
        "updated_at": updated_at,
        "created_at": created_at,
    }


def _safe_float(v: Any) -> Optional[float]:
    try:
        f = float(v)
        if f != f:  # NaN
            return None
        return f
    except (TypeError, ValueError, OverflowError):
        return None


def _parse_dt(v: Any) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return datetime.combine(v, datetime.min.time())
    if isinstance(v, str):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%fZ"):
            try:
                return datetime.strptime(v.strip(), fmt)
            except ValueError:
                continue
    return None


# ── IsolationForest ─────────────────────────────────────────────────────────

def _run_isolation_forest(
    points: List[Dict[str, Any]],
    threshold: float = IFOREST_THRESHOLD,
    chunk_size: int = IFOREST_CHUNK_SIZE,
) -> Dict[str, float]:
    """Chạy IsolationForest trên tọa độ [lng, lat], trả về {id: score}.

    Chunk 1000 hàng/chunk theo *Risks* trong AGENTS.md để tránh timeout
    trên HF Spaces. Chỉ các POI có tọa độ hợp lệ mới được đưa vào.
    """
    # Lấy các điểm có tọa độ hợp lệ
    valid_points = [p for p in points if p.get("lat") is not None and p.get("lng") is not None]
    if not valid_points:
        return {}

    try:
        from sklearn.ensemble import IsolationForest
    except ImportError:
        logger.warning("scikit-learn not available — skipping IsolationForest")
        return {}

    feature_matrix = np.array(
        [[p["lng"], p["lat"]] for p in valid_points],
        dtype=np.float64,
    )

    scores: Dict[str, float] = {}
    n = len(valid_points)

    # Chunk processing — mỗi chunk chạy một IsolationForest độc lập.
    # Điểm outlier được tính trên toàn bộ tập, nhưng để tránh memory/CPU
    # exploding trên HF Spaces, chúng ta chunk và gộp kết quả.
    for start in range(0, n, chunk_size):
        end = min(start + chunk_size, n)
        chunk = feature_matrix[start:end]
        chunk_points = valid_points[start:end]

        try:
            iso = IsolationForest(
                contamination="auto",
                random_state=42,
                n_estimators=50,  # giảm từ 100 để tăng tốc
            )
            iso.fit(chunk)
            chunk_scores = iso.decision_function(chunk)
            for pt, score in zip(chunk_points, chunk_scores):
                scores[pt["id"]] = float(score)
        except Exception as e:
            logger.warning(f"IsolationForest chunk [{start}:{end}] failed: {e}")
            continue

    return scores


# ── Rule-based anomaly detection ────────────────────────────────────────────

def _run_rules(points: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """Chạy các luật kiểm tra, trả về {id: [rule_keys]}.

    Luật:
      - missing_coordinates: lat hoặc lng là None
      - invalid_coordinates: ngoài biên giới VN
      - duplicate_name: tên trùng/gần giống + cách nhau < 200m
      - missing_name: name rỗng
      - missing_address: address rỗng
      - stale_data: updated_at > STALENESS_DAYS ngày
      - invalid_status: status không nằm trong VALID_STATUS_VALUES
      - missing_source: city/district/province đều rỗng (nguồn chưa gán)
    """
    triggered: Dict[str, List[str]] = defaultdict(list)

    # Spatial grid để tìm kiếm trùng lặp nhanh (giống MapService dedup logic)
    CELL_SIZE = DUPLICATE_PROXIMITY_M / 111_000.0  # ~0.002 độ
    grid: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    def _cell(lat: float, lng: float) -> str:
        return f"{lat // CELL_SIZE},{lng // CELL_SIZE}"

    for p in points:
        pid = p["id"]

        # missing_coordinates
        if p.get("lat") is None or p.get("lng") is None:
            triggered[pid].append("missing_coordinates")
            continue  # không thể chạy Spatial rules nữa

        # invalid_coordinates
        if not (VIETNAM_LAT_MIN <= p["lat"] <= VIETNAM_LAT_MAX
                and VIETNAM_LNG_MIN <= p["lng"] <= VIETNAM_LNG_MAX):
            triggered[pid].append("invalid_coordinates")

        # stale_data
        updated = p.get("updated_at")
        if updated is None or (datetime.now() - updated).days > STALENESS_DAYS:
            triggered[pid].append("stale_data")

        # invalid_status
        status = (p.get("status") or "").strip() if p.get("status") else ""
        if status and status not in VALID_STATUS_VALUES:
            triggered[pid].append("invalid_status")

        # missing_source — không có thông tin địa giới nào
        if not p.get("city") and not p.get("district") and not p.get("address"):
            triggered[pid].append("missing_source")

        # missing_name
        if not p.get("name"):
            triggered[pid].append("missing_name")

        # missing_address
        if not p.get("address"):
            triggered[pid].append("missing_address")

        # duplicate_name — kiểm tra với các POI trong cùng & lân cận cell
        key = _cell(p["lat"], p["lng"])
        lat_base = float(key.split(",")[0])
        lng_base = float(key.split(",")[1])
        candidates = []
        for d_lat in (-1, 0, 1):
            for d_lng in (-1, 0, 1):
                adj_key = f"{lat_base + d_lat},{lng_base + d_lng}"
                candidates.extend(grid.get(adj_key, []))

        for existing in candidates:
            if existing["id"] == pid:
                continue
            dist = _haversine(
                p["lat"], p["lng"], existing["lat"], existing["lng"]
            )
            if dist < DUPLICATE_PROXIMITY_M:
                # Tên giống hệt hoặc tương đồng >= 0.8
                if p.get("name") and existing.get("name"):
                    sim = _name_similarity(p["name"], existing["name"])
                    if sim >= 0.8:
                        triggered[pid].append("duplicate_name")
                        triggered[existing["id"]].append("duplicate_name")

        grid[key].append(p)

    return dict(triggered)


# ── Scoring & ranking ────────────────────────────────────────────────────────

def _rule_reason(rule: str) -> str:
    reasons = {
        "missing_coordinates": "Thiếu hoặc không parse được tọa độ",
        "invalid_coordinates": "Tọa độ nằm ngoài biên giới Việt Nam",
        "spatial_outlier": "Điểm ngoại lệ địa lý (IsolationForest phát hiện)",
        "duplicate_name": "Trùng tên / trùng vị trí với POI khác",
        "missing_name": "Tên POI rỗng",
        "missing_address": "Thiếu địa chỉ",
        "stale_data": f"Dữ liệu cũ hơn {STALENESS_DAYS} ngày",
        "invalid_status": "Trạng thái không hợp lệ",
        "missing_source": "Thiếu thông tin nguồn / địa giới",
    }
    return reasons.get(rule, rule)


def _compute_confidence(rule_keys: List[str], iforest_anomaly: bool) -> float:
    """Tính confidence [0–1] dựa trên trọng số rule + IsolationForest.

    - Rule-only anomalies: confidence = weight_sum / total_weight * 0.9
      (giới hạn 0.9 để nhận thức "chưa chắc ăn" cho rule-only).
    - Nếu IsolationForest cũng đánh dấu outlier → cộng 0.1.
    - IsolationForest-only anomalies: confidence = 0.7 (theo *Risks*: false
      positive → confidence tối thiểu 0.7).
    """
    if not rule_keys and not iforest_anomaly:
        return 0.0

    total_weight = sum(RULE_WEIGHTS.values())
    weight_sum = sum(RULE_WEIGHTS.get(r, 1.0) for r in rule_keys)

    if rule_keys:
        conf = min(0.95, 0.4 + (weight_sum / total_weight) * 0.55)
        if iforest_anomaly:
            conf = min(1.0, conf + 0.1)
        return round(conf, 3)
    else:
        # IsolationForest-only
        base = MIN_CONFIDENCE_IFOREST
        # Càng điểm số âm (anomalous) càng tin cậy
        return base


def _priority_level(confidence: float) -> str:
    """Xếp mức độ ưu tiên."""
    if confidence >= 0.7:
        return "high"
    if confidence >= 0.4:
        return "medium"
    return "low"


def _priority_score(confidence: float, rule_keys: List[str]) -> float:
    """Điểm số dùng để xếp thứ tự (sắp giảm dần)."""
    # Các rule nghiêm trọng (missing_coordinates, invalid_coordinates, spatial_outlier)
    # được tăng điểm ưu tiên.
    severity_boost = sum(
        0.15 for r in rule_keys
        if r in ("missing_coordinates", "invalid_coordinates", "spatial_outlier", "duplicate_name")
    )
    return confidence + severity_boost


# ── Main service ────────────────────────────────────────────────────────────

class DataQualityService:
    """AI Data Trust & Anomaly Detector service.

    Public API:
        report(category=None, limit=500, include_clean=False)
          → { summary, anomalies, source_counts }
    """

    def __init__(self):
        self._initialized = True

    def report(
        self,
        category: Optional[str] = None,
        limit: Optional[int] = 500,
        include_clean: bool = False,
    ) -> Dict[str, Any]:
        """Tạo báo cáo chất lượng dữ liệu.

        Trả về:
        {
          summary: { total_checked, total_anomalies, anomaly_rate,
                     by_category: {cat: count}, priority_breakdown: {high/medium/low} },
          anomalies: [ {id, name, category, lat, lng, address,
                         reasons: [str], confidence: float, priority: "high"|"medium"|"low",
                         source, updated_at, anomaly_types: [str]} ],
          source_counts: {map_points: n, locations: n}
        }
        """
        # 1. Load dữ liệu
        points = _load_poi_records()
        if not points:
            return {
                "summary": {
                    "total_checked": 0,
                    "total_anomalies": 0,
                    "anomaly_rate": 0.0,
                    "by_category": {},
                    "priority_breakdown": {"high": 0, "medium": 0, "low": 0},
                    "degraded": True,
                    "reason": "Không tải được dữ liệu POI nào.",
                },
                "anomalies": [],
                "source_counts": {},
            }

        # 2. Lọc theo category nếu có
        if category:
            cat_lower = category.lower()
            points = [p for p in points if p.get("category", "").lower() == cat_lower]

        # 3. Giới hạn số lượng (để tránh timeout trên HF Spaces)
        if limit and len(points) > limit:
            points = points[:limit]

        # 4. Chạy luật kiểm tra
        rule_triggered = _run_rules(points)

        # 5. Chạy IsolationForest (chunked)
        iforest_scores = _run_isolation_forest(points)

        # 6. Gộp kết quả và tính confidence
        anomalies: List[Dict[str, Any]] = []
        source_counts: Dict[str, int] = defaultdict(int)

        for p in points:
            source_counts[p.get("source", "unknown")] += 1
            if p.get("lat") is not None and p.get("lng") is not None:
                pass  # có tọa độ

            rule_keys: List[str] = rule_triggered.get(p["id"], [])
            if not rule_keys:
                # Kiểm tra IsolationForest outlier
                score = iforest_scores.get(p["id"])
                if score is not None and score < IFOREST_THRESHOLD:
                    rule_keys = ["spatial_outlier"]
                    if not include_clean:
                        anomalies.append(_build_anomaly(p, rule_keys, score))
                    continue
                if not include_clean:
                    continue

            score = iforest_scores.get(p["id"])
            anomalies.append(_build_anomaly(p, rule_keys, score))

        # 7. Sắp xếp theo priority_score (giảm dần)
        anomalies.sort(key=lambda a: _priority_score(a["confidence"], a["anomaly_types"]), reverse=True)

        total_anomalies = len(anomalies)

        # 8. Tổng hợp summary
        by_category: Dict[str, int] = defaultdict(int)
        priority_breakdown = {"high": 0, "medium": 0, "low": 0}
        for a in anomalies:
            for t in a["anomaly_types"]:
                by_category[t] += 1
            priority_breakdown[a["priority"]] += 1

        return {
            "summary": {
                "total_checked": len(points),
                "total_anomalies": total_anomalies,
                "anomaly_rate": round(total_anomalies / len(points) * 100, 2) if points else 0.0,
                "by_category": dict(by_category),
                "priority_breakdown": dict(priority_breakdown),
                "degraded": False,
            },
            "anomalies": anomalies,
            "source_counts": dict(source_counts),
        }


def _build_anomaly(
    p: Dict[str, Any],
    rule_keys: List[str],
    iforest_score: Optional[float],
) -> Dict[str, Any]:
    """Xây dựng anomaly record từ POI + triggered rules + iforest score."""
    confidence = _compute_confidence(rule_keys, iforest_score is not None and iforest_score < IFOREST_THRESHOLD)
    reasons = [_rule_reason(r) for r in rule_keys]

    # Nếu có iforest score nhưng chưa có spatial_outlier rule, thêm
    if iforest_score is not None and iforest_score < IFOREST_THRESHOLD and "spatial_outlier" not in rule_keys:
        rule_keys = list(rule_keys) + ["spatial_outlier"]
        reasons.append(_rule_reason("spatial_outlier"))
        confidence = _compute_confidence(rule_keys, True)

    return {
        "id": p["id"],
        "name": p.get("name"),
        "category": p.get("category", "other"),
        "lat": p.get("lat"),
        "lng": p.get("lng"),
        "address": p.get("address"),
        "city": p.get("city"),
        "district": p.get("district"),
        "source": p.get("source"),
        "updated_at": _fmt_dt(p.get("updated_at")),
        "created_at": _fmt_dt(p.get("created_at")),
        "anomaly_types": list(rule_keys),
        "reasons": reasons,
        "confidence": confidence,
        "priority": _priority_level(confidence),
        "iforest_score": round(iforest_score, 4) if iforest_score is not None else None,
    }


def _fmt_dt(dt: Any) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(dt, date):
        return dt.strftime("%Y-%m-%d")
    if isinstance(dt, str):
        return dt
    return str(dt)


# Singleton
data_quality_service = DataQualityService()
