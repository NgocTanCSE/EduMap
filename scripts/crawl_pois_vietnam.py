#!/usr/bin/env python3
"""
crawl_pois_vietnam.py — Nightly crawler for "nơi tiện ích sinh viên"
(chợ / markets + Bách hóa Xanh / convenience stores) into EduMap's `map_points`.

Replaces the Overpass API (blocked on HF Spaces egress) with Tavily AI
search + extract (https://api.tavily.com — reachable from HF Spaces).

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  The previous version
  of this script POSTed Overpass QL queries to https://overpass-api.de which
  is **blocked at HF Spaces egress**.  This version uses Tavily Search + Extract
  to find Vietnamese web pages listing markets and convenience stores, then
  parses coordinates from the extracted article text.

  When TAVILY_API_KEY is absent or Tavily is unreachable, the script returns
  0 POIs (graceful — never crashes).  The curated snapshots in the seed data
  provide the core Đồng Nai coverage.

Design
------
* Data source: Tavily Search + Extract API (Bearer: TAVILY_API_KEY).
* Location expansion: Đồng Nai → miền Nam → VN (scope layers from crawl_scope).
* Deduplication: by name + 6-decimal coordinates.
* SQLite upsert (not PostGIS): the on-disk SQLite DB stores WKT ``POINT(lng lat)``
  in the ``location`` column (AGENTS.md §7: no PostGIS on SQLite).
* Configurable via environment.

Run
---
  python3 /app/scripts/crawl_pois_vietnam.py --db frontend/public/edumap.db
  CRAWL_DRY_RUN=1 python3 /app/scripts/crawl_pois_vietnam.py   # summary only

Scheduled (cron in Docker container) via run_overpass_seed.sh — loops
forever, sleeping until 00:30 each night, then runs once.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from typing import Iterable

# Share path with the crawler package.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "crawlers"))
from crawl_scope import (  # noqa: E402
    crawl_years, year_scope_range, LOCATION_LAYERS,
    DONG_NAI_BBOX, SOUTHERN_VN_BBOX, VIETNAM_BBOX,
)
from tavily_poi import search_pois_tavily, crawl_pois_markets  # noqa: E402

# Location expansion: start from Đồng Nai, then southern VN, then full Vietnam.
SCOPE_BBOXES = [
    ("dong_nai", DONG_NAI_BBOX),
    ("southern_vn", SOUTHERN_VN_BBOX),
    ("vietnam", VIETNAM_BBOX),
]
_YEAR_MIN, _YEAR_MAX = year_scope_range()

# --------------------------------------------------------------------------- #
# CONFIG (env override friendly)                                            #
# --------------------------------------------------------------------------- #
DEFAULT_BBOX = (8.0, 102.0, 23.5, 109.5)  # Vietnam fallback bbox
DRY_RUN = os.getenv("CRAWL_DRY_RUN", "0") == "1"
LOG_FILE = os.getenv("CRAWL_LOG", "/data/crawl_pois.log")
DEDUP_M = float(os.getenv("CRAWL_DEDUP_METERS", "50"))
TARGET = int(os.getenv("CRAWL_TARGET_POIS", "300"))
CAP = int(os.getenv("CRAWL_CAP_POIS", "500"))

# EduMap type_id mapping (must match backend MapPoint entity).
TYPE_MAP = {
    "market": 10,      # amenity=marketplace (chợ)
    "convenience": 11, # shop=convenience  (Bách hóa Xanh + other convenience)
}
BX_PATTERNS = ("bách hóa xanh", "bach hoa xanh", "bx", "bhc", "b.h.x")


# --------------------------------------------------------------------------- #
# LOGGING                                                                     #
# --------------------------------------------------------------------------- #
def log(msg: str) -> None:
    line = f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}] {msg}"
    print(line, flush=True)
    try:
        os.makedirs(os.path.dirname(LOG_FILE) or ".", exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except OSError:
        pass  # container fs not ready yet — stdout is enough


# --------------------------------------------------------------------------- #
# Tavily-based POI fetching (replaces Overpass tile fetch)                    #
# --------------------------------------------------------------------------- #

def fetch_tile(scope_label: str, layer_label: str, category: str,
               location_scope: str = "vietnam") -> list[dict]:
    """Fetch POI for one (query, scope) via Tavily.

    The original Overpass version split each bbox into tiles and POSTed an OSM
    query per tile.  Tavily doesn't do geographic bbox queries — instead we
    use Vietnamese-language search queries scoped to the location layer.
    """
    queries_by_scope = {
        "dong_nai": [
            f"{category} {layer_label} Đồng Nai địa chỉ tọa độ",
            f"{category} Biên Hòa {layer_label} địa chỉ",
        ],
        "southern_vn": [
            f"{category} {layer_label} TP Hồ Chí Minh tọa độ",
            f"{category} {layer_label} miền Nam Việt Nam",
        ],
        "vietnam": [
            f"{category} {layer_label} Việt Nam 2025",
            f"{category} {layer_label} toàn quốc tọa độ",
        ],
    }
    queries = queries_by_scope.get(scope_label, queries_by_scope["vietnam"])
    results = []
    for q in queries:
        pois = search_pois_tavily(q, category=category, location_scope=location_scope,
                                  max_results=8)
        results.extend(pois)
        time.sleep(0.5)  # Rate-limiting
    return results


# --------------------------------------------------------------------------- #
# DB UPSERT (SQLite — AGENTS.md §7: no PostGIS on SQLite)                     #
# --------------------------------------------------------------------------- #
DB_PATH = os.getenv("DB_SQLITE_PATH", os.getenv("DB_PATH", "/app/frontend/public/edumap.db"))


def upsert_sqlite(conn, pois: list[dict]) -> tuple[int, int]:
    """Upsert POI rows into the SQLite ``map_points`` table (WKT POINT geometry).

    Uses ``INSERT OR REPLACE`` with name + lat + lng as the dedup key.
    The ``location`` column stores ``POINT(lng lat)`` (WKT), which SQLite
    can store natively (AGENTS.md §7: PostGIS functions like ST_MakePoint
    don't work on SQLite — we use WKT strings instead).
    """
    inserted = skipped = 0
    if DRY_RUN:
        return 0, 0
    cur = conn.cursor()
    for p in pois:
        lat = round(p["lat"], 7)
        lng = round(p["lng"], 7)
        name = p["name"][:255]
        # Check for existing row with same name + approximate coordinates.
        cur.execute(
            "SELECT 1 FROM map_points WHERE name = ? AND location = ? LIMIT 1",
            (name, f"POINT({lng} {lat})"),
        )
        if cur.fetchone():
            skipped += 1
            continue
        category = p.get("category", "market")
        desc = p.get("description", "")[:500]
        if category == "convenience":
            desc = "Cửa hàng tiện dịch vụ tự động crawl từ Tavily" + (f" | {desc}" if desc else "")
        else:
            desc = "Chợ/cửa hàng tự động crawl từ Tavily" + (f" | {desc}" if desc else "")
        cur.execute("""
            INSERT OR REPLACE INTO map_points (
                name, description, category, location, address, city,
                province, location_scope, source, crawl_year, status, verified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)
        """, (
            name, desc, category, f"POINT({lng} {lat})",
            p.get("address", "")[:300],
            p.get("city", ""), p.get("province", ""),
            p.get("location_scope", "vietnam"),
            "tavily", _YEAR_MAX,
        ))
        inserted += 1
    conn.commit()
    return inserted, skipped


# --------------------------------------------------------------------------- #
# MAIN                                                                        #
# --------------------------------------------------------------------------- #
def parse_args(argv: list[str]) -> dict:
    cfg = {"DRY_RUN": DRY_RUN, "BBOX": DEFAULT_BBOX, "TARGET": TARGET, "CAP": CAP}
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == "--dry-run":
            cfg["DRY_RUN"] = True
        elif a == "--bbox" and i + 4 < len(argv):
            cfg["BBOX"] = (float(argv[i + 1]), float(argv[i + 2]), float(argv[i + 3]), float(argv[i + 4]))
            i += 4
        elif a == "--db" and i + 1 < len(argv):
            cfg["DB_PATH"] = argv[i + 1]
            i += 1
        i += 1
    return cfg


def main(argv: list[str] | None = None) -> int:
    cfg = parse_args(sys.argv if argv is None else argv)
    db_path = cfg.get("DB_PATH", DB_PATH)
    _CY = crawl_years()
    print(f"  [poi] crawl_years={_CY} | scope layers: {[l['label'] for l in LOCATION_LAYERS]}")
    print(f"  [poi] Tavily-based crawl (Overpass API blocked on HF Spaces)")
    log(f"Crawl start — dry_run={cfg['DRY_RUN']} source=tavily bbox={cfg['BBOX']}")
    log(f"  [scope] crawl_years={_CY} | location layers={[l['label'] for l in LOCATION_LAYERS]}")
    log("  Source: Tavily AI Search + Extract (https://api.tavily.com)")

    if cfg["DRY_RUN"]:
        log("  DRY RUN — no DB writes.")
        conn = None
    else:
        import sqlite3
        if not os.path.exists(db_path):
            log(f"  ! DB not found: {db_path} — continuing in DRY-RUN mode.")
            conn = None
        else:
            conn = sqlite3.connect(db_path)

    # Crawl markets + convenience stores, walking the location expansion layers.
    pois = crawl_pois_markets(SCOPE_BBOXES)

    # Filter to the specified bbox (if custom bbox provided).
    if cfg.get("BBOX") and cfg["BBOX"] != DEFAULT_BBOX:
        s, w, n, e = cfg["BBOX"]
        pois = [p for p in pois if s <= p["lat"] <= n and w <= p["lng"] <= e]

    # De-dup by category + lowercase name + 6-decimal coords.
    by_key: set[tuple] = set()
    uniq: list[dict] = []
    for p in pois:
        k = (p["category"], p["name"].lower(), round(p["lat"], 6), round(p["lng"], 6))
        if k in by_key:
            continue
        by_key.add(k)
        uniq.append(p)
        if len(uniq) >= cfg["CAP"]:
            break

    markets = [p for p in uniq if p["category"] == "market"]
    convenience = [p for p in uniq if p["category"] == "convenience"]
    bx = sum(1 for p in uniq if any(pt in p["name"].lower() for pt in BX_PATTERNS))

    layer_counts = {}
    for p in uniq:
        ls = p.get("location_scope", "vietnam")
        layer_counts[ls] = layer_counts.get(ls, 0) + 1

    log(f"  collected {len(uniq)} unique POIs "
        f"({len(markets)} markets, {len(convenience)} convenience, "
        f"{bx} Bách Hóa Xanh).")
    log(f"  per-layer: {layer_counts}")

    inserted = skipped = 0
    if conn:
        inserted, skipped = upsert_sqlite(conn, uniq)
        conn.close()
    log(f"  DB: inserted={inserted} skipped={skipped} dry_run={cfg['DRY_RUN']}")
    log(f"  [scope] crawl_years={_CY} | layers={layer_counts}")
    log("Crawl done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
