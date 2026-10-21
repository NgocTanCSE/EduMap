# -*- coding: utf-8 -*-
"""
Events crawler -> `events` table (title UNIQUE).

Multiple Eventbrite search angles, ALL paginated (crawl nhiều trang, không chỉ
1-2):

  1. all-events listing — https://www.eventbrite.com/d/vietnam/all-events/?page=N
     walked up to PAGES pages (stops at first empty page).
  2. keyword queries   — same endpoint with &q=<keyword>&page=N for each keyword
     in QUERIES; surfaces events absent from the default all-events ordering.

Both passes are deduped globally by title so the same event from two query
angles is only inserted once. Server-side HTML parse with per-card extraction
(extract_eventbrite_cards — image + date matched to the correct card, never a
global index). Idempotent upsert by title; graceful on any blocked page.
"""
import os, re, sys, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import (get_conn, upsert_rows, Jsonb, make_session, fetch_html,
                      fetch_json, crawl_pages, extract_eventbrite_cards)

BASE = "https://www.eventbrite.com/d/vietnam/all-events/"
PAGES = 30           # all-events deep scrape
PAGES_Q = 8          # per keyword-query
QUERIES = ["workshop", "conference", "meetup", "seminar", "networking",
           "training", "education", "student", "community", "festival"]

# --- Source 2: Ticketmaster Discovery API (env-gated, key already provisioned) ---
TM_KEY = os.getenv("TICKETMASTER_API_KEY", "")
TM_COUNTRY = os.getenv("ADZUNA_COUNTRY", "vn")  # 'vn' reuses the VN locale
TM_BASE = "https://app.ticketmaster.com/discovery/v1/events.json"
TM_PAGES = 15
TARGET = 300


