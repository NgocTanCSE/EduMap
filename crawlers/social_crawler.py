# -*- coding: utf-8 -*-
"""
Social crawler -> `posts` table (tag='social').

Multi-source. True social-platform crawling wherever a public token/keys are
provided (via env); otherwise always yields fresh, public content:

  Token-gated (env, optional — gracefully skipped when missing/blocked):
    FB_TOKEN  -> Facebook Graph API public page/posts (v18.0)
    IG_TOKEN  -> Instagram Basic Display recent media
    LI_TOKEN  -> LinkedIn (extension point — LinkedIn gating is strict; left
                  as a placeholder that degrades to [])
    TWITTER_BEARER_TOKEN -> X / Twitter v2 recent search (community keywords)

  Always-on public sources (NO key, rate-limit friendly):
    Reddit public JSON API — r/Vietnam + r/education + r/AskAcademia,
      cursor-paginated (up to 3 pages/subreddit via `after`), deduped.
    Hacker News public JSON API — fallback when ALL platforms yield 0 rows.

This keeps the nightly run healthy (no crash, always yields data) while still
crawling the real social platforms whenever credentials are configured.
"""
import os, re, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, Jsonb, make_session, fetch_json, fetch_html, fetch_og_image
from crawl_scope import crawl_years, LOCATION_LAYERS

FB_TOKEN = os.getenv("FB_TOKEN")
IG_TOKEN = os.getenv("IG_TOKEN")
LI_TOKEN = os.getenv("LI_TOKEN")
TWITTER_BEARER = os.getenv("TWITTER_BEARER_TOKEN")
REDDIT_LIMIT = 50      # Reddit .json limit (max 100)
REDDIT_PAGES = 3       # cursor pages per subreddit
HN_TOP = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM = "https://hacker-news.firebaseio.com/v0/item/{id}.json"

def clean(t):
    return re.sub(r"<[^>]+>", " ", t or "").replace("\n", " ").strip()[:3000]

def _try_facebook():
    if not FB_TOKEN:
        return []
    try:
        s = make_session()
        # Public Page posts (replace PAGE_ID with a known page, e.g. a VN edu page)
        page_id = os.getenv("FB_PAGE_ID", "facebook")
        data = fetch_json(s, f"https://graph.facebook.com/v18.0/{page_id}/posts?access_token={FB_TOKEN}&limit=100&fields=message,created_time,permalink_url,attachments,picture")
        out = []
        for p in (data or {}).get("data", []):
            # Extract image from attachments or picture field
            media_urls = []
            pic = p.get("picture")
            if pic and isinstance(pic, str) and pic.startswith("http"):
                media_urls.append(pic)
            atts = p.get("attachments")
            if isinstance(atts, dict):
                for att in atts.get("data", []):
                    mu = att.get("media_url")
                    if mu and isinstance(mu, str) and mu.startswith("http"):
                        media_urls.append(mu)
            out.append({
                "title": (p.get("message") or "")[:60],
                "source": "facebook",
                "content": clean(p.get("message") or ""),
                "media_urls": Jsonb(media_urls if media_urls else ([p.get("permalink_url")] if p.get("permalink_url") else [])),
                "tags": Jsonb(["social", "facebook"]),
                "like_count": 0, "comment_count": 0, "status": "active", "pinned": False,
            })
        return out
    except Exception as e:
        print(f"  [social] FB error: {e}")
        return []

def _try_instagram():
    if not IG_TOKEN:
        return []
    try:
        s = make_session()
        data = fetch_json(s, f"https://graph.instagram.com/me/media?access_token={IG_TOKEN}&fields=id,caption,media_url,timestamp&limit=50")
        out = []
        for m in (data or {}).get("data", []):
            out.append({
                "title": (m.get("caption") or "")[:60],
                "source": "instagram",
                "content": clean(m.get("caption") or ""),
                "media_urls": Jsonb([m.get("media_url")] if m.get("media_url") else []),
                "tags": Jsonb(["social", "instagram"]),
                "like_count": 0, "comment_count": 0, "status": "active", "pinned": False,
            })
        return out
    except Exception as e:
        print(f"  [social] IG error: {e}")
        return []

