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

Scheduled (supervisord, see infrastructure/docker/supervisord.conf) — loops
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

# --------------------------------------------------------------------------- #
# CONFIG (env override friendly — the HF container already exports DB_* / etc.) #
# --------------------------------------------------------------------------- #
DEFAULT_BBOX = (8.0, 102.0, 23.5, 109.5)  # (south, west, north, east) — Vietnam

CONFIG = {
    "OVERPASS_URL":    os.getenv("CRAWL_OVERPASS_URL", "https://overpass-api.de/api/interpreter"),
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
    """POST an Overpass QL snippet, returning the parsed JSON with retries/backoff."""
    payload = query.encode("utf-8")
    attempt = 0
    while True:
        attempt += 1
        req = urllib.request.Request(
            CONFIG["OVERPASS_URL"],
            data=payload,
            headers={
                "Content-Type": "text/plain; charset=utf-8",
                "Accept": "application/json",
                "User-Agent": "EduMap-crawler/1.0 (+https://edumap.vn)",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=CONFIG["TIMEOUT"] + 5) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError,
                ConnectionError, json.JSONDecodeError) as exc:
            if attempt >= CONFIG["MAX_RETRIES"]:
                log(f"  ! overpass failed after {attempt} attempts: {exc}")
                return {"elements": []}
            wait = 2 ** attempt
            log(f"  retry {attempt}/{CONFIG['MAX_RETRIES']} in {wait}s ({exc})")
            time.sleep(wait)


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
               osm_tag: str) -> list[dict]:
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
    log(f"Crawl start — bbox={bbox} tile={step}° dry_run={cfg['DRY_RUN']} overpass={cfg['OVERPASS_URL']}")

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
    # fetch_tile now queries node + way + relation for each, so polygon markets are no longer skipped.
    # `kind` is derived from the tag (anything with "market" -> market; "convenience" -> convenience).
    targets = ["amenity=marketplace", "shop=market", "shop=convenience"]

    for (lat_s, lon_w, lat_n, lon_e) in tiles(bbox, step):
        for tag in targets:
            els = fetch_tile(lat_s, lon_w, lat_n, lon_e, tag)
            for el in els:
                osm_key = (el["osm_id"] if isinstance(el["osm_id"], int) else 0, el["name"], round(el["lat"], 6), round(el["lng"], 6))
                if osm_key in seen_osm:
                    continue
                if cfg["LIMIT_PER_TYPE"] and len([x for x in pois if x["category"] == el["category"]]) >= cfg["LIMIT_PER_TYPE"]:
                    continue
                seen_osm.add(osm_key)
                pois.append(el)
            time.sleep(cfg["SLEEP_BETWEEN"])

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
    log(f"  collected {len(uniq)} unique POIs "
        f"({sum(1 for p in uniq if p['category']=='market')} markets, "
        f"{sum(1 for p in uniq if p['category']=='convenience')} convenience, "
        f"{bx} Bách Hóa Xanh).")

    inserted = skipped = 0
    if conn:
        inserted, skipped = upsert(conn, uniq)
        conn.close()
    log(f"  DB: inserted={inserted} skipped={skipped} dry_run={cfg['DRY_RUN']}")
    log("Crawl done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
