# -*- coding: utf-8 -*-
"""
Community posts crawler -> `posts` table (tag='community').

Source: Hacker News public JSON API (https://hacker-news.firebaseio.com/v0/...)
— free, NO key, rate-limit friendly. Fetches ~120 top/front stories -> >=100
real community posts. No auth, no JS rendering.

posts has no unique key -> dedup by title (upsert_row SELECT-then-update).
author_id / group_id left NULL (no FK owner).
"""
import os, re, sys, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, make_session, fetch_json, fetch_og_image

HN_TOP = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM = "https://hacker-news.firebaseio.com/v0/item/{id}.json"
LIMIT = 120

def clean(t):
    return re.sub(r"<[^>]+>", " ", t or "").replace("\n", " ").strip()[:3000]

def crawl():
    s = make_session()
    ids = fetch_json(s, HN_TOP)
    if not ids or not isinstance(ids, list):
        print("  [community] HN unreachable")
        return []
    rows = []
    for iid in ids[:LIMIT]:
        item = fetch_json(s, HN_ITEM.format(id=iid), timeout=15)
        if not item:
            continue
        if item.get("type") != "story" or not item.get("title"):
            continue
        # Crawl the exact og:image from the story's linked URL (not just the
        # URL itself). Only fetch external URLs (not HN internal pages).
        og_image = None
        story_url = item.get("url")
        if story_url and not "hackernews" in story_url.lower():
            og_image = fetch_og_image(s, story_url, timeout=10)
        media = []
        if og_image:
            media.append(og_image)
        elif story_url:
            media.append(story_url)  # fallback: store the link itself
        rows.append({
            "title": (item.get("title") or "")[:255],
            "source": "hackernews_top",
            "content": (clean(item.get("text")) or "")[:3000],
            "media_urls": Jsonb(media),
            "tags": Jsonb(["community", "hackernews"]),
            "like_count": int(item.get("score") or 0),
            "comment_count": int(item.get("descendants") or 0),
            "status": "active",
            "pinned": False,
        })
        time.sleep(0.1)
    return rows

def run():
    print("community_posts_crawler: start")
    conn = get_conn()
    try:
        rows = crawl()
        if rows:
            r = upsert_rows(conn, "posts", rows, ["title", "source"])
            print(f"community_posts_crawler: {r} (-> posts tag=community)")
        else:
            print("community_posts_crawler: 0 rows")
    finally:
        conn.close()

if __name__ == "__main__":
    run()
