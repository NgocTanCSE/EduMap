# -*- coding: utf-8 -*-
"""
Community posts crawler -> `posts` table (tag='community').

Multi-source, all paginated/multi-fetch:
  1. Hacker News public JSON API (https://hacker-news.firebaseio.com/v0/…) —
     free, NO key, rate-limit friendly. Fetches ~120 top/front stories and
     resolves the real og:image of each story's external URL (never just the
     HN link). No auth, no JS rendering.
  2. Dev.to public API (JSON, NO key) — articles on community-relevant tags
     (education/students/programming/opensource/career/webdev), 20/page,
     paginated (`page=N`), stopped at the first page yielding <20 items.

Dedup by (title, source) so the same story from a second angle is upserted
only once. author_id / group_id left NULL (no FK owner). Graceful: any
unreachable source -> 0 rows for that source, no crash.
"""
import os, re, sys, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import (get_conn, upsert_rows, Jsonb, make_session, fetch_json,
                      fetch_og_image, crawl_pages)
from crawl_scope import crawl_years, LOCATION_LAYERS

# --- Source 1: Hacker News ---
HN_TOP = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM = "https://hacker-news.firebaseio.com/v0/item/{id}.json"
HN_LIMIT = 120


# --- Source 2: Dev.to ---
DEVTO_TAGS = ["education", "students", "programming", "opensource",
              "career", "webdev", "beginners"]
DEVTO_PER_PAGE = 20
DEVTO_PAGES = 6
DEVTO_BASE = "https://dev.to/api/articles"


def clean(t):
    return re.sub(r"<[^>]+>", " ", t or "").replace("\n", " ").strip()[:3000]


# --------------------------------------------------------------------------- #
# Source 1: Hacker News
# --------------------------------------------------------------------------- #
def _hn_rows(s, n=HN_LIMIT):
    """Fetch n top HN story ids and turn each into a posts row (with og:image)."""
    ids = fetch_json(s, HN_TOP)
    if not ids or not isinstance(ids, list):
        print("  [community] HN topstories unreachable")
        return []
    rows = []
    for iid in ids[:n]:
        item = fetch_json(s, HN_ITEM.format(id=iid), timeout=15)
        if not item or item.get("type") != "story" or not item.get("title"):
            continue
        # Resolve the real og:image from the story's external URL (not just the URL).
        og_image = None
        story_url = item.get("url")
        if story_url and "hackernews" not in story_url.lower():
            og_image = fetch_og_image(s, story_url, timeout=10)
        media = []
        if og_image:
            media.append(og_image)
        elif story_url:
            media.append(story_url)  # fallback: store the link itself
        rows.append({
            "title": (item.get("title") or "")[:255],
            "source": "hackernews_top",
            "content": clean(item.get("text") or "")[:3000],
            "media_urls": Jsonb(media),
            "tags": Jsonb(["community", "hackernews"]),
            "like_count": int(item.get("score") or 0),
            "comment_count": int(item.get("descendants") or 0),
            "status": "active",
            "pinned": False,
        })
        time.sleep(0.1)
    return rows


# --------------------------------------------------------------------------- #
# Source 2: Dev.to
# --------------------------------------------------------------------------- #
def _devto_page_items(json_data):
    """Turn one Dev.to article page (list) into posts row dicts."""
    out = []
    if not isinstance(json_data, list):
        return out
    for a in json_data:
        title = (a.get("title") or "").strip()
        if not title:
            continue
        url = a.get("url") or ""
        media = []
        if a.get("cover_image"):
            media.append(a.get("cover_image"))
        elif url:
            media.append(url)
        out.append({
            "title": title[:255],
            "source": "devto_community",
            "content": clean(a.get("description") or "")[:3000],
            "media_urls": Jsonb(media),
            "tags": Jsonb(["community", "devto"]),
            "like_count": int(a.get("positive_reactions_count") or 0),
            "comment_count": int(a.get("comments_count") or 0),
            "status": "active",
            "pinned": False,
        })
    return out


def crawl():
    print(f"  [community] crawl_years={crawl_years()} | location_scope=vietnam")
    s = make_session()
    by_key = {}  # (title, source) -> row

    # 1) Hacker News (multi-fetch, many stories)
    for row in _hn_rows(s):
        by_key[(row["title"], row["source"])] = row

    # 2) Dev.to — multi-tag, multi-page (only if still under target)
    TARGET = 150
    for tag in DEVTO_TAGS:
        if len(by_key) >= TARGET:
            break
        page_items = crawl_pages(
            s,
            lambda p, tag=tag: (
                f"{DEVTO_BASE}?tag={tag}&state=latest"
                f"&per_page={DEVTO_PER_PAGE}&page={p}"
            ),
            fetch_json, _devto_page_items, key=("title", "source"),
            max_pages=DEVTO_PAGES, stop_when_empty=True,
            stop_when_fewer_than=DEVTO_PER_PAGE, sleep=0.5,
            label=f'community(devto:{tag})')
        for it in page_items:
            by_key[(it["title"], it["source"])] = it
        if len(by_key) >= TARGET:
            break

    rows = list(by_key.values())
    print(f"  [community] collected {len(rows)} distinct posts (HN + Dev.to)")
    return rows


def run():
    print("community_posts_crawler: start")
    print(f"  [scope] crawl_years={crawl_years()} | layers={[l['label'] for l in LOCATION_LAYERS]}")
    conn = get_conn()
    try:
        rows = crawl()
        if rows:
            r = upsert_rows(conn, "posts", rows, ["title", "source"])
            print(f"community_posts_crawler: {r} (-> posts tag=community)")
        else:
            print("community_posts_crawler: 0 rows (sources blocked/unreachable — graceful)")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