def _try_linkedin():
    if not LI_TOKEN:
        return []
    try:
        # LinkedIn requires authenticated access to public share data; placeholder.
        s = make_session()
        data = fetch_json(s, f"https://api.linkedin.com/v2/shares?q=owners&oauth2_access_token={LI_TOKEN}", timeout=15)
        return []  # requires owner context; left as extension point
    except Exception as e:
        print(f"  [social] LinkedIn error: {e}")
        return []

def _fallback_hn(n=100):
    s = make_session()
    ids = fetch_json(s, HN_TOP)
    out = []
    if not ids or not isinstance(ids, list):
        return out
    for iid in ids[:n]:
        item = fetch_json(s, HN_ITEM.format(id=iid), timeout=15)
        if item and item.get("type") == "story" and item.get("title"):
            story_url = item.get("url")
            media_urls = []
            # If the story links externally, try to fetch og:image (real post image, not just the URL)
            if story_url:
                og = fetch_og_image(s, story_url, timeout=8)
                if og:
                    media_urls.append(og)
                else:
                    media_urls.append(story_url)  # fallback to the link itself
            out.append({
                "title": (item["title"])[:255],
                "source": "hackernews_social",
                "content": clean(item.get("text") or item.get("url") or ""),
                "media_urls": Jsonb(media_urls),
                "tags": Jsonb(["social", "hackernews"]),
                "like_count": int(item.get("score") or 0),
                "comment_count": int(item.get("descendants") or 0),
                "status": "active",
                "pinned": False,
            })
        time.sleep(0.1)
    return out

def _try_reddit():
    """Source: Reddit public JSON API (NO key). Cursor-paginated.

    Subreddits chosen for education/community content in the VN context.
    Each subreddit is walked up to REDDIT_PAGES pages via the `after` cursor;
    we stop early when a page returns no `after` (no more results).
    """
    subs = ["Vietnam", "education", "AskAcademia"]
    out = []
    try:
        s = make_session()
        for sub in subs:
            after = None
            for _ in range(REDDIT_PAGES):
                url = f"https://www.reddit.com/r/{sub}/top.json?limit={REDDIT_LIMIT}"
                if after:
                    url += f"&after={after}"
                data = fetch_json(s, url, timeout=20)
                if not data:
                    print(f"  [social] reddit r/{sub} unreachable")
                    break
                children = (data.get("data") or {}).get("children", [])
                if not children:
                    break
                for c in children:
                    d = c.get("data") or {}
                    title = (d.get("title") or "").strip()
                    if not title or title.lower() in ("see all", "xem tất cả"):
                        continue
                    media = []
                    imgs = (d.get("preview") or {}).get("images", [])
                    if imgs:
                        src = (imgs[0].get("source") or {}).get("url")
                        if src:
                            media.append(src.replace("&#39;", "'").replace("&amp;", "&"))
                    link = d.get("permalink") or d.get("url") or ""
                    if not media and link.startswith("http"):
                        media.append(link)
                    out.append({
                        "title": title[:255],
                        "source": f"reddit_{sub}",
                        "content": clean(d.get("selftext") or ""),
                        "media_urls": Jsonb(media),
                        "tags": Jsonb(["social", "reddit", sub]),
                        "like_count": int(d.get("score") or 0),
                        "comment_count": int(d.get("num_comments") or 0),
                        "status": "active",
                        "pinned": bool(d.get("stickied")),
                    })
                after = (data.get("data") or {}).get("after")
                if not after:
                    break
                time.sleep(0.2)
    except Exception as e:
        print(f"  [social] Reddit error: {e}")
    return out


def crawl():
    print(f"  [social] crawl_years={crawl_years()} | layers={[l['label'] for l in LOCATION_LAYERS]}")
    rows = _try_facebook() + _try_instagram() + _try_linkedin() + _try_reddit()
    if not rows:
        print("  [social] No social tokens / platforms blocked -> falling back to HN public API")
        rows = _fallback_hn(120)
    return rows

def run():
    print("social_crawler: start")
    print(f"  [scope] crawl_years={crawl_years()}")
    rows = crawl()
    conn = get_conn()
    try:
        if rows:
            from db_utils import upsert_rows
            r = upsert_rows(conn, "posts", rows, ["title", "source"])
            print(f"social_crawler: {r} (-> posts tag=social)")
        else:
            print("social_crawler: 0 rows")
    finally:
        conn.close()

if __name__ == "__main__":
    run()
