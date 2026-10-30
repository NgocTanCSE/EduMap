#!/usr/bin/env python3
"""
crawl_pois_vietnam.py — Nightly countrywide crawler for "nơi tiện ích sinh viên"
(chợ / markets + Bách hóa Xanh / convenience stores) into EduMap's `map_points`.

Design
------
* Data source: Overpass API (OpenStreetMap) — free, no API key required.
  We POST the query (large queries fail on GET) with an `Accept: application/json`
  header; `urllib.request` is used from the stdlib so NO extra Python deps are needed.
* Vietnam bbox is split into a grid of small tiles (default 1.5° ≈ 150 km) so a
  single Overpass request never times out (≤25 s / ≤2000 elements).
* Deduplication happens at two levels:
    1. In-memory by OSM element id (overpass may return the same node from
       overlapping neighbour tiles).
    2. In-DB by name + address + geographic proximity (≤50 m) before INSERT,
       mirroring the seed step-7 rule ("same name + <200 m → keep one").
* Upsert is idempotent — safe to run nightly: already-known POIs are skipped.
* Configurable via environment (see CONFIG section below) so the same script
  works in the HF container (localhost:5432) and in local dev.

Run
---
  python3 /app/scripts/crawl_pois_vietnam.py              # write to DB
  CRAWL_DRY_RUN=1 python3 /app/scripts/crawl_pois_vietnam.py   # summary only
  python3 /app/scripts/crawl_pois_vietnam.py --tile 1.0 --sleep 0.8

Scheduled (cron in Docker container) — loops
forever, sleeping until 00:30 each night, then runs once.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Iterable

# Share ONE Overpass HTTP client with the crawler package (Phase G consolidation).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "crawlers"))
from overpass_utils import overpass_post  # noqa: E402
from crawl_scope import (  # noqa: E402
    crawl_years, year_scope_range, LOCATION_LAYERS,
    DONG_NAI_BBOX, SOUTHERN_VN_BBOX, VIETNAM_BBOX,
)

# Location expansion: start from Đồng Nai, then southern VN, then full Vietnam.
# (Southeast Asia is not covered by this POI crawler — OSM data for chợ/markets
#  in neighboring countries is out of scope for EduMap's Vietnam-first product.)
SCOPE_BBOXES = [
    ("dong_nai", DONG_NAI_BBOX),
    ("southern_vn", SOUTHERN_VN_BBOX),
    ("vietnam", VIETNAM_BBOX),
]
_YEAR_MIN, _YEAR_MAX = year_scope_range()

# --------------------------------------------------------------------------- #
# CONFIG (env override friendly — the HF container already exports DB_* / etc.) #
# --------------------------------------------------------------------------- #
DEFAULT_BBOX = (8.0, 102.0, 23.5, 109.5)  # (south, west, north, east) — Vietnam (fallback)

CONFIG = {
    "OVERPASS_URL":    os.getenv("CRAWL_OVERPASS_URL", "https://overpass-api.de/api/interpreter"),
    "OVERPASS_MIRRORS":[m.strip() for m in os.getenv(
        "CRAWL_OVERPASS_MIRRORS",
        "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.openstreetmap.ru/api/interpreter"
    ).split(",") if m.strip()],
    "TILE_DEG":        float(os.getenv("CRAWL_TILE_DEG", "0.75")),
    "SLEEP_BETWEEN":   float(os.getenv("CRAWL_SLEEP", "1.0")),     # rate-limit Overpass (~1 req/s)
    "TIMEOUT":         int(os.getenv("CRAWL_TIMEOUT", "30")),
    "MAX_RETRIES":     int(os.getenv("CRAWL_MAX_RETRIES", "5")),
    "DEDUP_M":         float(os.getenv("CRAWL_DEDUP_METERS", "50")),
    "LIMIT_PER_TYPE":  int(os.getenv("CRAWL_LIMIT_PER_TYPE", "0")),  # 0 = no limit
    "DRY_RUN":         os.getenv("CRAWL_DRY_RUN", "0") == "1",
    "LOG_FILE":        os.getenv("CRAWL_LOG", "/data/crawl_pois.log"),
    # OSM → EduMap type_id (must match backend MapPoint entity getter/setter)
    "TYPE_MAP": {
        "market":      10,   # amenity=marketplace  (chợ)
        "convenience": 11,   # shop=convenience     (Bách hóa Xanh + other convenience)
    },
}

# DB connection — same defaults the HF container / seed scripts use.
DB_CFG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", "5432")),
    "user":     os.getenv("DB_USERNAME", "admin"),
    "password": os.getenv("DB_PASSWORD", "password123"),
    "database": os.getenv("DB_DATABASE", "edumap_db"),
}

# Name patterns that mark a convenience store as "Bách hóa xanh" (for reporting).
BX_PATTERNS = ("bách hóa xanh", "bach hoa xanh", "bx", "bhc", "b.h.x")


# --------------------------------------------------------------------------- #
# LOGGING                                                                     #
# --------------------------------------------------------------------------- #
def log(msg: str) -> None:
    line = f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}] {msg}"
    print(line, flush=True)
    try:
        os.makedirs(os.path.dirname(CONFIG["LOG_FILE"]) or ".", exist_ok=True)
        with open(CONFIG["LOG_FILE"], "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except OSError:
        pass  # container fs not ready yet — stdout is enough


# --------------------------------------------------------------------------- #
# OVERPASS CLIENT                                                             #
# --------------------------------------------------------------------------- #
def _overpass_post(query: str) -> dict:
    """POST an Overpass QL snippet with MIRROR ROTATION + retry/backoff.

    Now delegates to the shared `overpass_utils.overpass_post` (Phase G
    consolidation) — same mirror list / retry semantics crawl_pois used before,
    just one HTTP client for the whole repo.
    """
    return overpass_post(
        query,
        mirrors=CONFIG.get("OVERPASS_MIRRORS") or [CONFIG["OVERPASS_URL"]],
        timeout=CONFIG["TIMEOUT"],
        retries=CONFIG["MAX_RETRIES"],
        user_agent="EduMap-crawler/1.0 (+https://edumap.vn)",
        label="poi",
    )


def _tags(el: dict, *keys: str) -> str:
    tags = el.get("tags") or {}
    for k in keys:
        v = tags.get(k)
        if v:
            return v
    return ""


def _center(el: dict) -> tuple[float, float] | None:
    """Return (lat, lon) — from center (ways/relations) or the node's lat/lon."""
    if "lat" in el and "lon" in el:
        return float(el["lat"]), float(el["lon"])
    c = el.get("center")
    if c:
        try:
            return float(c["lat"]), float(c["lon"])
        except (TypeError, ValueError):
            return None
    return None


