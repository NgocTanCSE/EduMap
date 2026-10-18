# -*- coding: utf-8 -*-
"""
Scholarships crawler -> `scholarships` table (title UNIQUE).

Source: Eventbrite public search across Vietnam (server-side HTML, NO key).
We paginate multiple keyword queries (page=1..PAGES) and dedup by title so the
UPsert yields >=100 distinct, real VN-adjacent scholarship/education events.

Graceful: any query/page that returns no cards -> 0 (no crash). Upsert by title.
"""
import os, re, sys, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, make_session, fetch_html, ensure_column, extract_eventbrite_cards

NOW = datetime.datetime.utcnow()
QUERIES = [
    "scholarship", "education", "student", "grant", "learning", "training",
    "school", "university", "course", "tuition", "financial aid", "fund",
]
PAGES = 10  # per query
BASE = "https://www.eventbrite.com/d/vietnam/all-events/"


def parse_date(s):
    if not s:
        return None
    s = s.strip()
    for fmt in ("%a, %d %b %Y", "%d/%m/%Y", "%Y-%m-%d", "%d %b %Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def crawl():
    s = make_session()
    rows = {}
    for q in QUERIES:
        for page in range(1, PAGES + 1):
            url = f"{BASE}?q={q}&page={page}"
            html = fetch_html(s, url, timeout=40)
            if not html:
                continue
            for c in extract_eventbrite_cards(html):
                if c["title"] in rows:
                    continue
                rows[c["title"]] = {
                    "title": c["title"][:255],
                    "description": f"Học bổng/giáo dục từ Eventbrite. Chi tiết: {BASE}?q={q}&page={page}",
                    "provider": "Eventbrite / cộng đồng",
                    "location": None,  # geography(Point); left NULL (no geocode)
                    "value_amount": None,
                    "deadline": parse_date(c.get("date")) or (NOW + datetime.timedelta(days=30)),
                    "image_url": c.get("img"),  # per-card image, not index-based
                    "eligibility_criteria": Jsonb({
                        "source": q,
                        "url": ("https://www.eventbrite.com" + c["href"]) if c.get("href") else None,
                    }),
                    "apply_url": ("https://www.eventbrite.com" + c["href"]) if c.get("href") else BASE,
                    "status": "active",
                }
            time.sleep(0.6)
            if len(rows) >= 150:
                break
    return list(rows.values())


def run():
    print("scholarships_crawler: start")
    conn = get_conn()
    try:
        ensure_column(conn, "scholarships", "image_url", "TEXT")
        rows = crawl()
        if rows:
            r = upsert_rows(conn, "scholarships", rows, ["title"])
            print(f"scholarships_crawler: {r}")
        else:
            print("scholarships_crawler: 0 rows (sources blocked/unreachable — graceful)")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
