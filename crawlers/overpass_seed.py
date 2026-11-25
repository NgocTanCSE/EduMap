"""
Overpass POI seed — lấy POI giáo dục/wifi thật từ OpenStreetMap (Overpass mirror)
và upsert vào Postgres (map_points + locations).

Chỉ đọc dữ liệu công khai đã publish trên OpenStreetMap; không bịa name/toạ độ,
description luôn kết thúc bằng provenance chuẩn AGENTS.md §26.

CLI:
  python3 crawlers/overpass_seed.py --bbox "10.75,106.60,11.20,107.20" --dry-run
"""

from __future__ import annotations

import json
import os
import socket
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone

OVERPASS_ENDPOINTS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]
USER_AGENT = "EduMapCrawler/1.0"
REQUEST_TIMEOUT_S = 90
DEFAULT_BBOX = "10.75,106.60,11.20,107.20"
DEFAULT_SCOPE = "dong_nai"
OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright"

EDU_AMENITIES = "school|university|library|kindergarten|college|language_school"
STUDY_AMENITIES = "cafe|library|community_centre"

WIFI_CATEGORY_ID = 6
AMENITY_LOCATION_CATEGORY_ID = {"university": 1, "school": 2, "library": 3, "cafe": 8}

_INTERNET_ACCESS_LABELS = {
    "yes": "có internet",
    "wlan": "wifi không dây",
    "terminal": "máy tính kết nối internet dùng chung",
    "no": "không có internet",
}

_good_endpoint = 0
_ipv4_patched = False
_LAST_QUERY_STATS: list[tuple[int, int]] = []


def _force_ipv4() -> None:
    global _ipv4_patched
    if _ipv4_patched:
        return
    _orig = socket.getaddrinfo

    def _ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        return _orig(host, port, socket.AF_INET, type=type, proto=proto, flags=flags)

    socket.getaddrinfo = _ipv4_getaddrinfo
    _ipv4_patched = True


def _parse_bbox(bbox: str) -> str:
    parts = [p.strip() for p in bbox.split(",")]
    if len(parts) != 4:
        raise ValueError(f"bbox phải có 4 giá trị S,W,N,E: {bbox!r}")
    s, w, n, e = (float(p) for p in parts)
    if not (s < n and w < e):
        raise ValueError(f"bbox sai thứ tự (cần S,W,N,E): {bbox!r}")
    return f"{s},{w},{n},{e}"


def _query_union(selector: str, coords: str) -> str:
    return f"[out:json][timeout:{REQUEST_TIMEOUT_S}];(node{selector}({coords});way{selector}({coords}););out center tags;"


def _build_queries(coords: str) -> list[str]:
    edu = f'["amenity"~"^{EDU_AMENITIES}$"][name]'
    study = f'["amenity"~"^{STUDY_AMENITIES}$"]["internet_access"~"^(yes|wlan|terminal)$"][name]'
    wlan = '["internet_access"="wlan"][name]'
    return [
        _query_union(edu, coords),
        _query_union(study, coords),
        _query_union(wlan, coords),
    ]


def _post_overpass(endpoint: str, ql: str) -> dict:
    body = urllib.parse.urlencode({"data": ql}).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _post_query(ql: str) -> dict:
    global _good_endpoint
    attempts = int(os.getenv("OVERPASS_RETRIES", "3"))
    last_err = None
    for attempt in range(attempts):
        order = OVERPASS_ENDPOINTS[_good_endpoint:] + OVERPASS_ENDPOINTS[:_good_endpoint]
        for endpoint in order:
            try:
                data = _post_overpass(endpoint, ql)
                _good_endpoint = OVERPASS_ENDPOINTS.index(endpoint)
                remark = (data.get("remark") or "").strip()
                if remark:
                    print(f"  [overpass] endpoint {endpoint} remark: {remark}")
                return data
            except Exception as exc:
                last_err = exc
                print(f"  [overpass] endpoint lỗi {endpoint}: {exc}")
                time.sleep(3.0)
        if attempt + 1 < attempts:
            wait = 20.0 * (attempt + 1)
            print(f"  [overpass] cả 3 endpoint lỗi (lần {attempt + 1}/{attempts}), chờ {wait:.0f}s thử lại")
            time.sleep(wait)
    raise RuntimeError(f"Cả 3 Overpass endpoint đều lỗi sau {attempts} vòng: {last_err}")


def _category_for(amenity: str) -> str:
    if amenity in ("school", "university", "kindergarten", "college", "language_school"):
        return "school"
    if amenity == "library":
        return "library"
    if amenity == "cafe":
        return "cafe"
    return "wifi"


def _address_from_tags(tags: dict) -> str:
    house = (tags.get("addr:housenumber") or "").strip()
    street = (tags.get("addr:street") or "").strip()
    city = (tags.get("addr:city") or "").strip()
    street_part = f"{house} {street}".strip()
    parts = [p for p in (street_part, city) if p]
    return ", ".join(parts)


