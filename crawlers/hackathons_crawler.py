# -*- coding: utf-8 -*-
"""
Hackathons crawler -> `posts` table (tag='hackathon').

Multiple sources, ALL paginated (crawl nhiều trang, không chỉ 1-2):

  1. Devpost browse    — https://devpost.com/api/hackathons?per_page=30&page=N
                         (free, NO key) — default ordering.
  2. Devpost popular   — same endpoint, &sort=popular -> different slice.
  3. Eventbrite VN     — https://www.eventbrite.com/d/vietnam/all-events/?q=hackathon&page=N
                         (+ q=contest, q=competition) — server-side HTML, card-aware.

posts has no unique key -> dedup by (title, source) (upsert_row
SELECT-then-update). Graceful: a source that 403/lỗi -> 0 rows, no crash.
"""
import os, re, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, make_session, fetch_json, fetch_html, crawl_pages, extract_eventbrite_cards

DEVPOST = "https://devpost.com/api/hackathons"
PER_PAGE = 30
MAX_PAGES = 8
TARGET = 200
# Eventbrite hackathon/competition keyword pages (VN).
EVENTBRITE = "https://www.eventbrite.com/d/vietnam/all-events/"
EB_QUERIES = ["hackathon", "competition", "contest", "student"]
EB_PAGES = 6  # per query


def clean(t):
    return re.sub(r"<[^>]+>", " ", t or "").replace("\n", " ").strip()[:3000]


# ---- Source 1 & 2: Devpost (browse + popular sort) ----
def _devpost_items(data):
    rows = []
    if not data or "hackathons" not in data:
        return rows
    for h in data.get("hackathons", []):
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
    return rows


def _devpost_url(sort):
    # crawl_pages is page-based -> build a page URL; sort=None for browse.
    def _u(page):
        base = f"{DEVPOST}?per_page={PER_PAGE}&page={page}"
        if sort:
            base += f"&sort={sort}"
        return base
    return _u


# ---- Source 3: Eventbrite VN (hackathon/competition search, paginated) ----
def _eventbrite_items(html):
    rows = []
    if not html:
        return rows
    for c in extract_eventbrite_cards(html):
        title = (c.get("title") or "").strip()
        if not title or title.lower() in ("see all", "xem tất cả"):
            continue
        rows.append({
            "title": title[:255],
            "source": "eventbrite",
            "content": f"Sự kiện trên Eventbrite. Xem chi tiết tại https://www.eventbrite.com{c.get('href','')}",
            "media_urls": Jsonb([c["img"]] if c.get("img") else []),
            "tags": Jsonb(["hackathon", "eventbrite"]),
            "like_count": 0,
            "comment_count": 0,
            "status": "active",
            "pinned": False,
        })
    return rows


def crawl():
    s = make_session()
    rows = []

    # 1) Devpost browse (default ordering)
    rows.extend(crawl_pages(
        s, _devpost_url(None), fetch_json, _devpost_items,
        key=("title", "source"), max_pages=MAX_PAGES,
        stop_when_fewer_than=PER_PAGE, sleep=0.5, label='hackathons(devpost)'))

    # 2) Devpost popular sort — different slice, deduped by title
    rows.extend(crawl_pages(
        s, _devpost_url("popular"), fetch_json, _devpost_items,
        key=("title", "source"), max_pages=MAX_PAGES,
        stop_when_fewer_than=PER_PAGE, sleep=0.5, label='hackathons(devpost-popular)'))

    # 3) Eventbrite VN — several keyword queries, each paginated
    for q in EB_QUERIES:
        rows.extend(crawl_pages(
            s, lambda p, q=q: f"{EVENTBRITE}?q={q}&page={p}", fetch_html,
            _eventbrite_items, key=("title", "source"),
            max_pages=EB_PAGES, sleep=0.8, label=f'hackathons(eb:{q})'))

    # soft cap so we don't upsert an unbounded backlog in one run
    if TARGET and len(rows) > TARGET:
        rows = rows[:TARGET]

    # Global dedup by (title, source) — the two Devpost sort angles and the
    # Eventbrite queries can surface the same hackathon more than once.
    _seen = set()
    deduped = []
    for r in rows:
        k = (r.get("title", ""), r.get("source", ""))
        if k in _seen:
            continue
        _seen.add(k)
        deduped.append(r)
    rows = deduped

    print(f"  [hackathons] collected {len(rows)} rows across "
          f"Devpost browse+popular + Eventbrite ({len(EB_QUERIES)} queries x {EB_PAGES} pages)")
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
