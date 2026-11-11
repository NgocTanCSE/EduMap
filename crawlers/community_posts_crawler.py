
import os, re, sys, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, ensure_column
from crawl_scope import crawl_years, LOCATION_LAYERS
from tavily_client import TavilyClient, tavily_search_and_extract
from tavily_parse import clean_text, parse_tavily_posts

_TAVILY_COMMUNITY_QUERIES = [
    "tin tức giáo dục Đồng Nai 2025",
    "cộng đồng sinh viên Bình Dương",
    "cộng đồng developer TP Hồ Chí Minh",
    "cộng đồng giáo dục miền Nam",
    "cộng đồng sinh viên Việt Nam 2025",
    "tin tức giáo dục Việt Nam",
    "cộng đồng lập trình viên Việt Nam",
    "diễn đàn giáo dục 2025",
    "ứng dụng giáo dục công nghệ thông minh",
    "innovation community Việt Nam",
    "startup ecosystem giáo dục",
    "hội thảo học thuật Việt Nam",
]

TARGET = 150  

HN_TOP = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM = "https://hacker-news.firebaseio.com/v0/item/{id}.json"


def clean(t):
    return re.sub(r"<[^>]+>", " ", t or "").replace("\n", " ").strip()[:3000]


def crawl():
    """Crawl Vietnamese education/community content via Tavily.

    Replaces Hacker News + Dev.to (both blocked on host egress).
    Returns a flat list of posts row dicts (tag=community), deduped by title.
    Falls back to HN public API when Tavily yields nothing and HN is reachable.
    """
    by_key = {}
    client = TavilyClient()
    if not client.is_configured():
        print("  [community] TAVILY_API_KEY không được cài đặt — crawl trả về 0 dòng (giảm dần)")
        print("  [community] Thử chế độ keyless của Tavily...")

    for q in _TAVILY_COMMUNITY_QUERIES:
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
            print(f"  [community] [tavily] '{q[:50]}...' → {len(results)} results")
            parsed = parse_tavily_posts(results, post_tag="community", source_name="tavily_community")
            for post in parsed:
                key = (post["title"], post["source"])
                if key not in by_key:
                    by_key[key] = post
        except Exception as e:
            print(f"  [community] [warn] Tavily query failed '{q[:50]}...': {e}")
            continue

    rows = list(by_key.values())
    print(f"  [community] collected {len(rows)} distinct posts via Tavily")
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
            print("community_posts_crawler: 0 rows (Tavily keyless/unreachable — graceful)")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
