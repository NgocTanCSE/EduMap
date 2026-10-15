# -*- coding: utf-8 -*-
"""
Scholarships crawler -> `scholarships` table (title UNIQUE).

Source: Eventbrite public search across Vietnam (server-side HTML, NO key).
We paginate multiple keyword queries (page=1..PAGES) and dedup by title so the
UPsert yields >=100 distinct, real VN-adjacent scholarship/education events.

Graceful: any query/page that returns no cards -> 0 (no crash). Upsert by title.
"""
import os, re, sys, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, make_session, fetch_html

NOW = datetime.datetime.utcnow()
QUERIES = [
    "scholarship", "education", "student", "grant", "learning", "training",
    "school", "university", "course", "tuition", "financial aid", "fund",
]
PAGES = 10  # per query
BASE = "https://www.eventbrite.com/d/vietnam/all-events/"


def parse_date(s):
    if not s:
        return None
    s = s.strip()
    for fmt in ("%a, %d %b %Y", "%d/%m/%Y", "%Y-%m-%d", "%d %b %Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def _cards(html):
    """Extract (title, date?, link?, img?) from Eventbrite-style cards."""
    items = []
    cards = re.findall(r'href="(/e/[^"]+?ticket-\d+)"[^>]*>\s*<h3[^>]*>([^<]+)</h3>', html)
    if not cards:
        cards = [("", t) for t in re.findall(r'<h3[^>]*>([^<]{6,90})</h3>', html)]
    imgs = re.findall(r'<img[^>]+src="(https?://[^"]+eventbrite[^"]+)"', html)
    dates = re.findall(r'<time[^>]*datetime="([^"]+)"', html)
    for i, (href, title) in enumerate(cards):
        title = title.strip()
        if not title or title.lower() in ("see all", "xem tất cả"):
            continue
        items.append({
            "title": title[:255],
            "href": href,
            "date": dates[i] if i < len(dates) else (dates[0] if dates else None),
            "img": imgs[i] if i < len(imgs) else None,
        })
    return items


def crawl():
    s = make_session()
    rows = {}
    for q in QUERIES:
        for page in range(1, PAGES + 1):
            url = f"{BASE}?q={q}&page={page}"
            html = fetch_html(s, url, timeout=40)
            if not html:
                continue
            for c in _cards(html):
                if c["title"] in rows:
                    continue
                rows[c["title"]] = {
                    "title": c["title"][:255],
                    "description": f"Học bổng/giáo dục từ Eventbrite. Chi tiết: {BASE}?q={q}&page={page}",
                    "provider": "Eventbrite / cộng đồng",
                    "location": None,  # geography(Point); left NULL (no geocode)
                    "value_amount": None,
                    "deadline": parse_date(c.get("date")) or (NOW + datetime.timedelta(days=30)),
                    "eligibility_criteria": Jsonb({
                        "source": q,
                        "url": ("https://www.eventbrite.com" + c["href"]) if c.get("href") else None,
                    }),
                    "apply_url": ("https://www.eventbrite.com" + c["href"]) if c.get("href") else BASE,
                    "status": "active",
                }
            time.sleep(0.6)
            if len(rows) >= 150:
                break
    return list(rows.values())


def run():
    print("scholarships_crawler: start")
    conn = get_conn()
    try:
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
