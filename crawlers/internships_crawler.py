# -*- coding: utf-8 -*-
"""
Internships crawler -> `internships` table (title UNIQUE).

Replaces ALL HTTP-based sources (RemoteOK, Remotive, ITviec, TopCV, Adzuna)
which are **blocked on Hugging Face Spaces free tier** (egress port blackhole)
with Tavily AI search + extract.

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  The previous
  version of this crawler made direct HTTP calls to RemoteOK, Remotive, ITviec,
  TopCV and Adzuna — all blocked at HF egress.  This version uses a single
  Tavily API call (https://api.tavily.com — reachable from HF).

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
    crawl_years, year_scope_range, in_year_scope,
    LOCATION_LAYERS, location_matches,
)
from tavily_client import TavilyClient, tavily_search_and_extract
from tavily_parse import parse_tavily_jobs, clean_text, _location_layer

# 2 consecutive years (e.g. 2026 -> [2025, 2026])
_CRAWL_YEARS = crawl_years()
_YEAR_MIN, _YEAR_MAX = year_scope_range()
_DEFAULT_DEADLINE = datetime.datetime(_YEAR_MAX, 12, 31, 23, 59, 59)

# Tavily search queries — location-scoped (Đồng Nai → miền Nam → VN → ĐNA)
# plus keyword-focussed queries for specific intern roles.  Vietnamese so
# Tavily returns Vietnamese job boards.
_TAVILY_INTERN_QUERIES = [
    # Đồng Nai
    "tuyển thực tập sinh lập trình viên Đồng Nai 2025",
    "tuyển intern developer Biên Hòa Đồng Nai",
    "thực tập phần mềm Bình Dương",
    # miền Nam
    "tuyển thực tập IT TP Hồ Chí Minh",
    "intern lập trình viên Cần Thơ",
    # Việt Nam
    "tuyển thực tập sinh đại học lập trình Hà Nội",
    "intern software engineer Việt Nam 2025",
    # keyword-focussed
    "thực tập data analyst Việt Nam",
    "thực tập frontend developer Việt Nam",
    "thực tập devops engineer Việt Nam",
    "thực tập UI UX designer giáo dục",
]

TARGET = 100  # soft cap on distinct internships


def _location_layer(location_str):
    if not location_str:
        return "unscoped"
    for layer in LOCATION_LAYERS:
        if location_matches(location_str, layer["keywords"]):
            return layer["label"]
    return "unscoped"


def _intern_row(title, company, description, field, tags, salary, logo=None, deadline=None):
    """Build an internships row dict (same schema as the original source parsers)."""
    desc = clean_text(description or "")
    if tags:
        desc = f"{desc} | Tags: {','.join(str(t) for t in tags)}"[:2000]
    # Year scope: keep items whose deadline falls in the 2-year crawl window;
    # absent an explicit deadline, inherit the crawl-year boundary.
    if deadline is None or not in_year_scope(deadline):
        deadline = _DEFAULT_DEADLINE
    return {
        "title": (title or "")[:255],
        "company_id": None,
        "company_name": (company or "")[:255],
        "location": "Việt Nam",
        "location_scope": "vietnam",
        "description": desc,
        "field": (str(field)[:100] if field else "internship"),
        "location_point": None,
        "salary_range": salary,
        "duration": "Flexible",
        "requirements": "Remote-friendly internship. See description for details.",
        "benefits": "Remote work, flexible schedule, skill development.",
        "deadline": deadline,
        "application_count": 0,
        "status": "open",
        "image_url": logo,
    }


def crawl():
    """Crawl Vietnamese internships via Tavily Search + Extract.

    Replaces RemoteOK + Remotive + ITviec + TopCV + Adzuna (all blocked on
    HF Spaces egress).  Builds location-scoped Vietnamese queries, fetches
    search+extract results, and parses them into ``_intern_row()`` row dicts.

    Returns a flat list of internship dicts (deduped by caller via
    upsert_rows key).  Returns ``[]`` when TAVILY_API_KEY is absent.
    """
    rows = []
    client = TavilyClient()
    if not client.is_configured():
        print("  [internships] TAVILY_API_KEY không được cài đặt — crawl trả về 0 dòng (giảm dần)")
        print("  [internships] Thử chế độ keyless của Tavily...")

    all_results = []
    for q in _TAVILY_INTERN_QUERIES:
        try:
            results = tavily_search_and_extract(
                q,
                search_depth="basic",
                max_results=8,
                extract_top_k=5,
                extract_depth="basic",
            )
            all_results.extend(results)
            print(f"  [internships] [tavily] '{q[:50]}...' → {len(results)} results")
        except Exception as e:
            print(f"  [internships] [warn] Tavily query failed '{q[:50]}...': {e}")
            continue

    # Parse Tavily results — filter to intern/thực tập postings.
    jobs = parse_tavily_jobs(all_results, source_name="tavily")
    for j in jobs:
        title_lower = j["title"].lower()
        if not any(h in title_lower for h in ("intern", "internship", "thực tập", "trainee", "thuc tap")):
            continue
        row = _intern_row(
            title=j["title"],
            company=j["company_name"],
            description=j["description"],
            field="internship",
            tags=json.loads(j["required_skills"]) if j.get("required_skills") else [],
            salary=j["salary_range"] if j["salary_range"] != "Thỏa thuán" else None,
            logo=j.get("image_url"),
            deadline=j.get("application_deadline"),
        )
        rows.append(row)

    if len(rows) > TARGET:
        rows = rows[:TARGET]

    print(f"  [internships] collected {len(rows)} rows via Tavily "
          f"(years in-scope: {crawl_years()})")
    return rows


def run():
    print("internships_crawler: start")
    print(f"  [scope] crawl_years={crawl_years()} | layers={[l['label'] for l in LOCATION_LAYERS]}")
    conn = get_conn()
    try:
        ensure_column(conn, "internships", "image_url", "TEXT")
        ensure_column(conn, "internships", "location_scope", "TEXT")
        rows = crawl()
        if rows:
            r = upsert_rows(conn, "internships", rows, ["title", "company_name"])
            print(f"internships_crawler: {r}")
        else:
            print("internships_crawler: 0 rows (Tavily keyless/unreachable — graceful)")
    finally:
        conn.close()


# Late import for json (used by parse_tavily_jobs output).
import json  # noqa: E402


if __name__ == "__main__":
    run()
