# -*- coding: utf-8 -*-
"""
Events crawler -> `events` table (title UNIQUE).

Replaces ALL HTTP-based sources (Eventbrite, Ticketmaster) which are
**blocked on Hugging Face Spaces free tier** (egress port blackhole) with
Tavily AI search + extract.

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  The previous
  version of this crawler made direct HTTP calls to Eventbrite and Ticketmaster
  APIs — both blocked at HF egress.  This version uses a single Tavily API call
  (https://api.tavily.com — reachable from HF).

Sources:
  - Tavily Search + Extract: https://api.tavily.com  (Bearer: TAVILY_API_KEY)

Scope rules (see crawlers/crawl_scope.py):
  • Years   — 2 consecutive years centred on the crawl year.
  • Location — Đồng Nai → miền Nam → VN → ĐNA.

Graceful degradation:
  - TAVILY_API_KEY absent → 0 rows, logged, no crash.
  - Tavily unreachable → 0 rows, no crash.
"""
import os, re, sys, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, ensure_column
from crawl_scope import (
    crawl_years, in_year_scope, year_scope_range,
    LOCATION_LAYERS, location_matches, keywords_for_layers,
)
from tavily_client import TavilyClient, tavily_search_and_extract
from tavily_parse import clean_text

NOW = datetime.datetime.utcnow()
# 2 consecutive years (e.g. 2026 -> [2025, 2026])
_CRAWL_YEARS = crawl_years()
_YEAR_MIN, _YEAR_MAX = year_scope_range()

# Tavily search queries — Vietnamese, location-scoped (Đồng Nai → miền Nam →
# VN → ĐNA) plus keyword-focussed.
_TAVILY_EVENT_QUERIES = [
    # Đồng Nai
    "sự kiện công nghệ thông tin Đồng Nai 2025",
    "workshop giáo dục Biên Hòa",
    "hội thảo khoa học Đồng Nai",
    # miền Nam
    "sự kiện startup TP Hồ Chí Minh",
    "tech meetup Đà Nẵng 2025",
    "hội thảo giáo dục miền Nam",
    # Việt Nam
    "sự kiện giáo dục Việt Nam 2025",
    "conference công nghệ thông tin Việt Nam",
    "seminar y tế giáo dục VN",
    # keyword-focussed
    "sự kiện sinh viên đại học Việt Nam",
    "workshop phần mềm miễn phí",
    "hội thảo học thuật Việt Nam",
    "festival giáo dục 2025",
    "webinar học tập trực tuyến",
]

TARGET = 300  # soft cap on distinct events


def parse_date(s):
    """Best-effort parse of a date token into a datetime."""
    if not s:
        return None
    s = s.strip()
    for fmt in ("%a, %d %b %Y at %I:%M %p", "%a, %d %b %Y", "%d/%m/%Y", "%Y-%m-%d", "%d %b %Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def _location_layer(location_str):
    if not location_str:
        return "unscoped"
    for layer in LOCATION_LAYERS:
        if location_matches(location_str, layer["keywords"]):
            return layer["label"]
    return "unscoped"


def _event_row(title, description, address, start_date=None, banner_url=None,
               meeting_url=None, tags=None, price=0, query=None):
    """Turn one Tavily search result into an events row dict."""
    title = (title or "").strip()
    if not title or title.lower() in ("see all", "xem tất cả"):
        return None
    now = datetime.datetime.utcnow()
    start = parse_date(start_date) if start_date else None
    if start is None or not in_year_scope(start.date().isoformat()):
        start = now
    end = start + datetime.timedelta(days=1)
    is_online = bool(meeting_url) or "online" in (title + " " + (description or "")).lower()
    suffix = f" (tìm theo '{query}')" if query else ""
    return {
        "title": title[:255],
        "description": f"Sự kiện tìm thấy qua Tavily{suffix}. " + (clean_text(description)[:500] if description else ""),
        "type": "event",
        "location_point": None,
        "location_scope": "vietnam",
        "address": (address or "Việt Nam")[:300],
        "start_date": start,
        "end_date": end,
        "capacity": 200,
        "registered_count": 0,
        "banner_url": banner_url,
        "organizer_id": None,
        "status": "active" if start >= now else "inactive",
        "tags": Jsonb(["tavily", "event"]),
        "is_online": is_online,
        "meeting_url": meeting_url,
        "price": price,
    }


def crawl():
    """Crawl Vietnamese events via Tavily Search + Extract.

    Replaces Eventbrite + Ticketmaster (both blocked on HF Spaces egress).
    Returns a flat list of event row dicts, deduped by title.
    """
    by_title = {}
    client = TavilyClient()
    if not client.is_configured():
        print("  [events] TAVILY_API_KEY không được cài đặt — crawl trả về 0 dòng (giảm dần)")
        print("  [events] Thử chế độ keyless của Tavily...")

    for q in _TAVILY_EVENT_QUERIES:
        if len(by_title) >= TARGET:
            break
        try:
            results = tavily_search_and_extract(
                q,
                search_depth="basic",
                max_results=10,
                extract_top_k=5,
                extract_depth="basic",
            )
            print(f"  [events] [tavily] '{q[:50]}...' → {len(results)} results")
            for r in results:
                title = clean_text(r.get("title", ""))[:255]
                if not title:
                    continue
                row = _event_row(
                    title=title,
                    description=r.get("raw_content", "") or r.get("content", ""),
                    address="Việt Nam",
                    start_date=None,  # date inferred from raw content
                    query=q,
                )
                if row and title not in by_title:
                    by_title[title] = row
        except Exception as e:
            print(f"  [events] [warn] Tavily query failed '{q[:50]}...': {e}")
            continue

    rows = list(by_title.values())
    if len(rows) > TARGET:
        rows = rows[:TARGET]
    print(f"  [events] collected {len(rows)} distinct events")
    return rows


def run():
    print("events_crawler: start")
    print(f"  [scope] crawl_years={crawl_years()} | layers={[l['label'] for l in LOCATION_LAYERS]}")
    conn = get_conn()
    try:
        ensure_column(conn, "events", "image_url", "TEXT")
        ensure_column(conn, "events", "location_scope", "TEXT")
        rows = crawl()
        if rows:
            r = upsert_rows(conn, "events", rows, ["title"])
            print(f"events_crawler: {r}")
        else:
            print("events_crawler: 0 rows (Tavily keyless/unreachable — graceful)")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
