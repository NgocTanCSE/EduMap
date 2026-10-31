# -*- coding: utf-8 -*-
"""
Donations / fundraising campaigns crawler -> `donation_campaigns` table
(title UNIQUE).

Replaces ALL HTTP-based sources (Eventbrite) which are
**blocked on Hugging Face Spaces free tier** (egress port blackhole) with
Tavily AI search + extract.

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  The previous
  version of this crawler made direct HTTP calls to Eventbrite — blocked at
  HF egress.  This version uses a single Tavily API call
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
import os, re, sys, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, ensure_column
from crawl_scope import (
    crawl_years, in_year_scope, year_scope_range,
    LOCATION_LAYERS, location_matches, keywords_for_layers,
)
from tavily_client import TavilyClient, tavily_search_and_extract
from tavily_parse import clean_text, make_donation_row, extract_deadline

NOW = datetime.datetime.utcnow()
_CRAWL_YEARS = crawl_years()
_YEAR_MIN, _YEAR_MAX = year_scope_range()

# Tavily search queries — Vietnamese, location-scoped (Đồng Nai → miền Nam → VN)
# plus keyword-focussed fundraising queries.
_TAVILY_DONATION_QUERIES = [
    # Đồng Nai
    "quyên góp từ thiện giáo dục Đồng Nai",
    "chiến dịch gây quỹ trường học Biên Hòa",
    # miền Nam
    "quyên góp giáo dục TP Hồ Chí Minh",
    "gây quỹ từ thiện miền Nam",
    # Việt Nam
    "quyên góp xây trường học Việt Nam",
    "chiến dịch từ thiện giáo dục 2025",
    "gây quỹ đầu tư trang thiết bị giáo dục",
    # keyword-focussed
    "học bổng từ thiện sinh viên nghèo",
    "quyên góp xây nhà trường vùng sâu",
    "gây quỹ sách cho thư viện trường học",
    "chiến dịch hiến thuốc tặng thuốc cho bệnh viện",
    "từ thiện công nghệ thông tin trường học",
]

TARGET = 150
CAP = 500


def _money(s):
    """'1,234' / '$1,234' / '1.2k' / '15 triệu' -> numeric string. None if unparseable."""
    if not s:
        return None
    s = s.replace("$", "").replace(",", "").replace(" ", "").strip().lower()
    m = re.match(r"^([\d.]+)k$", s)
    if m:
        try:
            return int(float(m.group(1)) * 1000)
        except ValueError:
            return None
    try:
        return int(float(s))
    except ValueError:
        return None


def _parse_amounts(text):
    """Extract (current_amount, target_amount) from a campaign description."""
    if not text:
        return None, None
    cur = tgt = None
    # "Đã quyên góp X / mục tiêu Y", "raised X of Y", "X / Y"
    m = re.search(r"(?:đã\s*quyên\s*góp|raised|quyên\s*góp|hiện\s*có)\s*([\d\.,\s]*(?:triệu|đ|vnd|usd|eur|$)?)",
                  text, re.IGNORECASE)
    if m and m.group(1):
        cur = _money(m.group(1))
    m2 = re.search(r"(?:mục\s*tiêu|hôm\s*nay|goal|target|của)\s*([\d\.,\s]*(?:triệu|đ|vnd|usd|eur|$)?)",
                   text, re.IGNORECASE)
    if m2 and m2.group(1):
        tgt = _money(m2.group(1))
    if cur is None:
        # Look for a monetary amount in the text.
        m3 = re.search(r"([\d\.,]+\s*(?:triệu|đ|vnd|usd|eur|\$))", text, re.IGNORECASE)
        if m3:
            cur = _money(m3.group(1))
    return cur, tgt


def _donation_row(title, description, source_url, query=None):
    """Map one Tavily result to a donation_campaigns row dict."""
    title = (title or "").strip()
    if not title:
        return None
    desc = clean_text(description or "")
    cur, tgt = _parse_amounts(desc)
    suffix = f" (tìm theo '{query}')" if query else ""
    banner = None
    # Look for image URL in the raw content.
    m = re.search(r'(https?://[^\s"\'<>]+?\.(?:jpg|jpeg|png|gif|webp))', desc[:2000])
    if m:
        banner = m.group(1)
    return make_donation_row(
        title=title[:255],
        description=f"Chiến dịch quyên góp tìm thấy qua Tavily{suffix}. {desc[:500]}",
        target_amount=tgt or 0,
        current_amount=cur or 0,
        image_url=banner,
        source_url=source_url,
    )


def crawl():
    """Crawl Vietnamese fundraising campaigns via Tavily Search + Extract.

    Replaces Eventbrite (blocked on HF Spaces egress).
    Returns a flat list of donation_campaigns row dicts, deduped by title.
    """
    by_title = {}
    client = TavilyClient()
    if not client.is_configured():
        print("  [donations] TAVILY_API_KEY không được cài đặt — crawl trả về 0 dòng (giảm dần)")
        print("  [donations] Thử chế độ keyless của Tavily...")

    for q in _TAVILY_DONATION_QUERIES:
        if len(by_title) >= CAP:
            break
        try:
            results = tavily_search_and_extract(
                q,
                search_depth="basic",
                max_results=10,
                extract_top_k=5,
                extract_depth="basic",
            )
            print(f"  [donations] [tavily] '{q[:50]}...' → {len(results)} results")
            for r in results:
                title = clean_text(r.get("title", ""))[:255]
                if not title:
                    continue
                row = _donation_row(
                    title=title,
                    description=r.get("raw_content", "") or r.get("content", ""),
                    source_url=r.get("url", ""),
                    query=q,
                )
                if row and title not in by_title:
                    by_title[title] = row
        except Exception as e:
            print(f"  [donations] [warn] Tavily query failed '{q[:50]}...': {e}")
            continue

    rows = list(by_title.values())
    if len(rows) > TARGET:
        rows = rows[:TARGET]
    print(f"  [donations] collected {len(rows)} distinct campaigns")
    return rows


def run():
    print("donations_crawler: start")
    print(f"  [scope] crawl_years={crawl_years()} | expanding Đồng Nai → miền Nam → VN → ĐNA")
    rows = crawl()
    conn = get_conn()
    try:
        ensure_column(conn, "donation_campaigns", "image_url", "TEXT")
        ensure_column(conn, "donation_campaigns", "location_scope", "TEXT")
        if rows:
            r = upsert_rows(conn, "donation_campaigns", rows, ["title"])
            print(f"donations_crawler: {r}")
        else:
            print("donations_crawler: 0 rows (Tavily keyless/unreachable — graceful)")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
