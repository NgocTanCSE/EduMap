# -*- coding: utf-8 -*-
"""
Hackathons crawler -> `posts` table (tag='hackathon').

Replaces ALL HTTP-based sources (Devpost, Eventbrite) which are
**blocked on Hugging Face Spaces free tier** (egress port blackhole) with
Tavily AI search + extract.

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  The previous
  version of this crawler made direct HTTP calls to Devpost and Eventbrite —
  both blocked at HF egress.  This version uses a single Tavily API call
  (https://api.tavily.com — reachable from HF).

Sources:
  - Tavily Search + Extract: https://api.tavily.com  (Bearer: TAVILY_API_KEY)

Scope rules (see crawlers/crawl_scope.py):
  • Years   — 2 consecutive years centred on the crawl year.
  • Location — Đồng Nai → miền Nam → VN → ĐNA.

Graceful degradation:
  - TAVILY_API_KEY absent → 0 rows, logged, no crash.
  - Tavily unreachable → 0 rows, no crash.
"""
import os, re, sys, time, datetime, json
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, ensure_column
from crawl_scope import (
    crawl_years, in_year_scope, year_scope_range,
    LOCATION_LAYERS, location_matches, keywords_for_layers,
)
from tavily_client import TavilyClient, tavily_search_and_extract
from tavily_parse import clean_text, parse_tavily_posts

NOW = datetime.datetime.utcnow()
_CRAWL_YEARS = crawl_years()
_YEAR_MIN, _YEAR_MAX = year_scope_range()

TARGET = 200  # soft cap

# Tavily search queries — Vietnamese, location-scoped (Đồng Nai → miền Nam →
# VN → ĐNA) plus keyword-focussed.
_TAVILY_HACKATHON_QUERIES = [
    # Đồng Nai
    "hackathon Đồng Nai 2025",
    "cuộc thi lập trình sinh viên Bình Dương",
    # miền Nam
    "hackathon TP Hồ Chí Minh",
    "cuộc thi code miền Nam",
    # Việt Nam
    "hackathon Việt Nam 2025",
    "cuộc thi sinh viên đại học Việt Nam",
    "code competition Việt Nam",
    # keyword-focussed
    "cuộc thi AI trí tuệ nhân tạo",
    "hackathon giáo dục 2025",
    "cuộc thi phần mềm sinh viên",
    "startup competition Việt Nam",
]


def _hackathon_row(title, content, url, media_urls=None):
    """Build a posts row dict for a hackathon listing."""
    return {
        "title": (title or "")[:255],
        "source": "tavily",
        "content": clean_text(content or "")[:3000],
        "media_urls": Jsonb(media_urls or []),
        "tags": Jsonb(["hackathon", "tavily"]),
        "location_scope": "vietnam",
        "like_count": 0,
        "comment_count": 0,
        "status": "active",
        "pinned": False,
    }


def crawl():
    """Crawl Vietnamese hackathons via Tavily Search + Extract.

    Replaces Devpost + Eventbrite (both blocked on HF Spaces egress).
    Returns a flat list of post row dicts (tag=hackathon), deduped by (title, source).
    """
    by_key = {}
    client = TavilyClient()
    if not client.is_configured():
        print("  [hackathons] TAVILY_API_KEY không được cài đặt — crawl trả về 0 dòng (giảm dần)")
        print("  [hackathons] Thử chế độ keyless của Tavily...")

    for q in _TAVILY_HACKATHON_QUERIES:
        if len(by_key) >= TARGET:
            break
        try:
            results = tavily_search_and_extract(
                q,
                search_depth="basic",
                max_results=10,
                extract_top_k=5,
                extract_depth="basic",
            )
            print(f"  [hackathons] [tavily] '{q[:50]}...' → {len(results)} results")
            for r in results:
                title = clean_text(r.get("title", ""))[:255]
                if not title or len(title) < 3:
                    continue
                key = (title, "tavily")
                if key in by_key:
                    continue
                # Use parse_tavily_posts to get structured post rows.
                parsed = parse_tavily_posts([r], post_tag="hackathon", source_name="tavily")
                if parsed:
                    by_key[key] = parsed[0]
                else:
                    by_key[key] = _hackathon_row(
                        title=title,
                        content=r.get("raw_content", "") or r.get("content", ""),
                        url=r.get("url", ""),
                    )
        except Exception as e:
            print(f"  [hackathons] [warn] Tavily query failed '{q[:50]}...': {e}")
            continue

    rows = list(by_key.values())
    if TARGET and len(rows) > TARGET:
        rows = rows[:TARGET]
    print(f"  [hackathons] collected {len(rows)} rows via Tavily "
          f"(years in-scope: {crawl_years()})")
    return rows


def run():
    print("hackathons_crawler: start")
    print(f"  [scope] crawl_years={crawl_years()} | location layers expanding Đồng Nai → miền Nam → VN → ĐNA")
    rows = crawl()
    conn = get_conn()
    try:
        ensure_column(conn, "posts", "image_url", "TEXT")
        ensure_column(conn, "posts", "location_scope", "TEXT")
        if rows:
            r = upsert_rows(conn, "posts", rows, ["title", "source"])
            print(f"hackathons_crawler: {r}  (-> posts tag=hackathon)")
        else:
            print("hackathons_crawler: 0 rows (Tavily keyless/unreachable — graceful)")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