def _address(el: dict) -> str:
    t = el.get("tags") or {}
    addr = _tags(el, "addr:full") \
        or " ".join(s for s in (_tags(el, "addr:street"), _tags(el, "addr:housenumber")) if s) \
        or _tags(el, "addr:city") or _tags(el, "is_in:city") or _tags(el, "addr:postcode")
    return (addr or "").strip()[:300]


def fetch_tile(lat_s: float, lon_w: float, lat_n: float, lon_e: float,
               osm_tag: str, location_scope: str = "vietnam") -> list[dict]:
    """Query one tile for an OSM key=value pair across node + way + relation.

    Markets (chợ) are frequently mapped as `way`/area polygons in OSM — querying
    only `node` silently drops most of them. `out center` gives us a usable centroid
    for every geometry type.
    """
    q = (
        f"[out:json][timeout:{CONFIG['TIMEOUT']}];\n"
        f"(node[{osm_tag}]({lat_s:.6f},{lon_w:.6f},{lat_n:.6f},{lon_e:.6f});"
        f"way[{osm_tag}]({lat_s:.6f},{lon_w:.6f},{lat_n:.6f},{lon_e:.6f});"
        f"relation[{osm_tag}]({lat_s:.6f},{lon_w:.6f},{lat_n:.6f},{lon_e:.6f});)"
        f"out center meta;"
    )
    data = _overpass_post(q)
    out: list[dict] = []
    for el in data.get("elements", []):
        center = _center(el)
        if not center:
            continue
        lat, lon = center
        name = _tags(el, "name", "alt_name", "official_name")
        if not name:
            continue  # skip nameless elements (usually clutter)
        # amenity=marketplace / shop=market  -> 'market' (chợ); shop=convenience -> 'convenience'
        kind = "market" if "market" in osm_tag else "convenience"
        out.append({
            "osm_id": el.get("id"),
            "name": name.strip(),
            "category": kind,
            "lat": lat,
            "lng": lon,
            "address": _address(el),
            "is_bach_hoa_xanh": any(p in name.lower() for p in BX_PATTERNS),
            "location_scope": location_scope,
        })
    return out


