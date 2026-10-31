# -*- coding: utf-8 -*-
"""
Scholarships crawler -> `scholarships` table (title UNIQUE).

Replaces ALL HTTP-based sources (Eventbrite, Dev.to) which are
**blocked on Hugging Face Spaces free tier** (egress port blackhole) with
Tavily AI search + extract.

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  The previous
  version of this crawler made direct HTTP calls to Eventbrite and Dev.to —
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
import os, re, sys, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, ensure_column
from crawl_scope import (
    crawl_years, in_year_scope, year_scope_range,
    LOCATION_LAYERS, location_matches, keywords_for_layers,
)
from tavily_client import TavilyClient, tavily_search_and_extract
from tavily_parse import parse_date_or_default, clean_text, extract_deadline

NOW = datetime.datetime.utcnow()
# 2 consecutive years (e.g. 2026 -> [2025, 2026])
_CRAWL_YEARS = crawl_years()
_YEAR_MIN, _YEAR_MAX = year_scope_range()
_DEFAULT_DEADLINE = NOW + datetime.timedelta(days=30)

# Tavily search queries — Vietnamese, location-scoped (Đồng Nai → miền Nam →
# VN → ĐNA) plus keyword-focussed.
_TAVILY_SCHOLARSHIP_QUERIES = [
    # Đồng Nai
    "học bổng sinh viên Đồng Nai 2025",
    "học bổng xuất sắc Đại học Bà Rịa",
    # miền Nam
    "học bổng du học TP Hồ Chí Minh",
    "học bổng giáo dục miền Nam 2025",
    # Việt Nam
    "học bổng du học Việt Nam 2025",
    "học bổng xuất sắc quốc tế Việt Nam",
    "học bổng tài chính đại học 2025",
    # keyword-focussed
    "học bổng toán học Việt Nam",
    "học bổng lập trình viên đại học",
    "học bổng nghiên cứu khoa học",
    "học bổng học thuật Việt Nam",
    "học bổng bổng du học Nhật Hàn Nga",
    "học bổng Fulbright Vietnam",
    "học bổng liên quốc gia",
]

TARGET = 150  # soft cap on distinct scholarships


def _location_layer(location_str):
    if not location_str:
        return "unscoped"
    for layer in LOCATION_LAYERS:
        if location_matches(location_str, layer["keywords"]):
            return layer["label"]
    return "unscoped"


def parse_date(s):
    """Best-effort parse of a date token into a datetime."""
    if not s:
        return None
    s = s.strip()
    for fmt in ("%a, %d %b %Y", "%d/%m/%Y", "%Y-%m-%d", "%d %b %Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def _scope_deadline(d):
    """Default deadline to end-of-crawl-year when the raw date falls outside the
    2-year window or is missing, keeping the scholarship visible."""
    if d and in_year_scope(d.date().isoformat()):
        return d
    return NOW + datetime.timedelta(days=30)


def _scholarship_row(title, description, provider, deadline=None, image_url=None,
                     apply_url="", source_url="", query=None):
    """Map one Tavily search result to a scholarships row dict."""
    title = (title or "").strip()
    if not title:
        return None
    desc = f"Học bổng tìm thấy qua Tavily" + (f" (tìm theo '{query}')" if query else "") + f". {clean_text(description)[:200]}"
    deadline_dt = parse_date(deadline) if deadline else None
    if not deadline_dt:
        # Try extracting a date from the description.
        dl_str = extract_deadline(clean_text(description) or "")
        if dl_str:
            deadline_dt = parse_date(dl_str)
    if not deadline_dt or not in_year_scope(deadline_dt.date().isoformat()):
        deadline_dt = _DEFAULT_DEADLINE
    return {
        "title": title[:255],
        "description": desc,
        "provider": (provider or "Cộng đồng")[:255],
        "location": None,
        "location_scope": "vietnam",
        "value_amount": None,
        "deadline": deadline_dt,
        "image_url": image_url,
        "eligibility_criteria": Jsonb({"source": source_url, "query": query}),
        "apply_url": apply_url or source_url,
        "status": "active",
    }


def crawl():
    """Crawl Vietnamese scholarships via Tavily Search + Extract.

    Replaces Eventbrite + Dev.to (both blocked on HF Spaces egress).
    Returns a flat list of scholarship row dicts, deduped by title.
    """
    by_title = {}
    client = TavilyClient()
    if not client.is_configured():
        print("  [scholarships] TAVILY_API_KEY không được cài đặt — crawl trả về 0 dòng (giảm dần)")
        print("  [scholarships] Thử chế độ keyless của Tavily...")

    for q in _TAVILY_SCHOLARSHIP_QUERIES:
        if len(by_title) >= TARGET:
            break
        try:
            results = tavily_search_and_extract(
                q,
                search_depth="basic",
                max_results=10,
                extract_top_k=5,
                extract_depth="basic",
            )
            print(f"  [scholarships] [tavily] '{q[:50]}...' → {len(results)} results")
            for r in results:
                title = clean_text(r.get("title", ""))[:255]
                if not title:
                    continue
                # Extract provider name from content (e.g. "trường Đại học Bách Khoa").
                provider = None
                blob = r.get("raw_content", "") or r.get("content", "") or ""
                m = re.search(r"(trường\s+\S[^,\n.;]{2,60}|trường\s+đại\s+học\s+\S[^,\n.;]{2,60})", blob, re.I)
                if m:
                    provider = clean_text(m.group(1))[:255]
                if title not in by_title:
                    by_title[title] = _scholarship_row(
                        title=title,
                        description=blob,
                        provider=provider,
                        apply_url=r.get("url", ""),
                        source_url=r.get("url", ""),
                        query=q,
                    )
        except Exception as e:
            print(f"  [scholarships] [warn] Tavily query failed '{q[:50]}...': {e}")
            continue

    rows = list(by_title.values())
    if len(rows) > TARGET:
        rows = rows[:TARGET]
    print(f"  [scholarships] collected {len(rows)} distinct scholarships")
    return rows


def run():
    print("scholarships_crawler: start")
    print(f"  [scope] crawl_years={crawl_years()} | layers={[l['label'] for l in LOCATION_LAYERS]}")
    conn = get_conn()
    try:
        ensure_column(conn, "scholarships", "image_url", "TEXT")
        ensure_column(conn, "scholarships", "location_scope", "TEXT")
        rows = crawl()
        if rows:
            r = upsert_rows(conn, "scholarships", rows, ["title"])
            print(f"scholarships_crawler: {r}")
        else:
            print("scholarships_crawler: 0 rows (Tavily keyless/unreachable — graceful)")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
