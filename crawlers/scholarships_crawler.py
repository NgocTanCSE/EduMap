# -*- coding: utf-8 -*-
"""
Scholarships crawler -> `scholarships` table (title UNIQUE).

Multiple sources, ALL paginated (crawl nhiều trang, không chỉ 1-2):

  1. Eventbrite public search (server-side HTML, NO key) — multiple keyword
     queries walked across PAGES pages each, deduped globally by title so the
     same scholarship from two query angles is only upserted once.
  2. Dev.to public API (JSON, NO key, rate-limit friendly) — articles tagged
     scholarship/grant/education/fellowship, per_page=20, paginated (page=N),
     stopped at the first page yielding fewer than 20 (last partial page).

Card-aware extraction (extract_eventbrite_cards) so image_url/date belong to
the correct card — never a global site index. Idempotent upsert by title.

Graceful: any blocked/unreachable source/query/page -> 0 rows for that slice,
no crash (the whole run degrades to whatever sources are alive).
"""
import os, re, sys, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import (get_conn, upsert_rows, Jsonb, make_session, fetch_html,
                      fetch_json, crawl_pages, extract_eventbrite_cards, ensure_column)

NOW = datetime.datetime.utcnow()

# --- Source 1: Eventbrite (HTML, multiple keyword queries) ---
QUERIES = [
    "scholarship", "education", "student", "grant", "learning",
    "training", "school", "university", "course", "tuition",
    "financial aid", "fund",
]
PAGES = 15  # per Eventbrite query
BASE = "https://www.eventbrite.com/d/vietnam/all-events/"

# --- Source 2: Dev.to public API (JSON, no key) ---
DEVTO_TAGS = ["scholarship", "grant", "education", "fellowship"]
DEVTO_PER_PAGE = 20
DEVTO_PAGES = 6

TARGET = 150  # soft cap on distinct scholarships


def parse_date(s):
    """Best-effort parse of a single date token into a datetime."""
    if not s:
        return None
    s = s.strip()
    for fmt in ("%a, %d %b %Y", "%d/%m/%Y", "%Y-%m-%d", "%d %b %Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


# --------------------------------------------------------------------------- #
# Source 1: Eventbrite HTML
# --------------------------------------------------------------------------- #
def _eb_card_to_row(c, query=None):
    """Map one extract_eventbrite_cards() card to a scholarships row dict."""
    title = (c.get("title") or "").strip()
    if not title or title.lower() in ("see all", "xem tất cả", "see all  "):
        return None
    suffix = f" (tìm theo '{query}')" if query else ""
    return {
        "title": title[:255],
        "description": (
            f"Học bổng/giáo dục từ Eventbrite{suffix}. "
            f"Chi tiết: https://www.eventbrite.com{c.get('href', '')}"
        ),
        "provider": "Eventbrite / cộng đồng",
        "location": None,                 # geography(Point); left NULL (no geocode)
        "value_amount": None,
        "deadline": parse_date(c.get("date")) or (NOW + datetime.timedelta(days=30)),
        "image_url": c.get("img"),        # per-card image, matched to the correct card
        "eligibility_criteria": Jsonb({
            "source": query,
            "url": ("https://www.eventbrite.com" + c["href"]) if c.get("href") else None,
        }),
        "apply_url": ("https://www.eventbrite.com" + c["href"]) if c.get("href") else BASE,
        "status": "active",
    }


def _eb_items(html, query=None):
    """Parse one Eventbrite listing page -> list of row dicts (deduped by title)."""
    if not html:
        return []
    out = {}
    for c in extract_eventbrite_cards(html):
        row = _eb_card_to_row(c, query)
        if row and row["title"] not in out:
            out[row["title"]] = row
    return list(out.values())


# --------------------------------------------------------------------------- #
# Source 2: Dev.to JSON API
# --------------------------------------------------------------------------- #
def _devto_page_items(json_data, tag=None):
    """Turn a Dev.to article list (one page) into scholarships row dicts."""
    out = {}
    if not isinstance(json_data, list):
        return []
    for a in json_data:
        title = (a.get("title") or "").strip()
        if not title or title in out:
            continue
        url = a.get("url") or ""
        desc = (a.get("description") or "").strip()
        out[title] = {
            "title": title[:255],
            "description": (
                f"Học bổng/giáo dục từ Dev.to{(' (tag:' + tag + ')') if tag else ''}. {desc[:200]}"
            ),
            "provider": "Dev.to",
            "location": None,
            "value_amount": None,
            "deadline": NOW + datetime.timedelta(days=30),
            "image_url": a.get("cover_image") or None,
            "eligibility_criteria": Jsonb({
                "source": "devto", "tag": tag,
                "url": url, "tags": a.get("tag_list", []),
            }),
            "apply_url": url,
            "status": "active",
        }
    return list(out.values())


# --------------------------------------------------------------------------- #
# Orchestrator
# --------------------------------------------------------------------------- #
def crawl():
    s = make_session()
    by_title = {}

    # 1) Eventbrite — multi-query, multi-page
    for q in QUERIES:
        if len(by_title) >= TARGET:
            break
        page_items = crawl_pages(
            s, lambda p, q=q: f"{BASE}?q={q}&page={p}", fetch_html,
            lambda h: _eb_items(h, q), key=("title",),
            max_pages=PAGES, stop_when_empty=True, sleep=0.6,
            label=f'scholarships(eb:{q})')
        for it in page_items:
            if it["title"] not in by_title:
                by_title[it["title"]] = it
        if len(by_title) >= TARGET:
            break

    # 2) Dev.to — multi-tag, multi-page (only if still under target)
    if len(by_title) < TARGET:
        for tag in DEVTO_TAGS:
            if len(by_title) >= TARGET:
                break
            tag_items = crawl_pages(
                s,
                lambda p, tag=tag: (
                    f"https://dev.to/api/articles?tag={tag}"
                    f"&per_page={DEVTO_PER_PAGE}&page={p}"
                ),
                fetch_json,
                lambda d: _devto_page_items(d, tag),
                key=("title",),
                max_pages=DEVTO_PAGES, stop_when_empty=True,
                stop_when_fewer_than=DEVTO_PER_PAGE, sleep=0.4,
                label=f'scholarships(devto:{tag})')
            for it in tag_items:
                if it["title"] not in by_title:
                    by_title[it["title"]] = it

    rows = list(by_title.values())
    if len(rows) > TARGET:
        rows = rows[:TARGET]
    print(f"  [scholarships] collected {len(rows)} distinct "
          f"(Eventbrite + Dev.to) — target cap {TARGET}")
    return rows


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