def tiles(bbox: tuple[float, float, float, float], step: float) -> Iterable[tuple[float, float, float, float]]:
    """Yield (south, west, north, east) tiles covering the bbox."""
    south, west, north, east = bbox
    y = south
    while y < north:
        x = west
        while x < east:
            yield (y, x, min(y + step, north), min(x + step, east))
            x += step
        y += step


# --------------------------------------------------------------------------- #
# DB UPSERT (psycopg2 — already present in the HF image, same as the seed)    #
# --------------------------------------------------------------------------- #
def connect():
    import psycopg2  # imported lazily so --dry-run needs no DB
    return psycopg2.connect(**DB_CFG)


UPSERT_SQL = """
INSERT INTO map_points (name, type_id, address, description, city, status, location)
VALUES (%s, %s, %s, %s, %s, 'active',
        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)
-- Dedup is handled by the EXISTS guard in upsert() (name+address+~50m),
-- so repeated nightly runs never duplicate a POI we already ingested.
"""

EXISTS_SQL = """
SELECT 1 FROM map_points
WHERE type_id = %s AND name = %s AND address = %s
  AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
"""


def upsert(conn, pois: list[dict]) -> tuple[int, int]:
    """Return (inserted, skipped). Idempotent by name+address+~50 m."""
    inserted = skipped = 0
    if CONFIG["DRY_RUN"]:
        return 0, 0
    with conn, conn.cursor() as cur:
        for p in pois:
            lat = round(p["lat"], 7)
            lng = round(p["lng"], 7)
            type_id = CONFIG["TYPE_MAP"][p["category"]]
            cur.execute(EXISTS_SQL, (type_id, p["name"], p["address"], lng, lat, CONFIG["DEDUP_M"]))
            if cur.fetchone():
                skipped += 1
                continue
            cur.execute(UPSERT_SQL, (
                p["name"], type_id, p["address"] or "",
                "Tự động crawl từ OpenStreetMap" if p["category"] == "convenience" else "Chợ/cửa hàng tự động crawl từ OpenStreetMap",
                None,  # city left null — derived lazily if needed
                lng, lat,
            ))
            inserted += 1
    return inserted, skipped


# --------------------------------------------------------------------------- #
# MAIN                                                                        #
# --------------------------------------------------------------------------- #
def parse_args(argv: list[str]) -> dict:
    cfg = {k: v for k, v in CONFIG.items()}
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--dry-run":
            cfg["DRY_RUN"] = True
        elif a == "--bbox" and i + 4 < len(argv):
            cfg["BBOX"] = (float(argv[i + 1]), float(argv[i + 2]), float(argv[i + 3]), float(argv[i + 4]))
            i += 4
        elif a == "--tile" and i + 1 < len(argv):
            cfg["TILE_DEG"] = float(argv[i + 1]); i += 1
        elif a == "--sleep" and i + 1 < len(argv):
            cfg["SLEEP_BETWEEN"] = float(argv[i + 1]); i += 1
        i += 1
    return cfg


