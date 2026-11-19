import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_utils import (
    get_conn, upsert_rows, Jsonb, ensure_column,
    fetch_html, fetch_og_image, make_session, pick_image_urls,
)
from crawl_scope import crawl_years, in_year_scope
from news_sources import (
    NEWS_FEEDS, parse_feed, classify, matched_keywords, strip_html,
)
from tavily_parse import clean_text, extract_deadline

MAX_PER_FEED = int(os.getenv("NEWS_MAX_PER_FEED", "80"))
MAX_TOTAL = int(os.getenv("NEWS_MAX_TOTAL", "400"))
OG_IMAGE_BUDGET = int(os.getenv("NEWS_OG_IMAGE_BUDGET", "40"))
MAX_SCHOLARSHIPS = int(os.getenv("NEWS_MAX_SCHOLARSHIPS", "120"))
ENABLED_FEEDS = [
    s.strip().lower()
    for s in os.getenv("NEWS_FEEDS", "").split(",")
    if s.strip()
]

NOW = datetime.datetime.now(datetime.timezone.utc)


def _provenance(url: str, published) -> str:
    day = (published or NOW).date().isoformat()
    return f"Nguồn chính thức: {url} · Kiểm chứng: {day}"


def _deadline_from(text: str):
    raw = extract_deadline(text or "")
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d/%m/%y"):
        try:
            return datetime.datetime.strptime(raw.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None


def _scholarship_row(item: dict) -> dict:
    url = item["url"]
    published = item["published_at"]
    summary = clean_text(item.get("summary") or "")[:1500]
    description = summary or item["title"]
    description = f"{description}\n\n{_provenance(url, published)}"
    deadline = _deadline_from(summary)
    return {
        "title": item["title"][:255],
        "description": description[:4000],
        "provider": item["source_name"][:255],
        "location": None,
        "value_amount": None,
        "deadline": deadline,
        "image_url": (item.get("images") or [None])[0],
        "eligibility_criteria": Jsonb({
            "source": url,
            "feed": item["source_id"],
            "category": item.get("category") or "",
            "keywords": matched_keywords(item["title"] + " " + summary),
        }),
        "source_url": url,
        "published_at": published,
        "apply_url": url,
        "status": "active",
    }


def _post_row(item: dict, bucket: str) -> dict:
    url = item["url"]
    published = item["published_at"]
    summary = clean_text(item.get("summary") or "")[:2500]
    content = summary or item["title"]
    content = f"{content}\n\n{_provenance(url, published)}"
    tag = "cuocthi" if bucket == "competition" else "taitro"
    return {
        "title": item["title"][:255],
        "source": item["source_id"],
        "content": content[:6000],
        "media_urls": Jsonb(pick_image_urls(item.get("images") or [], limit=3)),
        "tags": Jsonb([tag, "news", item["source_id"]]),
        "like_count": 0,
        "comment_count": 0,
        "status": "active",
        "pinned": False,
        "location_scope": "vietnam",
        "source_url": url,
        "published_at": published,
    }


def _wants_feed(source_id: str) -> bool:
    return not ENABLED_FEEDS or source_id in ENABLED_FEEDS


def crawl():
    """Read Vietnamese education RSS feeds and keep scholarship / competition /
    sponsorship articles.

    Every kept row carries ``source_url`` + ``published_at`` + the publisher in
    ``provider``/``source`` — nothing is generated, only articles that really
    exist are stored. ``[]`` is returned when every feed is unreachable.
    """
    session = make_session()
    scholarships = {}
    posts = {}
    seen_urls = set()
    og_used = 0
    per_feed_stats = {}

    for feed in NEWS_FEEDS:
        if not _wants_feed(feed["id"]):
            continue
        if len(scholarships) + len(posts) >= MAX_TOTAL:
            break
        kept = 0
        scanned = 0
        for feed_url in feed["urls"]:
            xml = fetch_html(session, feed_url)
            if not xml:
                print(f"  [news] {feed['id']} unreachable: {feed_url}")
                continue
            items = parse_feed(xml, feed["id"], feed["name"])
            scanned += len(items)
            for item in items:
                if kept >= MAX_PER_FEED:
                    break
                if item["url"] in seen_urls:
                    continue
                published = item.get("published_at")
                if published and not in_year_scope(published.date().isoformat()):
                    continue
                bucket = classify(item["title"], item.get("summary") or "")
                if bucket is None:
                    continue
                if not item.get("images") and og_used < OG_IMAGE_BUDGET:
                    og_used += 1
                    og = fetch_og_image(session, item["url"])
                    if og:
                        item["images"] = [og]
                seen_urls.add(item["url"])
                if bucket == "scholarship":
                    if len(scholarships) < MAX_SCHOLARSHIPS:
                        scholarships[item["url"]] = _scholarship_row(item)
                        kept += 1
                else:
                    posts[item["url"]] = _post_row(item, bucket)
                    kept += 1
        per_feed_stats[feed["id"]] = {"scanned": scanned, "kept": kept}
        print(f"  [news] {feed['id']}: scanned={scanned} kept={kept}")

    print(f"  [news] feeds={per_feed_stats}")
    print(f"  [news] scholarships={len(scholarships)} posts={len(posts)} og_images={og_used}")
    return list(scholarships.values()), list(posts.values())


def run():
    print("news_crawler: start")
    print(f"  [scope] crawl_years={crawl_years()}")
    scholarship_rows, post_rows = crawl()
    if not scholarship_rows and not post_rows:
        print("news_crawler: 0 rows (feeds unreachable — graceful)")
        return
    conn = get_conn()
    try:
        ensure_column(conn, "scholarships", "image_url", "TEXT")
        ensure_column(conn, "scholarships", "source_url", "TEXT")
        ensure_column(conn, "scholarships", "published_at", "TIMESTAMP WITH TIME ZONE")
        ensure_column(conn, "posts", "source", "TEXT")
        ensure_column(conn, "posts", "source_url", "TEXT")
        ensure_column(conn, "posts", "published_at", "TIMESTAMP WITH TIME ZONE")
        ensure_column(conn, "posts", "location_scope", "TEXT")
        if scholarship_rows:
            r = upsert_rows(conn, "scholarships", scholarship_rows, ["title"])
            print(f"news_crawler: scholarships {r}")
        if post_rows:
            r = upsert_rows(conn, "posts", post_rows, ["title", "source"])
            print(f"news_crawler: posts {r}")
    finally:
        conn.close()


if __name__ == "__main__":
    run()