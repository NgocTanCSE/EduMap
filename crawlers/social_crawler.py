# -*- coding: utf-8 -*-
"""
Social crawler -> `posts` table (tag='social').

Replaces ALL HTTP-based sources (Facebook Graph API, Instagram Basic Display,
LinkedIn, X/Twitter, Reddit, Hacker News) which are **blocked on Hugging
Face Spaces free tier** (egress port blackhole) with Tavily AI search +
extract.

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  The previous
  version of this crawler made direct HTTP calls to Facebook, Instagram,
  LinkedIn, Twitter, Reddit and HN APIs — all blocked/unreliable at HF egress.
  This version uses a single Tavily API call (https://api.tavily.com —
  reachable from HF).

  Social-platform tokens (FB_TOKEN, IG_TOKEN, etc.) are still imported for
  completeness but the Tavily path is the primary one. When TAVILY_API_KEY
  is absent, the crawler returns 0 rows (graceful), never crashes.

Sources:
  - Tavily Search + Extract: https://api.tavily.com  (Bearer: TAVILY_API_KEY)
  - Optional (if Tavily keyless yields nothing): HN public API fallback

Scope rules (see crawlers/crawl_scope.py):
  • Years   — 2 consecutive years centred on the crawl year.
  • Location — Đồng Nai → miền Nam → VN → ĐNA.

Graceful degradation:
  - TAVILY_API_KEY absent → 0 rows (or HN fallback), logged, no crash.
  - Tavily unreachable → 0 rows, no crash.
"""
import os, re, sys, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, ensure_column
from crawl_scope import crawl_years, LOCATION_LAYERS
from tavily_client import TavilyClient, tavily_search_and_extract
from tavily_parse import clean_text, parse_tavily_posts

# Social-platform tokens (kept for completeness; Tavily is the primary path).
FB_TOKEN = os.getenv("FB_TOKEN")
IG_TOKEN = os.getenv("IG_TOKEN")
LI_TOKEN = os.getenv("LI_TOKEN")
TWITTER_BEARER = os.getenv("TWITTER_BEARER_TOKEN")

# --- Source: Tavily Vietnamese social/community content ---
_TAVILY_SOCIAL_QUERIES = [
    # Đồng Nai
    "cộng đồng giáo dục Đồng Nai",
    "mạng xã hội giáo dục Biên Hòa",
    # miền Nam
    "cộng đồng sinh viên TP Hồ Chí Minh",
    "cộng đồng developer miền Nam",
    # Việt Nam
    "cộng đồng giáo dục Việt Nam 2025",
    "bài viết giáo dục nổi tiếng",
    "cộng đồng học thuật Việt Nam",
    "xã hội giáo dục công nghệ thông minh",
    # keyword-focussed
    "chia sẻ kinh nghiệm học tập",
    "cộng đồng học lập trình Việt Nam",
    "mạng xã hội giáo dục học thuật",
    "cộng đồng nghiên cứu khoa học",
]

TARGET = 120  # soft cap

# HN fallback (public API — may or may not be reachable from HF).
HN_TOP = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM = "https://hacker-news.firebaseio.com/v0/item/{id}.json"


def clean(t):
    return re.sub(r"<[^>]+>", " ", t or "").replace("\n", " ").strip()[:3000]


def _fallback_hn(n=80):
    """HN public API fallback — only when Tavily yields nothing AND HN is reachable."""
    # Uses urllib (stdlib) to avoid requests dependency in cron env.
    import urllib.request, json as _json
    rows = []
    try:
        req = urllib.request.Request(HN_TOP, headers={"User-Agent": "EduMap/1.0"})
        raw_ids = urllib.request.urlopen(req, timeout=20).read().decode("utf-8")
        ids = _json.loads(raw_ids)
        if not isinstance(ids, list):
            return rows
    except Exception as e:
        print(f"  [social] HN fallback unreachable: {e}")
        return rows
    for iid in ids[:n]:
        try:
            req = urllib.request.Request(HN_ITEM.format(id=iid), headers={"User-Agent": "EduMap/1.0"})
            item = _json.loads(urllib.request.urlopen(req, timeout=15).read().decode("utf-8"))
        except Exception:
            continue
        if not item or item.get("type") != "story" or not item.get("title"):
            continue
        rows.append({
            "title": (item["title"])[:255],
            "source": "hackernews_social",
            "content": clean(item.get("text") or item.get("url") or ""),
            "media_urls": Jsonb([]),
            "tags": Jsonb(["social", "hackernews"]),
            "like_count": int(item.get("score") or 0),
            "comment_count": int(item.get("descendants") or 0),
            "status": "active",
            "pinned": False,
        })
        time.sleep(0.1)
    return rows


def crawl():
    """Crawl Vietnamese social/community content via Tavily.

    Replaces FB/IG/LinkedIn/Twitter/Reddit/HN (all blocked on HF Spaces egress).
    Falls back to HN public API when Tavily yields nothing.
    Returns a flat list of posts row dicts (tag=social), deduped by (title, source).
    """
    by_key = {}
    client = TavilyClient()
    tavily_ok = client.is_configured()
    if not tavily_ok:
        print("  [social] TAVILY_API_KEY không được cài đặt — crawl trả về 0 dòng (giảm dần)")
        print("  [social] Thử chế độ keyless của Tavily...")

    if tavily_ok or True:  # Attempt keyless mode regardless.
        for q in _TAVILY_SOCIAL_QUERIES:
            if len(by_key) >= TARGET:
                break
            try:
                results = tavily_search_and_extract(
                    q,
                    search_depth="basic",
                    max_results=8,
                    extract_top_k=5,
                    extract_depth="basic",
                )
                print(f"  [social] [tavily] '{q[:50]}...' → {len(results)} results")
                parsed = parse_tavily_posts(results, post_tag="social", source_name="tavily_social")
                for post in parsed:
                    key = (post["title"], post["source"])
                    if key not in by_key:
                        by_key[key] = post
            except Exception as e:
                print(f"  [social] [warn] Tavily query failed '{q[:50]}...': {e}")
                continue

    # HN fallback only when Tavily yielded nothing AND no social tokens.
    if not by_key and not (FB_TOKEN or IG_TOKEN or LI_TOKEN or TWITTER_BEARER):
        print("  [social] Tavily yielded 0 rows, and no social tokens — falling back to HN public API")
        for row in _fallback_hn(80):
            by_key[(row["title"], row["source"])] = row

    rows = list(by_key.values())
    if len(rows) > TARGET:
        rows = rows[:TARGET]
    print(f"  [social] collected {len(rows)} distinct posts")
    return rows


def run():
    print("social_crawler: start")
    print(f"  [scope] crawl_years={crawl_years()}")
    rows = crawl()
    conn = get_conn()
    try:
        # Ensure posts table has location_scope column.
        ensure_column(conn, "posts", "image_url", "TEXT")
        ensure_column(conn, "posts", "location_scope", "TEXT")
        if rows:
            r = upsert_rows(conn, "posts", rows, ["title", "source"])
            print(f"social_crawler: {r} (-> posts tag=social)")
        else:
            print("social_crawler: 0 rows (Tavily keyless/unreachable — graceful)")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