def main(argv: list[str] | None = None) -> int:
    cfg = parse_args(sys.argv if argv is None else argv)
    bbox = cfg.get("BBOX", DEFAULT_BBOX)
    step = cfg["TILE_DEG"]
    _CY = crawl_years()
    print(f"  [poi] crawl_years={_CY} | scope layers: {[l['label'] for l in LOCATION_LAYERS]}")
    print(f"  [poi] walking location expansion: Đồng Nai → miền Nam → Vietnam")
    log(f"Crawl start — bbox={bbox} tile={step}° dry_run={cfg['DRY_RUN']} overpass={cfg['OVERPASS_URL']}")
    print(f"  [scope] crawl_years={_CY} | years window=[{_YEAR_MIN}, {_YEAR_MAX}]")
    log(f"  [scope] crawl_years={_CY} | location layers={[l['label'] for l in LOCATION_LAYERS]}")

    if cfg["DRY_RUN"]:
        log("  DRY RUN — no DB writes.")
        conn = None
    else:
        try:
            conn = connect()
        except Exception as exc:  # noqa: BLE001
            log(f"  ! DB connect failed ({exc}) — continuing in DRY-RUN mode.")
            conn = None

    seen_osm: set[int] = set()
    pois: list[dict] = []
    # OSM key=value pairs to crawl: chợ (markets) + Bách hóa Xanh & other convenience.
    targets = ["amenity=marketplace", "shop=market", "shop=convenience"]

    # Walk the location expansion layers (single --bbox overrides everything).
    scope_bboxes = SCOPE_BBOXES if "BBOX" not in cfg else [("custom", bbox)]
    for layer_label, layer_bbox in scope_bboxes:
        layer_s, layer_w, layer_n, layer_e = map(float, layer_bbox.split(","))
        log(f"  Location layer: {layer_label} ({layer_bbox}) — {layer_n - layer_s:.1f}° × {layer_e - layer_w:.1f}°")
        for (lat_s, lon_w, lat_n, lon_e) in tiles((layer_s, layer_w, layer_n, layer_e), step):
            for tag in targets:
                els = fetch_tile(lat_s, lon_w, lat_n, lon_e, tag, location_scope=layer_label)
                for el in els:
                    osm_key = (el["osm_id"] if isinstance(el["osm_id"], int) else 0, el["name"], round(el["lat"], 6), round(el["lng"], 6))
                    if osm_key in seen_osm:
                        continue
                    if cfg["LIMIT_PER_TYPE"] and len([x for x in pois if x["category"] == el["category"]]) >= cfg["LIMIT_PER_TYPE"]:
                        continue
                    seen_osm.add(osm_key)
                    pois.append(el)
                time.sleep(cfg["SLEEP_BETWEEN"])

        if layer_label != scope_bboxes[-1][0]:
            log(f"  Completed layer '{layer_label}' — {len(pois)} POIs so far, expanding to next layer.")

    # De-dup again by exact coords+name (neighbour tiles / mixed node+way overlap).
    uniq: list[dict] = []
    by_key: set[tuple] = set()
    for p in pois:
        k = (p["category"], p["name"].lower(), round(p["lat"], 6), round(p["lng"], 6))
        if k in by_key:
            continue
        by_key.add(k)
        uniq.append(p)

    bx = sum(1 for p in uniq if p["is_bach_hoa_xanh"])
    layer_counts = {}
    for p in uniq:
        ls = p.get("location_scope", "vietnam")
        layer_counts[ls] = layer_counts.get(ls, 0) + 1
    log(f"  collected {len(uniq)} unique POIs "
        f"({sum(1 for p in uniq if p['category']=='market')} markets, "
        f"{sum(1 for p in uniq if p['category']=='convenience')} convenience, "
        f"{bx} Bách Hóa Xanh).")
    log(f"  per-layer: {layer_counts}")

    inserted = skipped = 0
    if conn:
        inserted, skipped = upsert(conn, uniq)
        conn.close()
    log(f"  DB: inserted={inserted} skipped={skipped} dry_run={cfg['DRY_RUN']}")
    log(f"  [scope] crawl_years={_CY} | layers={layer_counts}")
    log("Crawl done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
