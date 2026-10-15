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
from db_utils import get_conn, upsert_rows, Jsonb, make_session, fetch_html

NOW = datetime.datetime.utcnow()
QUERIES = [
    "fundraising", "charity", "donation", "support", "community", "cause",
    "nonprofit", "ngo", "aid", "relief", "volunteer",
]
PAGES = 8  # per query
BASE = "https://www.eventbrite.com/d/vietnam/all-events/"


def _cards(html):
    items = []
    cards = re.findall(r'href="(/e/[^"]+?ticket-\d+)"[^>]*>\s*<h3[^>]*>([^<]+)</h3>', html)
    if not cards:
        cards = [("", t) for t in re.findall(r'<h3[^>]*>([^<]{6,90})</h3>', html)]
    imgs = re.findall(r'<img[^>]+src="(https?://[^"]+eventbrite[^"]+)"', html)
    for i, (href, title) in enumerate(cards):
        title = title.strip()
        if not title or title.lower() in ("see all", "xem tất cả"):
            continue
        items.append({
            "title": title[:255],
            "href": href,
            "img": imgs[i] if i < len(imgs) else None,
        })
    return items


def crawl():
    s = make_session()
    rows = {}
    for q in QUERIES:
        for page in range(1, PAGES + 1):
            url = f"{BASE}?q={q}&page={page}"
            html = fetch_html(s, url, timeout=40)
            if not html:
                continue
            for c in _cards(html):
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