def _build_description(category: str, tags: dict) -> str:
    parts = []
    access = (tags.get("internet_access") or "").strip()
    label = _INTERNET_ACCESS_LABELS.get(access)
    if label:
        parts.append(f"internet: {label}")
    if (tags.get("outdoor_seating") or "").strip() == "yes":
        parts.append("có chỗ ngồi ngoài trời")
    hours = (tags.get("opening_hours") or "").strip()
    if hours:
        parts.append(f"giờ mở cửa: {hours}")
    cuisine = (tags.get("cuisine") or "").strip()
    if cuisine:
        parts.append("món: " + cuisine.replace(";", ", "))
    operator = (tags.get("operator") or "").strip()
    if operator and category not in ("wifi", "cafe"):
        parts.append(f"đơn vị: {operator}")
    body = " · ".join(parts)
    if category in ("wifi", "cafe"):
        return f"Quán/cafe có wifi — {body}" if body else "Quán/cafe có wifi"
    if category == "library":
        base = "Thư viện ghi nhận trên OpenStreetMap"
    else:
        base = "Trường học/cơ sở giáo dục ghi nhận trên OpenStreetMap"
    return f"{base} — {body}" if body else base


def _to_poi(el: dict, date_str: str, scope: str):
    tags = el.get("tags") or {}
    name = (tags.get("name") or "").strip()
    etype = el.get("type")
    if etype == "node":
        lat, lng = el.get("lat"), el.get("lon")
    elif etype == "way":
        center = el.get("center") or {}
        lat, lng = center.get("lat"), center.get("lon")
    else:
        lat, lng = None, None
    if not name or lat is None or lng is None:
        return None
    if len(name) < 3 or name.isdigit():
        return None
    amenity = (tags.get("amenity") or "").strip()
    category = _category_for(amenity)
    display = name
    if category in ("wifi", "cafe") and "wifi" not in name.lower():
        display = f"{name} — Wifi"
    description = _build_description(category, tags)
    description += f" Nguồn chính thức: {OSM_COPYRIGHT_URL} · Kiểm chứng: {date_str}"
    return {
        "name": display,
        "lat": float(lat),
        "lng": float(lng),
        "address": _address_from_tags(tags),
        "category": category,
        "amenity": amenity,
        "description": description,
        "source": "overpass",
        "source_url": f"https://www.openstreetmap.org/{etype}/{el.get('id')}",
        "photos": [],
        "location_scope": scope,
    }


def fetch_overpass_pois(bbox: str) -> list[dict]:
    _force_ipv4()
    coords = _parse_bbox(bbox)
    scope = os.getenv("OVERPASS_SCOPE", DEFAULT_SCOPE)
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    max_elements = int(os.getenv("OVERPASS_MAX_ELEMENTS", "1200"))
    queries = _build_queries(coords)
    elements = []
    _LAST_QUERY_STATS.clear()
    for idx, ql in enumerate(queries, start=1):
        data = _post_query(ql)
        batch = data.get("elements") or []
        _LAST_QUERY_STATS.append((idx, len(batch)))
        print(f"  [overpass] query {idx}/{len(queries)} -> {len(batch)} elements")
        elements.extend(batch)
        time.sleep(1.0)
    seen = set()
    out = []
    per_cap = int(os.getenv("OVERPASS_MAX_PER_CATEGORY", "600"))
    cat_seen: dict[str, int] = {}
    for el in elements:
        poi = _to_poi(el, date_str, scope)
        if poi is None:
            continue
        cat = poi["category"]
        if cat_seen.get(cat, 0) >= per_cap:
            continue
        key = (poi["name"].lower(), round(poi["lat"], 5), round(poi["lng"], 5))
        if key in seen:
            continue
        seen.add(key)
        cat_seen[cat] = cat_seen.get(cat, 0) + 1
        out.append(poi)
        if len(out) >= max_elements:
            print(f"  [overpass] đạt cap OVERPASS_MAX_ELEMENTS={max_elements}")
            break
    print(f"  [overpass] per-category: {dict(cat_seen)} (cap {per_cap}/loại)")
    return out


def _location_category_id(p: dict):
    if (p.get("category") or "") == "wifi":
        return WIFI_CATEGORY_ID
    return AMENITY_LOCATION_CATEGORY_ID.get((p.get("amenity") or "").strip())


