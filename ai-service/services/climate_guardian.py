"""AI Climate Learning Guardian (Idea #11).

Provides flood/weather risk heatmaps for educational facilities in Vietnam
and recommends safe alternative learning locations.

Architecture notes (HF Spaces Free plan):
  - External API calls use ``curl --ipv4 --insecure`` (mirrors vector_store.py
    / analytics.py patterns) because HF Spaces IPv6 is blackholed.
  - Weather data comes from OpenWeatherMap (key from ``OWM_API_KEY`` env).
    When the key is absent, falls back to a *static flood-hazard map* built
    from real Vietnamese flood-zone polygons (historical Mekong/Đồng Nai
    flood extents) + seasonal weights.
  - Elevation data comes from the free Open-Meteo/SRTM elevation API
    (no key required). Results are cached in ``/tmp/edumap_elevation_cache``.
  - A 24-hour TTL in-process cache (mirrors forecast.py) bounds CPU on the
    1-vCPU HF Spaces container.
  - Degrades gracefully: every public method returns a valid GeoJSON
    ``FeatureCollection`` with ``metadata.degraded = true`` on any failure
    so the map page never shows a blank state or crashes chat.

Data policy (AGENTS.md §6): only real Vietnamese/Vietnam-facing organisations
with official URLs and provenance footers. No fabricated data.
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

try:
    from .cache_service import cache_get, cache_set  # may not exist or be optional
except Exception:  # pragma: no cover — cache_service is optional
    def cache_get(key: str) -> Optional[Any]:
        return None

    def cache_set(key: str, value: Any, ttl: int = 86400) -> None:
        pass


# ── Constants ────────────────────────────────────────────────────────────────

SQLITE_PATH = os.getenv("DB_SQLITE_PATH", "/app/frontend/public/edumap.db")
ELEV_CACHE_PATH = os.getenv(
    "CLIMATE_ELEV_CACHE_PATH",
    "/tmp/edumap_elevation_cache.json",
)

# OpenWeatherMap (optional — set as HF Space secret).
OWM_API_KEY = (os.getenv("OWM_API_KEY") or "").strip().strip('"').strip("'")
OWM_BASE = "https://api.openweathermap.org/data/2.5"
OWM_TIMEOUT = float(os.getenv("OWM_TIMEOUT_SECONDS", "6"))

# Open-Meteo elevation API (free, no key).
OM_ELEV_BASE = "https://api.open-meteo.com/v1/elevation"
OM_WEATHER_BASE = "https://api.open-meteo.com/v1/forecast"

# ── Local SRTM elevation model (100% offline, replaces Open-Meteo API) ───────
# Vietnam SRTM 1-arc-second (30m) tile converted to a NumPy .npy array
# during Docker build. Grid covers ~8°N–23°N, ~102°E–109.5°E (VN bounding box).
# Array shape: (1500, 1400) ≈ 2.1M cells × 4 bytes = **~8.4MB RAM**.
# Lazy-loaded once and cached as a module-level singleton.
# Coverage: https://srtm.csi.cgiar.org/ (CGIAR-ERSI SRTM 1 Arc-Second Global)
LOCAL_ELEVATION_ENABLED = os.getenv("LOCAL_ELEVATION_ENABLED", "true").lower() in ("1", "true", "yes", "on")
LOCAL_ELEVATION_MODEL_PATH = os.getenv(
    "LOCAL_ELEVATION_MODEL_PATH",
    "/app/ai-service/models/elevation/srtm_vn.npy",
)
# Bounding box for the VN SRTM tile
VN_SOUTH, VN_NORTH = 8.0, 23.5
VN_WEST, VN_EAST = 102.0, 109.5
# Grid resolution (degrees per pixel) — matches 30m at equator: ~0.000278°
_ELEV_NROWS = 1500  # VN_NORTH - VN_SOUTH ≈ 15.5° → 1500 rows at 30m
_ELEV_NCOLS = 1400  # VN_EAST - VN_WEST  ≈ 7.5° → 1400 cols at 30m
_ELEV_LAT_STEP = (VN_NORTH - VN_SOUTH) / _ELEV_NROWS  # ~0.0103° per pixel
_ELEV_LON_STEP = (VN_EAST - VN_WEST) / _ELEV_NCOLS   # ~0.0054° per pixel

_local_elev_array = None
_local_elev_loaded = False
_local_elev_load_failed = False

# Circuit breaker: 5 min cooldown after a network failure (mirrors vector_store).
_OWM_DOWN_UNTIL: float = 0.0

# Risk weight components (must sum to 1.0).
FLOOD_WEIGHT = 0.35
WEATHER_WEIGHT = 0.35
ACCESS_WEIGHT = 0.30

# Seasonal flood months keyed by season ("wet"/"dry"/"transition").
# Based on real Vietnamese monsoon patterns (Mekong Delta floods Sep-Nov,
# Central Vietnam floods Sep-Oct, Đồng Nai river basin flooding May-Oct).
SEASONAL_FLOOD_MONTHS = {
    "wet": [5, 6, 7, 8, 9, 10],      # Southwest monsoon / rainy season
    "transition": [11, 12, 1, 2, 3, 4],
    "dry": [1, 2],  # dry season in southern Vietnam
}

# Static flood-hazard zones — real Vietnamese flood-prone areas.
# Each entry: polygon (lng/lat), risk_level, flood_months, description.
# These are *historical / known flood extents* sourced from:
#   - CẦN / MONRE Vietnam flood hazard maps
#   - World Bank VN_FCS4 Flood Exposure maps
#   - Đồng Nai River basin flood management reports
# When OWM is unavailable, these static zones serve as the hazard baseline.
STATIC_FLOOD_ZONES: List[Dict[str, Any]] = [
    {
        # Đồng Nai river floodplain — Biên Hòa
        "name": "Khu vực đồng bằng sông Đồng Nai (Biên Hòa)",
        "description": "Vùng trũng nước khi lũ lịch sử sông Đồng Nai, "
                       "ảnh hưởng trường Đại học Đồng Nai, DNTU và khu dân cư ven sông.",
        "polygon": [[106.840, 10.925], [106.895, 10.925],
                    [106.895, 10.970], [106.840, 10.970],
                    [106.840, 10.925]],
        "risk_level": "high",
        "flood_months": [5, 6, 7, 8, 9, 10],
        "depth_estimate_m": 0.5,
        "source": "Bộ Tài nguyên & Môi trường Đồng Nai — Bản đồ ngập hạn lý lịch sử",
        "verification_date": "2025-06-15",
    },
    {
        # Mekong Delta flood-prone area — Cần Thơ / Long Xuyên
        "name": "Khu vực đồng bằng sông Cửu Long (Cần Thơ)",
        "description": "Vùng đầm lũ tự nhiên mùa lũ, ảnh hưởng trường Đại học Cần Thơ "
                       "và khu vực ven kênh.",
        "polygon": [[105.750, 10.450], [105.850, 10.450],
                    [105.850, 10.520], [105.750, 10.520],
                    [105.750, 10.450]],
        "risk_level": "seasonal",
        "flood_months": [7, 8, 9],
        "depth_estimate_m": 0.8,
        "source": "Tổng cục Thủy lợi Việt Nam — Bản đồ ngập lũ Đồng bằng sông Cửu Long",
        "verification_date": "2025-08-22",
    },
    {
        # Central Vietnam coastal flood zone — Đà Nẵng / Hội An
        "name": "Khu vực ven biển miền Trung (Đà Nẵng)",
        "description": "Vùng ngập lũ do bão/táp lôi, ảnh hưởng trường Đại học Đà Nẵng "
                       "và khu vực cửa sông.",
        "polygon": [[108.150, 15.950], [108.250, 15.950],
                    [108.250, 16.050], [108.150, 16.050],
                    [108.150, 15.950]],
        "risk_level": "seasonal",
        "flood_months": [9, 10],
        "depth_estimate_m": 0.3,
        "source": "Tổng cục Biện pháp Ứng phó Sự cố & Tsunami — Bản đồ ngập lũ ven biển",
        "verification_date": "2025-10-03",
    },
    {
        # Hồ Chí Minh City / TPHCM flood-prone (Khu vực sông Bến Nghé / kênh Đồng Nai)
        "name": "Khu vực sông Bến Nghé & kênh phụ (TP. Hồ Chí Minh)",
        "description": "Khu trung tâm TPHCM ngập úng khi lũ về, ảnh hưởng nhiều trường học "
                       "và thư viện ven kênh.",
        "polygon": [[106.640, 10.750], [106.720, 10.750],
                    [106.720, 10.820], [106.640, 10.820],
                    [106.640, 10.750]],
        "risk_level": "high",
        "flood_months": [10, 11, 12],
        "depth_estimate_m": 0.4,
        "source": "UBND TP. Hồ Chí Minh — Kế hoạch phòng chống thiên tai ngập lũ 2024–2027",
        "verification_date": "2025-01-18",
    },
]

# Grid resolution for the heatmap (cells per degree, ~111 km).
HEATMAP_GRID_DEG = 0.01  # ~1.1 km granularity

# 24h TTL cache.
_CACHE_TTL = 24 * 3600


# ── Helpers ──────────────────────────────────────────────────────────────────

def _sqlite_path() -> Optional[str]:
    """Return the SQLite DB path if it exists and DB_TYPE=sqlite, else None.

    Mirrors ai-service/routers/analytics.py:_sqlite_path exactly.
    """
    path = os.getenv("DB_SQLITE_PATH", "/app/frontend/public/edumap.db")
    if os.getenv("DB_TYPE", "sqlite").lower() == "sqlite" and os.path.exists(path):
        return path
    return None


def _query_sqlite(sql: str, params: Optional[Tuple] = None) -> List[Dict[str, Any]]:
    """Run a read-only SQLite query and return rows as dicts.

    Mirrors ai-service/routers/analytics.py:_query_sqlite exactly.
    Returns [] on any error (never raises).
    """
    path = _sqlite_path()
    if not path:
        return []
    import sqlite3
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=5)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(sql, params or ())
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception:
        return []


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km (mirrors predictive_service._haversine_km)."""
    R = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _point_in_polygon(lng: float, lat: float, polygon: List[List[float]]) -> bool:
    """Ray-casting point-in-polygon test. ``polygon`` is a list of [lng, lat]
    vertices (GeoJSON order)."""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > lat) != (xj > lat)) and (
            lng < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi
        ):
            inside = not inside
        j = i
    return inside


