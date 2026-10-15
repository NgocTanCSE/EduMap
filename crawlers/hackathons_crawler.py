# -*- coding: utf-8 -*-
"""
Hackathons crawler -> `posts` table (tag='hackathon').

Source: Devpost public API (https://devpost.com/api/hackathons?per_page=30&page=N)
— free, NO key, no auth. Paginates until <30 results or ~150 collected.
Devpost items are stored as community posts (the /hackathon page already reads
live Devpost via the /api/hackathons BFF; this crawler additionally persists
them into `posts` so they're searchable/offline in the DB).

posts has no unique key -> dedup by title (upsert_row SELECT-then-update).
"""
import os, re, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, make_session, fetch_json

DEVPOST = "https://devpost.com/api/hackathons"
PER_PAGE = 30
MAX_PAGES = 6
TARGET = 150

def clean(t):
    return re.sub(r"<[^>]+>", " ", t or "").replace("\n", " ").strip()[:3000]

def crawl():
    s = make_session()
    rows = []
    page = 1
    while page <= MAX_PAGES and len(rows) < TARGET:
        data = fetch_json(s, f"{DEVPOST}?per_page={PER_PAGE}&page={page}")
        if not data or "hackathons" not in data:
            print(f"  [hackathons] Devpost page {page} unreachable")
            break
        items = data.get("hackathons", [])
        if not items:
            break
        for h in items:
            title = (h.get("title") or "").strip()
            if not title:
                continue
            desc = clean(h.get("description") or "")
            if not desc:
                desc = h.get("time_left_to_submission") or h.get("submission_period_dates") or ""
            media = []
            if h.get("image_url"):
                media.append(h["image_url"])
            rows.append({
                "title": title[:255],
                "source": "devpost",
                "content": desc[:3000],
                "media_urls": Jsonb(media),
                "tags": Jsonb(["hackathon", "devpost"]),
                "like_count": 0,
                "comment_count": 0,
                "status": "active",
                "pinned": False,
            })
        page += 1
        time.sleep(0.5)
    return rows

def run():
    print("hackathons_crawler: start")
    rows = crawl()
    conn = get_conn()
    try:
        if rows:
            r = upsert_rows(conn, "posts", rows, ["title", "source"])
            print(f"hackathons_crawler: {r}  (-> posts tag=hackathon)")
        else:
            print("hackathons_crawler: 0 rows")
    finally:
        conn.close()

if __name__ == "__main__":
    run()
