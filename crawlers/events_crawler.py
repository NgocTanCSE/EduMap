# -*- coding: utf-8 -*-
"""
Events crawler -> `events` table (title UNIQUE).

Source: Eventbrite public HTML (https://www.eventbrite.com/d/vietnam/all-events/?page=N)
— NO key, server-side rendered (titles are in the HTML, parseable with regex,
no headless browser needed). Paginates N pages -> comfortably >100 events.

Parses event cards from the list page (title, date, image, link). start_date /
end_date fall back to "now" when the card doesn't expose a date (NOT NULL cols).
Idempotent upsert by title.
"""
import os, re, sys, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, make_session, fetch_html, extract_eventbrite_cards

BASE = "https://www.eventbrite.com/d/vietnam/all-events/"
PAGES = 30  # all-events deep scrape (Eventbrite VN superset)
PAGES_Q = 8  # keyword-search pages (surface titles not in all-events ordering)
QUERIES = ["workshop", "conference", "meetup", "seminar", "networking", "training", "education", "student"]

def parse_date(s):
    if not s:
        return None
    for fmt in ("%a, %d %b %Y at %I:%M %p", "%a, %d %b %Y", "%d %b %Y", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None

def crawl():
    s = make_session()
    rows = []
    seen = set()
    for page in range(1, PAGES + 1):
        html = fetch_html(s, f"{BASE}?page={page}", timeout=40)
        if not html:
            print(f"  [events] page {page} unreachable")
            continue
        # Eventbrite cards: use card-aware extraction (image + date matched per-card)
        for c in extract_eventbrite_cards(html):
            title = c["title"].strip()
            if not title or title.lower() in ("", "see all") or title in seen:
                continue
            seen.add(title)
            now = datetime.datetime.utcnow()
            start = parse_date(c.get("date")) or now
            end = start + datetime.timedelta(days=1)
            banner = c["img"]  # per-card image, not index-based
            is_online = "online" in title.lower() or "virtual" in (banner or "").lower()
            rows.append({
                "title": title[:255],
                "description": f"Sự kiện trên Eventbrite. Xem chi tiết tại https://www.eventbrite.com{c['href']}",
                "type": "event",
                "address": "Việt Nam",
                "location_point": None,
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
            })
        if len(seen) >= 300:
            break
    # keyword-search pages surface titles not present in the all-events ordering
    for q in QUERIES:
        for page in range(1, PAGES_Q + 1):
            html = fetch_html(s, f"{BASE}?q={q}&page={page}", timeout=40)
            if not html:
                continue
            # keyword-search pages surface events not present in all-events ordering
            for c in extract_eventbrite_cards(html):
                title = c["title"].strip()
                if not title or title.lower() in ("", "see all") or title in seen:
                    continue
                seen.add(title)
                now = datetime.datetime.utcnow()
                start = parse_date(c.get("date")) or now
                end = start + datetime.timedelta(days=1)
                banner = c["img"]  # per-card image, not index-based
                is_online = "online" in title.lower() or "virtual" in (banner or "").lower()
                rows.append({
                    "title": title[:255],
                    "description": f"Sự kiện (tìm theo '{q}') trên Eventbrite. Xem chi tiết tại https://www.eventbrite.com{c['href']}",
                    "type": "event",
                    "address": "Việt Nam",
                    "location_point": None,
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
                })
        if len(seen) >= 200:
            break
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