def upsert_locations(conn, pois: list[dict]) -> tuple[int, int, int]:
    """Upsert vào bảng locations: dedup (name + 100m), không đụng dòng do user tạo."""
    from psycopg2.extras import Json

    inserted = updated = skipped = 0
    cur = conn.cursor()
    try:
        for p in pois:
            name = (p.get("name") or "")[:255]
            lat = round(float(p["lat"]), 7)
            lng = round(float(p["lng"]), 7)
            if not name:
                continue
            cur.execute(
                """
                SELECT id::text, created_by FROM locations
                WHERE LOWER(name) = LOWER(%s)
                  AND ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 100)
                LIMIT 1
                """,
                (name, lng, lat),
            )
            row = cur.fetchone()
            desc = (p.get("description") or "")[:500]
            source_url = (p.get("source_url") or "") or None
            if row:
                if row[1] is not None:
                    skipped += 1
                    continue
                cur.execute(
                    """
                    UPDATE locations
                    SET description = COALESCE(NULLIF(%s, ''), description),
                        source_url = COALESCE(%s, source_url),
                        updated_at = NOW()
                    WHERE id::text = %s
                    """,
                    (desc, source_url, row[0]),
                )
                updated += 1
                continue
            category_id = _location_category_id(p)
            photos = p.get("photos") or []
            cur.execute(
                """
                INSERT INTO locations (name, description, category_id, coordinates, address,
                                       photos, source_url, status, is_verified, created_at, updated_at)
                VALUES (%s, %s, %s,
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                        %s, %s, %s, 'active', false, NOW(), NOW())
                """,
                (
                    name,
                    desc,
                    category_id,
                    lng,
                    lat,
                    (p.get("address") or "") or None,
                    Json(photos) if photos else None,
                    source_url,
                ),
            )
            inserted += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
    return inserted, updated, skipped


def _db_preview_counts(pois: list[dict]):
    if not os.getenv("DB_HOST"):
        return None
    try:
        import psycopg2

        if os.path.dirname(os.path.abspath(__file__)) not in sys.path:
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from db_utils import DB_CFG

        conn = psycopg2.connect(**DB_CFG)
    except Exception as exc:
        print(f"  [overpass] không xem trước được DB: {exc}")
        return None
    ins = upd = skp = 0
    try:
        cur = conn.cursor()
        for p in pois:
            name = (p.get("name") or "")[:255]
            lat = round(float(p["lat"]), 7)
            lng = round(float(p["lng"]), 7)
            cur.execute(
                """
                SELECT id::text, created_by FROM locations
                WHERE LOWER(name) = LOWER(%s)
                  AND ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 100)
                LIMIT 1
                """,
                (name, lng, lat),
            )
            row = cur.fetchone()
            if row is None:
                ins += 1
            elif row[1] is not None:
                skp += 1
            else:
                upd += 1
        cur.close()
    except Exception as exc:
        print(f"  [overpass] DB preview lỗi: {exc}")
        return None
    finally:
        conn.close()
    return ins, upd, skp


def _write_databases(pois: list[dict]):
    scripts_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"
    )
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    from crawl_pois_vietnam import upsert_postgres

    import psycopg2

    if os.path.dirname(os.path.abspath(__file__)) not in sys.path:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from db_utils import DB_CFG

    map_inserted, map_skipped = upsert_postgres(pois)
    conn = psycopg2.connect(**DB_CFG)
    try:
        loc = upsert_locations(conn, pois)
    finally:
        conn.close()
    return map_inserted, map_skipped, loc


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    bbox = os.getenv("OVERPASS_BBOX", DEFAULT_BBOX)
    dry = False
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--bbox" and i + 1 < len(argv):
            bbox = argv[i + 1]
            i += 2
            continue
        if arg == "--dry-run":
            dry = True
        i += 1

    print(
        f"[overpass] bbox={bbox} scope={os.getenv('OVERPASS_SCOPE', DEFAULT_SCOPE)} "
        f"max={os.getenv('OVERPASS_MAX_ELEMENTS', '1200')}"
    )
    pois = fetch_overpass_pois(bbox)
    counts = Counter(p["category"] for p in pois)
    print(f"[overpass] sau dedup: {len(pois)} POI | theo category: {dict(counts)}")
    for cat in sorted(counts):
        samples = [p["name"] for p in pois if p["category"] == cat][:3]
        print(f"  {cat}: {counts[cat]} | mẫu: {' | '.join(samples)}")

    if dry:
        print("[overpass] DRY RUN — không ghi DB.")
        preview = _db_preview_counts(pois)
        if preview:
            print(
                f"  dự kiến insert={preview[0]} update={preview[1]} skip={preview[2]} "
                f"(đối chiếu DB, chỉ SELECT)"
            )
        else:
            print(
                f"  dự kiến insert ~{len(pois)} (chưa đối chiếu DB — đặt DB_HOST để xem trước)"
            )
        return 0

    map_inserted, map_skipped, (loc_ins, loc_upd, loc_skp) = _write_databases(pois)
    print(f"[overpass] map_points: inserted={map_inserted} skipped={map_skipped}")
    print(
        f"[overpass] locations: inserted={loc_ins} updated={loc_upd} skipped={loc_skp}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
