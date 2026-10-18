# -*- coding: utf-8 -*-
"""
Donations campaigns crawler -> `donation_campaigns` table (title UNIQUE).

Source: Eventbrite public search across Vietnam (server-side HTML, NO key).
Paginates multiple keyword queries (page=1..PAGES) + dedup by title so the
UPsert yields >=100 distinct fundraising/charity campaigns.

Graceful: any query/page with no cards -> 0 (no crash). Upsert by title.
"""
import os, re, sys, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, make_session, fetch_html, ensure_column, extract_eventbrite_cards

NOW = datetime.datetime.utcnow()
QUERIES = [
    "fundraising", "charity", "donation", "support", "community", "cause",
    "nonprofit", "ngo", "aid", "relief", "volunteer",
]
PAGES = 8  # per query
BASE = "https://www.eventbrite.com/d/vietnam/all-events/"


def crawl():
    s = make_session()
    rows = {}
    for q in QUERIES:
        for page in range(1, PAGES + 1):
            url = f"{BASE}?q={q}&page={page}"
            html = fetch_html(s, url, timeout=40)
            if not html:
                continue
            # Use card-aware extraction — image is matched to the correct card,
            # not by global index (prevents grabbing site logo/banner as a card image)
            for c in extract_eventbrite_cards(html):
                if c["title"] in rows:
                    continue
                rows[c["title"]] = {
                    "title": c["title"][:255],
                    "description": f"Chiến dịch quyên góp từ Eventbrite. Chi tiết: {url}",
                    "target_amount": 0,
                    "current_amount": 0,
                    "organizer_id": None,
                    "location_point": None,
                    "status": "active",
                    "start_date": NOW,
                    "end_date": NOW + datetime.timedelta(days=30),
                    "images": Jsonb([c["img"]] if c["img"] else []),
                }
            time.sleep(0.6)
            if len(rows) >= 150:
                break
    return list(rows.values())


def run():
    print("donations_crawler: start")
    conn = get_conn()
    try:
        rows = crawl()
        if rows:
            r = upsert_rows(conn, "donation_campaigns", rows, ["title"])
            print(f"donations_crawler: {r}")
        else:
            print("donations_crawler: 0 rows (sources blocked/unreachable — graceful)")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