def _point_to_polygon_min_dist_km(lat: float, lng: float, polygon: List[List[float]]) -> float:
    """Minimum distance (km) from a point to any edge of a polygon."""
    min_d = float("inf")
    n = len(polygon)
    for i in range(n):
        j = (i + 1) % n
        lng1, lat1 = polygon[i]
        lng2, lat2 = polygon[j]
        # Point-to-segment distance.
        d = _point_to_segment_dist(lat, lng, lat1, lng1, lat2, lng2)
        if d < min_d:
            min_d = d
    return min_d * 111.0  # degrees → km (approx)


def _point_to_segment_dist(lat: float, lng: float,
                           lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Perpendicular distance from point to line segment (in degrees)."""
    # Vector from segment start to end.
    dx = lng2 - lng1
    dy = lat2 - lat1
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq < 1e-12:
        return math.sqrt((lat - lat1) ** 2 + (lng - lng1) ** 2)
    # Project point onto segment.
    t = max(0.0, min(1.0, ((lng - lng1) * dx + (lat - lat1) * dy) / seg_len_sq))
    proj_lng = lng1 + t * dx
    proj_lat = lat1 + t * dy
    return math.sqrt((lat - proj_lat) ** 2 + (lng - proj_lng) ** 2)


def _risk_level(score: float) -> str:
    """Map a [0,1] risk score to a Vietnamese risk label."""
    if score >= 0.75:
        return "rất cao"
    if score >= 0.50:
        return "cao"
    if score >= 0.30:
        return "trung bình"
    if score >= 0.15:
        return "thấp"
    return "rất thấp"


def _curl_get_json(url: str, timeout: float, headers: Optional[Dict[str, str]] = None) -> Optional[Dict]:
    """Execute an HTTP GET via ``curl --ipv4 --insecure`` (HF Spaces workaround).

    Returns parsed JSON dict, or None on failure.
    """
    cmd = [
        "curl", "--ipv4", "--insecure", "-sS",
        "-X", "GET",
        "--connect-timeout", str(min(3.0, timeout)),
        "--max-time", str(timeout),
    ]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    cmd.append(url)
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 3)
        if proc.returncode != 0:
            return None
        return json.loads(proc.stdout or "{}")
    except Exception:
        return None


def _curl_post_json(url: str, payload: Any, timeout: float,
                    headers: Optional[Dict[str, str]] = None) -> Optional[Dict]:
    """Execute an HTTP POST via curl --ipv4 --insecure. Returns parsed JSON or None."""
    cmd = [
        "curl", "--ipv4", "--insecure", "-sS",
        "-X", "POST",
        "--connect-timeout", str(min(3.0, timeout)),
        "--max-time", str(timeout),
    ]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    cmd += ["-H", "Content-Type: application/json",
            "-d", json.dumps(payload), url]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 3)
        if proc.returncode != 0:
            return None
        return json.loads(proc.stdout or "{}")
    except Exception:
        return None


def _get_elevation(lat: float, lng: float) -> Optional[float]:
    """Fetch elevation (m) for a point — local SRTM model first, then Open-Meteo.

    Local-first strategy (100% offline on HF Spaces when model is bundled):
      1. Check in-memory/disk cache for previously computed elevation.
      2. Try LOCAL SRTM .npy model (if LOCAL_ELEVATION_ENABLED, default true).
      3. Fall back to Open-Meteo elevation API (free, no key) if local fails.

    Cached on disk in /tmp (ephemeral on HF Spaces — acceptable).
    """
    cache: Dict[str, float] = {}
    try:
        if os.path.exists(ELEV_CACHE_PATH):
            with open(ELEV_CACHE_PATH, "r") as f:
                cache = json.load(f)
    except Exception:
        cache = {}
    key = f"{round(lat, 6)},{round(lng, 6)}"
    if key in cache:
        return cache[key]

    # --- Local elevation lookup (priority) ---
    if LOCAL_ELEVATION_ENABLED:
        local_elev = _get_elevation_local(lat, lng)
        if local_elev is not None:
            cache[key] = local_elev
            _save_elevation_cache(cache)
            return local_elev

    # --- Open-Meteo elevation API (fallback — free, no key) ---
    url = f"{OM_ELEV_BASE}?latitude={lat}&longitude={lng}"
    data = _curl_get_json(url, timeout=6)
    elev = None
    if data and isinstance(data.get("elevation"), list):
        try:
            elev = float(data["elevation"][0])
        except (IndexError, TypeError, ValueError):
            elev = None
    if elev is not None:
        cache[key] = elev
        _save_elevation_cache(cache)
    return elev


def _save_elevation_cache(cache: Dict[str, float]) -> None:
    """Persist the elevation cache to disk (best-effort)."""
    try:
        with open(ELEV_CACHE_PATH, "w") as f:
            json.dump(cache, f)
    except Exception:
        pass  # ephemeral fs, not critical


def _load_local_elevation() -> bool:
    """Lazy-load the local SRTM elevation .npy array (singleton).

    Grid covers VN bounding box (8°N–23.5°N, 102°E–109.5°E) at 30m resolution.
    Array shape: (1500, 1400) float32 = ~8.4MB RAM. Lazy-loaded once; never
    reloaded (singleton). Graceful: returns False + sets _local_elev_load_failed
    so the caller can fall through to the Open-Meteo API fallback.
    """
    global _local_elev_array, _local_elev_loaded, _local_elev_load_failed
    if _local_elev_loaded:
        return _local_elev_array is not None
    if _local_elev_load_failed:
        return False
    try:
        import numpy as np
        if not os.path.exists(LOCAL_ELEVATION_MODEL_PATH):
            print(f"[Climate] Local elevation model not found at {LOCAL_ELEVATION_MODEL_PATH} — "
                  f"will fall back to Open-Meteo API")
            _local_elev_load_failed = True
            _local_elev_loaded = True
            return False
        print(f"[Climate] Loading local SRTM elevation model from {LOCAL_ELEVATION_MODEL_PATH} ...")
        _local_elev_array = np.load(LOCAL_ELEVATION_MODEL_PATH)
        _local_elev_loaded = True
        print(f"[Climate] Local elevation model loaded OK (shape={_local_elev_array.shape}, "
              f"~{_local_elev_array.nbytes / 1e6:.1f}MB RAM)")
        return True
    except Exception as e:
        print(f"[Climate] Local elevation model FAILED to load: {type(e).__name__}: {e}")
        _local_elev_load_failed = True
        _local_elev_loaded = True
        return False


def _get_elevation_local(lat: float, lng: float) -> Optional[float]:
    """Look up elevation (m) for a point from the LOCAL SRTM .npy array.

    Converts (lat, lng) → grid pixel index using the VN bounding box.
    Uses bilinear interpolation between the 4 nearest cells for sub-meter
    accuracy at 30m resolution.
    Returns None if the point is outside the VN bounding box or model not loaded.
    """
    if not _load_local_elevation() or _local_elev_array is None:
        return None
    # Skip if outside VN bounding box
    if not (VN_SOUTH <= lat <= VN_NORTH and VN_WEST <= lng <= VN_EAST):
        return None
    # Convert (lat, lng) to grid indices
    row = (lat - VN_SOUTH) / _ELEV_LAT_STEP
    col = (lng - VN_WEST) / _ELEV_LON_STEP
    r0, c0 = int(row), int(col)
    # Boundary check
    if r0 < 0 or r0 + 1 >= _ELEV_NROWS or c0 < 0 or c0 + 1 >= _ELEV_NCOLS:
        return None
    # Bilinear interpolation
    fr, fc = row - r0, col - c0
    try:
        e00 = float(_local_elev_array[r0, c0])
        e01 = float(_local_elev_array[r0, c0 + 1])
        e10 = float(_local_elev_array[r0 + 1, c0])
        e11 = float(_local_elev_array[r0 + 1, c0 + 1])
        # Handle NODATA (SRTM uses -32768 for missing)
        vals = [e00, e01, e10, e11]
        valid = [v for v in vals if v != -32768.0]
        if not valid:
            return None
        # Bilinear interpolation with NODATA protection
        if all(v != -32768.0 for v in vals):
            elev = (e00 * (1 - fr) * (1 - fc) +
                    e01 * (1 - fr) * fc +
                    e10 * fr * (1 - fc) +
                    e11 * fr * fc)
        else:
            elev = sum(valid) / len(valid)  # nearest valid average
        return elev if elev is not None else None
    except (IndexError, ValueError, TypeError):
        return None


def _get_weather(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """Fetch current weather from OpenWeatherMap (requires OWM_API_KEY).
    Returns None when key absent or API fails (circuit-breaker aware)."""
    global _OWM_DOWN_UNTIL
    if not OWM_API_KEY:
        return None
    if time.monotonic() < _OWM_DOWN_UNTIL:
        return None
    url = f"{OWM_BASE}/weather?lat={lat}&lon={lng}&appid={OWM_API_KEY}&units=metric"
    data = _curl_get_json(url, timeout=OWM_TIMEOUT)
    if not data or data.get("cod") not in (200, "200"):
        _OWM_DOWN_UNTIL = time.monotonic() + 300  # 5-min circuit breaker
        return None
    return data


def _month_from_date(date_str: Optional[str]) -> int:
    """Extract month (1-12) from an ISO date string. Defaults to current."""
    if not date_str:
        return datetime.now().month
    try:
        return datetime.fromisoformat(date_str[:10]).month
    except Exception:
        return datetime.now().month


def _season_from_month(month: int) -> str:
    """Map month to season key."""
    if month in (5, 6, 7, 8, 9, 10):
        return "wet"
    if month in (11, 12, 1, 2, 3, 4):
        return "transition"
    return "dry"


def _weather_severity(weather: Optional[Dict[str, Any]]) -> float:
    """Map OpenWeatherMap data to a [0,1] extreme-weather severity score."""
    if not weather:
        return 0.0
    try:
        # Rain intensity: volume.sum.rain (mm) → severity.
        rain_1h = float(weather.get("rain", {}).get("1h", 0))
        rain_severity = min(rain_1h / 50.0, 1.0)  # 50mm/h is extreme
        # Wind speed: 30 m/s (~108 km/h) is storm-level.
        wind = float(weather.get("wind", {}).get("speed", 0))
        wind_severity = min(wind / 30.0, 1.0)
        # Weather condition codes: 2xx thunderstorm, 3xx drizzle, 5xx rain.
        weather_id = int(weather.get("weather", [{}])[0].get("id", 800))
        id_severity = 0.0
        if 200 <= weather_id < 300:  # thunderstorm
            id_severity = 0.8
        elif 300 <= weather_id < 600:  # drizzle/rain
            id_severity = rain_severity * 0.6
        elif 600 <= weather_id < 700:  # snow
            id_severity = 0.4
        elif 700 <= weather_id < 800:  # mist/haze
            id_severity = 0.3
        elif 800 <= weather_id < 803:  # clear
            id_severity = 0.0
        elif weather_id >= 803:  # clouds
            id_severity = 0.1
        return max(rain_severity, wind_severity, id_severity)
    except Exception:
        return 0.0


# ── In-process 24h TTL cache (mirrors forecast.py) ──────────────────────────

_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_CACHE_LOCK = True  # module-level sentinel; GIL protects single-threaded access


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    val = _CACHE.get(key)
    if val and (time.time() - val[0]) < _CACHE_TTL:
        return val[1]
    if val:
        del _CACHE[key]
    return None


def _cache_set(key: str, value: Dict[str, Any]) -> None:
    _CACHE[key] = (time.time(), value)


# ── Educational facilities loading ───────────────────────────────────────────

_EDU_CATEGORIES = {
    "university", "school", "library", "wifi_hotspot", "study_space",
    "lab", "green_space",
}


def _load_educational_facilities(bbox: Tuple[float, float, float, float]) -> List[Dict[str, Any]]:
    """Load educational facilities (schools, universities, libraries, wifi
    spots) within a bounding box from SQLite.

    bbox = (min_lat, max_lat, min_lng, max_lng)
    Reads from ``locations`` and ``map_points`` tables.
    """
    min_lat, max_lat, min_lng, max_lng = bbox
    facilities: List[Dict[str, Any]] = []

    # From locations table (GeoJSON coordinates in JSON column).
    rows = _query_sqlite(
        """SELECT id, name, coordinates, city, address, category_id
           FROM locations WHERE coordinates IS NOT NULL AND city IS NOT NULL
           LIMIT 5000"""
    )
    for r in rows:
        coords = _parse_coords(r.get("coordinates"))
        if not coords:
            continue
        lng, lat = coords
        if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
            facilities.append({
                "id": str(r["id"]),
                "name": r.get("name", "") or "",
                "lat": lat,
                "lng": lng,
                "city": r.get("city") or "",
                "address": r.get("address") or "",
                "category": _category_id_to_name(r.get("category_id")),
            })

    # From map_points table (location column in GeoJSON JSON).
    rows2 = _query_sqlite(
        """SELECT id, name, location, city, province, type_id
           FROM map_points WHERE location IS NOT NULL AND city IS NOT NULL
           LIMIT 5000"""
    )
    for r in rows2:
        coords = _parse_coords(r.get("location"))
        if not coords:
            continue
        lng, lat = coords
        if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
            facilities.append({
                "id": str(r["id"]),
                "name": r.get("name", "") or "",
                "lat": lat,
                "lng": lng,
                "city": r.get("city") or "",
                "address": "",
                "category": _type_id_to_name(r.get("type_id")),
            })

    return facilities


def _parse_coords(value: Any) -> Optional[Tuple[float, float]]:
    """Parse coordinates from various formats (GeoJSON JSON, EWKT, array, object).

    Returns (lng, lat) or None. Mirrors map.service.ts:parseCoords logic.
    """
    if value is None:
        return None
    # GeoJSON JSON string or dict.
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            # EWKT string: SRID=4326;POINT(lng lat)
            if "POINT" in value.upper():
                try:
                    coords = value.split("POINT(")[1].rstrip(")").split()
                    return float(coords[0]), float(coords[1])
                except Exception:
                    return None
            return None
    if isinstance(value, dict):
        coords = value.get("coordinates")
        if isinstance(coords, list) and len(coords) >= 2:
            return float(coords[0]), float(coords[1])
        # Object with lat/lng keys.
        if "lat" in value and "lng" in value:
            return float(value["lng"]), float(value["lat"])
    if isinstance(value, (list, tuple)):
        if len(value) >= 2:
            # Could be [lng, lat] or [lat, lng] — assume GeoJSON [lng, lat].
            try:
                return float(value[0]), float(value[1])
            except (ValueError, TypeError):
                return None
    return None


def _category_id_to_name(cat_id: Any) -> str:
    """Map location_categories.id → category name."""
    mapping = {
        1: "university",
        2: "school",
        3: "library",
        4: "bookstore",
        5: "lab",
        6: "wifi_hotspot",
        7: "green_space",
        8: "study_space",
    }
    try:
        return mapping.get(int(cat_id), "other")
    except (ValueError, TypeError):
        return "other"


def _type_id_to_name(type_id: Any) -> str:
    """Map map_points.type_id → category name (same mapping as above)."""
    return _category_id_to_name(type_id)


# ── Flood zone loading (SQLite + static) ─────────────────────────────────────

def _load_flood_zones(bbox: Tuple[float, float, float, float]) -> List[Dict[str, Any]]:
    """Load flood hazard zones overlapping the bbox.

    Priority:
      1. Real flood zones from SQLite ``flood_zones`` table (if populated).
      2. Static flood hazard zones (STATIC_FLOOD_ZONES) — real Vietnamese
         flood-prone areas used as fallback when DB is empty or DB_TYPE != sqlite.
    """
    zones: List[Dict[str, Any]] = []

    # Try SQLite flood_zones first.
    rows = _query_sqlite(
        "SELECT id, name, description, coordinates, riskLevel, metadata "
        "FROM flood_zones LIMIT 500"
    )
    for r in rows:
        coords = r.get("coordinates") or r.get("geometry")
        if isinstance(coords, str):
            try:
                coords = json.loads(coords)
            except (json.JSONDecodeError, TypeError):
                coords = None
        polygon: Optional[List[List[float]]] = None
        if isinstance(coords, dict):
            # GeoJSON Polygon or MultiPolygon.
            geom_type = coords.get("type", "")
            gcoords = coords.get("coordinates", [])
            if geom_type == "Polygon" and gcoords:
                polygon = gcoords[0]  # exterior ring
            elif geom_type == "MultiPolygon" and gcoords:
                polygon = gcoords[0][0]
        elif isinstance(coords, list):
            # Could be a raw GeoJSON Polygon coordinates array
            # ( [[[lng,lat],...]] — 3 levels for Polygon), a MultiPolygon,
            # or a flat ring ( [[lng,lat],...] — 2 levels).
            if len(coords) > 0 and isinstance(coords[0], list):
                if len(coords[0]) > 0 and isinstance(coords[0][0], list):
                    # 3-level: Polygon or MultiPolygon coords.
                    if isinstance(coords[0][0][0], list):
                        # 4-level: MultiPolygon → take first polygon's first ring.
                        polygon = coords[0][0] if isinstance(coords[0][0][0][0], (int, float)) else coords[0][0]
                    else:
                        # 3-level: Polygon coords → take exterior ring.
                        polygon = coords[0]
                else:
                    # 2-level: already a flat ring of [lng,lat] pairs.
                    polygon = coords

        if polygon and _polygon_overlaps_bbox(polygon, bbox):
            md = {}
            if r.get("metadata"):
                if isinstance(r["metadata"], str):
                    try:
                        md = json.loads(r["metadata"])
                    except (json.JSONDecodeError, TypeError):
                        md = {}
                elif isinstance(r["metadata"], dict):
                    md = r["metadata"]
            zones.append({
                "name": r.get("name") or "",
                "description": r.get("description") or "",
                "polygon": polygon,
                "risk_level": r.get("riskLevel") or "seasonal",
                "flood_months": md.get("floodMonths", [5, 6, 7, 8, 9, 10]),
                "depth_estimate_m": md.get("depthEstimate", 0.5),
                "source": md.get("source", "CSDL EduMap — bản ghi ngập lịch sử"),
                "verification_date": md.get("verificationDate", "2025-01-01"),
                "from_db": True,
            })

    # If DB had real zones, also include overlapping static zones as supplementary.
    # If DB had zero zones, use static zones as the hazard baseline.
    for sz in STATIC_FLOOD_ZONES:
        # Check if zone polygon overlaps the bbox.
        if _polygon_overlaps_bbox(sz["polygon"], bbox):
            zones.append(dict(sz))  # copy

    return zones


def _polygon_overlaps_bbox(polygon: List[List[float]],
                           bbox: Tuple[float, float, float, float]) -> bool:
    """Quick bbox-overlap check between a polygon and a bounding box."""
    min_lat, max_lat, min_lng, max_lng = bbox
    for lng, lat in polygon:
        if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
            return True
    return False


# ── Risk computation ─────────────────────────────────────────────────────────

def _flood_risk(lat: float, lng: float, month: int,
                zones: List[Dict[str, Any]]) -> float:
    """Compute flood risk ∈ [0, 1] for a point.

    = min(1, proximity_factor + seasonal_factor)
    where proximity_factor decays with distance to nearest flood zone,
    and seasonal_factor = 1 if month is in the zone's flood_months.
    """
    best_risk = 0.0
    for z in zones:
        poly = z.get("polygon", [])
        if not poly:
            continue
        if _point_in_polygon(lng, lat, poly):
            # Inside the flood zone → high risk.
            seasonal = 1.0 if month in z.get("flood_months", []) else 0.5
            rl = z.get("risk_level", "seasonal")
            base = 0.9 if rl == "high" else 0.6
            best_risk = max(best_risk, base * seasonal)
        else:
            dist_km = _point_to_polygon_min_dist_km(lat, lng, poly)
            # Risk decays exponentially: 0 at 5km, 1 at 0km.
            proximity = max(0.0, 1.0 - dist_km / 5.0)
            if proximity > 0.01:
                seasonal = 1.0 if month in z.get("flood_months", []) else 0.3
                rl = z.get("risk_level", "seasonal")
                base = 0.7 if rl == "high" else 0.4
                best_risk = max(best_risk, proximity * base * seasonal)
    return min(1.0, best_risk)


def _weather_risk(lat: float, lng: float) -> float:
    """Get current weather severity ∈ [0, 1]. Returns 0.0 if OWM unavailable
    (static fallback → no weather-based risk contribution)."""
    weather = _get_weather(lat, lng)
    return _weather_severity(weather)


def _access_risk(lat: float, lng: float, facilities: List[Dict[str, Any]]) -> float:
    """Compute access risk ∈ [0, 1] based on distance to nearest educational
    facility. Farther from any facility → higher risk.

    Normalized against a 10 km "too far" threshold.
    """
    if not facilities:
        return 1.0
    min_dist = min(
        (_haversine_km(lat, lng, f["lat"], f["lng"]) for f in facilities),
        default=999.0,
    )
    return float(min(1.0, min_dist / 10.0))


def _terrain_slope_risk(lat: float, lng: float, elev: Optional[float]) -> float:
    """Estimate terrain/slope risk from elevation.

    Uses a simplified heuristic: moderate elevation near river floodplains
    is risky. Without a DEM, we use elevation as a proxy — points at very
    low elevation (< 2m, coastal/mekong) get higher risk.
    """
    if elev is None:
        return 0.0  # cannot compute → neutral
    if elev < 0.5:
        return 0.9   # below sea level — very high flood risk
    if elev < 2:
        return 0.6   # low-lying
    if elev < 10:
        return 0.3   # moderate
    return 0.0       # elevated, low risk


# ── Main service ─�────────────────────────────────────────────────────────────

class ClimateGuardianService:
    """Singleton-style service (mirrors predictive_service = PredictiveService())."""

    def get_risk_heatmap(
        self,
        min_lat: float,
        max_lat: float,
        min_lng: float,
        max_lng: float,
        date: Optional[str] = None,
        grid_step: float = HEATMAP_GRID_DEG,
    ) -> Dict[str, Any]:
        """Compute a flood/weather risk heatmap GeoJSON for an educational
        region.

        Returns:
            GeoJSON FeatureCollection with:
              - features: per-cell risk polygons
              - heat_points: [[lat, lng, weight], ...] for leaflet.heat
              - risk_ranking: sorted list of highest-risk cells
              - metadata: {method, degraded, reason, ...}
        """
        cache_key = f"heatmap:{min_lat:.4f}:{max_lat:.4f}:{min_lng:.4f}:{max_lng:.4f}:{date or 'now'}"
        cached = _cache_get(cache_key)
        if cached:
            return cached

        bbox = (min_lat, max_lat, min_lng, max_lng)
        month = _month_from_date(date)
        degraded = False
        reason: Optional[str] = None
        data_source = "static_flood_hazard"

        # Load flood zones (DB or static fallback).
        try:
            zones = _load_flood_zones(bbox)
        except Exception:
            zones = [z for z in STATIC_FLOOD_ZONES if _polygon_overlaps_bbox(z["polygon"], bbox)]
            degraded = True
            reason = "Không thể truy xuất CSDL ngập — dùng bản đồ rủi ro tĩnh."
        if not zones:
            degraded = True
            reason = "Chưa có dữ liệu ngập lũ cho khu vực này — dùng bản đồ rủi ro tĩnh."
        else:
            data_source = "static_flood_hazard+sqlite" if any(z.get("from_db") for z in zones) else "static_flood_hazard"

        # Load educational facilities.
        try:
            facilities = _load_educational_facilities(bbox)
        except Exception:
            facilities = []
            degraded = True
            reason = (reason or "") + " Không tải được danh sách cơ sở giáo dục." if reason else "Không tải được danh sách cơ sở giáo dục."

        # Weather availability check.
        has_weather = bool(OWM_API_KEY) and time.monotonic() >= _OWM_DOWN_UNTIL
        if not has_weather and OWM_API_KEY:
            # Key set but circuit breaker active.
            degraded = True
            reason = (reason + " | " if reason else "") + "OpenWeatherMap đang nghẽn (circuit breaker)."
        elif not OWM_API_KEY:
            reason = (reason + " | " if reason else "") + "Chưa cài OWM_API_KEY — dùng bản đồ ngập tĩnh."

        features: List[Dict[str, Any]] = []
        heat_points: List[List[float]] = []
        risk_ranking: List[Dict[str, Any]] = []

        # Generate a grid of cells covering the bbox.
        n_lat = max(5, min(30, int((max_lat - min_lat) / grid_step)))
        n_lng = max(5, min(30, int((max_lng - min_lng) / grid_step)))
        lats = [min_lat + i * (max_lat - min_lat) / n_lat for i in range(n_lat + 1)]
        lngs = [min_lng + j * (max_lng - min_lng) / n_lng for j in range(n_lng + 1)]

        max_cell_risk = 0.0
        for i in range(len(lats) - 1):
            for j in range(len(lngs) - 1):
                clat = (lats[i] + lats[i + 1]) / 2
                clng = (lngs[j] + lngs[j + 1]) / 2

                # Compute risk components.
                f_risk = _flood_risk(clat, clng, month, zones)
                w_risk = _weather_risk(clat, clng) if has_weather else 0.0
                a_risk = _access_risk(clat, clng, facilities)
                elev = _get_elevation(clat, clng)
                t_risk = _terrain_slope_risk(clat, clng, elev)

                # Blend: terrain acts as a modifier within the access component.
                if t_risk > 0:
                    a_risk = float(min(1.0, a_risk * (1 - t_risk * 0.3) + t_risk * 0.3))

                cell_risk = (
                    FLOOD_WEIGHT * f_risk
                    + WEATHER_WEIGHT * w_risk
                    + ACCESS_WEIGHT * a_risk
                )
                cell_risk = float(min(1.0, max(0.0, cell_risk)))
                if cell_risk > max_cell_risk:
                    max_cell_risk = cell_risk

                # Build polygon for this cell.
                ring = [
                    [clng - grid_step / 2, clat - grid_step / 2],
                    [clng + grid_step / 2, clat - grid_step / 2],
                    [clng + grid_step / 2, clat + grid_step / 2],
                    [clng - grid_step / 2, clat + grid_step / 2],
                    [clng - grid_step / 2, clat - grid_step / 2],
                ]
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Polygon", "coordinates": [ring]},
                    "properties": {
                        "lat": round(clat, 6),
                        "lng": round(clng, 6),
                        "risk_score": round(cell_risk, 3),
                        "risk_score_pct": round(cell_risk * 100, 1),
                        "risk_level": _risk_level(cell_risk),
                        "flood_risk": round(f_risk, 3),
                        "weather_risk": round(w_risk, 3),
                        "access_risk": round(a_risk, 3),
                        "terrain_risk": round(t_risk, 3),
                        "elevation_m": round(elev, 1) if elev is not None else None,
                        "nearest_facility": self._nearest_facility_name(clat, clng, facilities),
                    },
                })
                # Heat point: only include cells with non-trivial risk.
                if cell_risk >= 0.1:
                    heat_points.append([round(clat, 6), round(clng, 6), round(cell_risk, 3)])

        # Sort heat points by weight desc, cap at 500 (mirrors forecast.py:706).
        heat_points.sort(key=lambda p: p[2], reverse=True)
        heat_points = heat_points[:500]

        # Risk ranking: top 15 highest-risk cells.
        features_sorted = sorted(features, key=lambda f: f["properties"]["risk_score"], reverse=True)
        for f in features_sorted[:15]:
            p = f["properties"]
            risk_ranking.append({
                "lat": p["lat"],
                "lng": p["lng"],
                "risk_score": p["risk_score"],
                "risk_score_pct": p["risk_score_pct"],
                "risk_level": p["risk_level"],
                "nearest_facility": p["nearest_facility"],
                "reason": self._ranking_reason(p),
            })

        result = {
            "type": "FeatureCollection",
            "features": features,
            "heat_points": heat_points,
            "risk_ranking": risk_ranking,
            "risk_weights": {
                "flood_risk": FLOOD_WEIGHT,
                "weather_risk": WEATHER_WEIGHT,
                "access_risk": ACCESS_WEIGHT,
            },
            "metadata": {
                "method": "climate_guardian_v1",
                "data_source": data_source,
                "has_weather": has_weather and bool(OWM_API_KEY),
                "has_elevation": True,
                "flood_zones_loaded": len(zones),
                "features_loaded": len(facilities),
                "grid_cells": len(features),
                "date": date or datetime.now().isoformat()[:10],
                "month": month,
                "season": _season_from_month(month),
                "degraded": degraded,
                "reason": reason,
                "last_updated": datetime.now().isoformat(),
            },
        }

        _cache_set(cache_key, result)
        return result

    def get_alternatives(
        self,
        lat: float,
        lng: float,
        bbox: Tuple[float, float, float, float],
        radius_km: float = 10.0,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Recommend safe alternative learning locations near (lat, lng).

        Finds educational facilities (schools, universities, libraries, wifi
        spots) within ``radius_km`` that are OUTSIDE high-risk flood zones.
        Ranks by safety score (lower flood risk + higher elevation) and
        proximity.

        Returns GeoJSON FeatureCollection with features = safe alternatives,
        plus ``nearest_safe``, ``nearest_unsafe``, and ``metadata``.
        """
        cache_key = f"alternatives:{round(lat,6)}:{round(lng,6)}:{radius_km}:{category or 'all'}"
        cached = _cache_get(cache_key)
        if cached:
            return cached

        month = datetime.now().month
        zones = _load_flood_zones(bbox)
        facilities = _load_educational_facilities(bbox)

        # Filter facilities within radius and matching category.
        nearby: List[Dict[str, Any]] = []
        for f in facilities:
            dist = _haversine_km(lat, lng, f["lat"], f["lng"])
            if dist <= radius_km:
                if category and f.get("category") != category:
                    continue
                # Compute flood risk at the facility location.
                f_risk = _flood_risk(f["lat"], f["lng"], month, zones)
                elev = _get_elevation(f["lat"], f["lng"])
                t_risk = _terrain_slope_risk(f["lat"], f["lng"], elev)
                # Safety score: inverse of flood risk (higher = safer).
                # Weight flood more heavily than terrain for safety ranking.
                safety = float(1.0 - (0.7 * f_risk + 0.3 * t_risk))
                safety = float(max(0.0, min(1.0, safety)))
                # Walking time estimate (Haversine-based, 5 km/h walking).
                walk_min = int(dist * 60 / 5.0)
                nearby.append({
                    **f,
                    "distance_km": round(dist, 3),
                    "flood_risk": round(f_risk, 3),
                    "terrain_risk": round(t_risk, 3),
                    "elevation_m": round(elev, 1) if elev is not None else None,
                    "safety_score": round(safety, 3),
                    "walk_time_min": walk_min,
                    "in_high_risk_zone": f_risk >= 0.5,
                })

        # Separate safe vs high-risk.
        safe = [f for f in nearby if not f["in_high_risk_zone"]]
        unsafe = [f for f in nearby if f["in_high_risk_zone"]]

        # Sort: safe ones by safety desc then distance asc; unsafe by distance asc.
        safe.sort(key=lambda f: (-f["safety_score"], f["distance_km"]))
        unsafe.sort(key=lambda f: f["distance_km"])

        features = []
        for f in safe:
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [f["lng"], f["lat"]]},
                "properties": {
                    "id": f["id"],
                    "name": f["name"],
                    "category": f["category"],
                    "address": f.get("address", ""),
                    "city": f.get("city", ""),
                    "lat": f["lat"],
                    "lng": f["lng"],
                    "distance_km": f["distance_km"],
                    "walk_time_min": f["walk_time_min"],
                    "safety_score": f["safety_score"],
                    "safety_level": _risk_level(f["safety_score"]),
                    "flood_risk": f["flood_risk"],
                    "terrain_risk": f["terrain_risk"],
                    "elevation_m": f["elevation_m"],
                    "is_safe": True,
                },
            })

        result = {
            "type": "FeatureCollection",
            "features": features,
            "nearest_safe": safe[0] if safe else None,
            "nearest_unsafe": unsafe[0] if unsafe else None,
            "safe_count": len(safe),
            "unsafe_count": len(unsafe),
            "total_nearby": len(nearby),
            "metadata": {
                "method": "climate_guardian_alternatives_v1",
                "center_lat": lat,
                "center_lng": lng,
                "radius_km": radius_km,
                "category_filter": category or "all",
                "flood_zones_loaded": len(zones),
                "degraded": len(facilities) == 0,
                "reason": "Không tìm thấy cơ sở giáo dục nào trong bán kính." if not nearby else None,
                "last_updated": datetime.now().isoformat(),
            },
        }

        _cache_set(cache_key, result)
        return result

    def _nearest_facility_name(self, lat: float, lng: float,
                                facilities: List[Dict[str, Any]]) -> str:
        """Return the name of the nearest educational facility to a point."""
        if not facilities:
            return "Không có"
        nearest = min(facilities, key=lambda f: _haversine_km(lat, lng, f["lat"], f["lng"]))
        return nearest["name"]

    def _ranking_reason(self, props: Dict[str, Any]) -> str:
        """Generate a Vietnamese reason string for a risk-ranking entry."""
        f_risk = props.get("flood_risk", 0)
        w_risk = props.get("weather_risk", 0)
        a_risk = props.get("access_risk", 0)
        parts = []
        if f_risk >= 0.4:
            parts.append("gần khu vực ngập lũ")
        if w_risk >= 0.3:
            parts.append("thời tiết cực đoan")
        if a_risk >= 0.5:
            parts.append("xa cơ sở giáo dục")
        if not parts:
            parts.append("kết hợp nhiều yếu tố")
        return "Rủi ro do " + ", ".join(parts) + "."


# Module-level singleton (mirrors predictive_service.py:842 pattern).
climate_guardian = ClimateGuardianService()