def parse_date(s):
    if not s:
        return None
    for fmt in ("%a, %d %b %Y at %I:%M %p", "%a, %d %b %Y", "%d %b %Y", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def _card_to_row(c, query=None):
    """Turn an extract_eventbrite_cards() card into an events row dict."""
    title = (c.get("title") or "").strip()
    if not title or title.lower() in ("see all", "xem tất cả", "see all  "):
        return None
    now = datetime.datetime.utcnow()
    start = parse_date(c.get("date")) or now
    end = start + datetime.timedelta(days=1)
    banner = c.get("img")
    is_online = "online" in title.lower() or "virtual" in (banner or "").lower()
    suffix = f" (tìm theo '{query}')" if query else ""
    return {
        "title": title[:255],
        "description": f"Sự kiện trên Eventbrite{suffix}. Xem chi tiết tại https://www.eventbrite.com{c.get('href','')}",
        "type": "event",
        "location_point": None,
        "address": "Việt Nam",
        "start_date": start,
        "end_date": end,
        "capacity": 200,
        "registered_count": 0,
        "banner_url": banner,
        "organizer_id": None,
        "status": "active" if start >= now else "inactive",
        "tags": Jsonb(["eventbrite", "vietnam"]),
        "is_online": is_online,
        "meeting_url": None,
        "price": 0,
    }


def _events_items(html, query=None):
    """Parse one Eventbrite listing page -> list of event row dicts (deduped by title within page)."""
    if not html:
        return []
    out = []
    seen = set()
    for c in extract_eventbrite_cards(html):
        row = _card_to_row(c, query)
        if row and row["title"] not in seen:
            seen.add(row["title"])
            out.append(row)
    return out


def _tm_page_items(json_data):
    """Turn one Ticketmaster `events.json` page into events row dicts (deduped)."""
    out = {}
    if not json_data or not isinstance(json_data, dict):
        return []
    events = (json_data.get("_embedded") or {}).get("events", [])
    if not events:
        return []
    now = datetime.datetime.utcnow()
    for ev in events:
        title = (ev.get("name") or "").strip()
        if not title:
            continue
        place = ev.get("place") or {}
        geo = place.get("geolocation") or {}
        lat = (geo.get("latitude") or {}).get("latitude")
        lng = (geo.get("longitude") or {}).get("longitude")
        addr_parts = [
            (place.get("address") or {}).get("address"),
            (place.get("city") or {}).get("name"),
            (place.get("country") or {}).get("name"),
        ]
        address = ", ".join(p for p in addr_parts if p)
        images = ev.get("images") or []
        banner = images[0].get("url") if images and images[0].get("url") else None
        dates = ev.get("dates") or {}
        start = dates.get("start") or {}
        end = dates.get("end") or {}
        start_dt = start.get("dateTime") or _tm_iso(start.get("localDate"), start.get("localTime"))
        end_dt = end.get("dateTime") or _tm_iso(end.get("localDate"), end.get("localTime"))
        st_code = (dates.get("status") or {}).get("code", "")
        # Ticketmaster: 'activesales'/'onsale' => active, else keep raw -> inactive
        status = "active" if st_code in ("activesales", "onsale") else "inactive"
        price = _tm_price(ev.get("priceRanges"))
        out[title] = {
            "title": title[:255],
            "description": (ev.get("info") or f"Sự kiện từ Ticketmaster. Chi tiết: {ev.get('url') or ''}").strip()[:3000],
            "type": "event",
            "location_point": None,
            "address": address or "Việt Nam",
            "start_date": _tm_dt(start_dt) or now,
            "end_date": _tm_dt(end_dt) or (_tm_dt(start_dt) or now) + datetime.timedelta(days=1),
            "capacity": 200,
            "registered_count": 0,
            "banner_url": banner,
            "organizer_id": None,
            "status": status,
            "tags": Jsonb(["ticketmaster", "vn"]),
            "is_online": False,
            "meeting_url": ev.get("url") or None,
            "price": price,
        }
    return list(out.values())


def _tm_iso(date_str, time_str):
    if not date_str:
        return None
    t = time_str or "00:00:00"
    return f"{date_str}T{t}"


def _tm_dt(s):
    if not s:
        return None
    s = s.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        return datetime.datetime.fromisoformat(s)
    except ValueError:
        return None


def _tm_price(ranges):
    if not ranges or not isinstance(ranges, list):
        return 0
    r = ranges[0]
    cur = r.get("currency", "VND")
    lo = r.get("low"); hi = r.get("high")
    if lo is None and hi is None:
        return 0
    if lo is not None and hi is not None:
        return f"{int(lo)}-{int(hi)} {cur}"
    return f"{int(lo if lo is not None else hi)} {cur}"


def crawl():
    s = make_session()
    by_title = {}

    # 1) all-events deep scrape (PAGES pages)
    page_items = crawl_pages(
        s, lambda p: f"{BASE}?page={p}", fetch_html, lambda h: _events_items(h),
        key=("title",), max_pages=PAGES, stop_when_empty=True, sleep=0.8,
        label='events(all)')
    for it in page_items:
        by_title[it["title"]] = it

    # 2) keyword-search pages — different slice per keyword
    for q in QUERIES:
        if len(by_title) >= TARGET:
            break
        q_items = crawl_pages(
            s, lambda p, q=q: f"{BASE}?q={q}&page={p}", fetch_html,
            lambda h: _events_items(h, q), key=("title",),
            max_pages=PAGES_Q, stop_when_empty=True, sleep=0.6,
            label=f'events(q={q})')
        for it in q_items:
            if it["title"] not in by_title:
                by_title[it["title"]] = it
        if len(by_title) >= TARGET:
            break

    # 3) Ticketmaster Discovery (source 2) — env-gated, only when key present
    if TM_KEY and len(by_title) < TARGET:
        tm_items = crawl_pages(
            s, lambda p: f"{TM_BASE}?apikey={TM_KEY}&country=local&q=VN&page={p}",
            fetch_json, _tm_page_items, key=("title",),
            max_pages=TM_PAGES, stop_when_fewer_than=20, sleep=0.5,
            label='events(ticketmaster)')
        for it in tm_items:
            if it["title"] not in by_title:
                by_title[it["title"]] = it

    rows = list(by_title.values())
    if len(rows) > TARGET:
        rows = rows[:TARGET]
    print(f"  [events] collected {len(rows)} distinct events (Eventbrite + Ticketmaster)")
    return rows


def run():
    print("events_crawler: start")
    conn = get_conn()
    try:
        rows = crawl()
        if rows:
            r = upsert_rows(conn, "events", rows, ["title"])
            print(f"events_crawler: {r}")
        else:
            print("events_crawler: 0 rows")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
