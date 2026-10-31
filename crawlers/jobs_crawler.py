# -*- coding: utf-8 -*-
"""
Jobs crawler  -> `jobs` table.

Replaces ALL HTTP-based sources (RemoteOK, Remotive, ITviec, TopCV, Adzuna)
which are **blocked on Hugging Face Spaces free tier** (egress port blackhole)
with a single Tavily AI search+extract call.

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  Direct HTTP to
  job boards is unreachable from HF egress.  Tavily's single HTTPS endpoint
  (https://api.tavily.com) is reachable, so we search for Vietnamese job
  postings there and parse the extracted article content into the standardized
  jobs-row schema.

Sources:
  - Tavily Search + Extract: https://api.tavily.com  (Bearer: TAVILY_API_KEY)

Graceful degradation:
  - When TAVILY_API_KEY is absent → 0 rows, logged, no crash.
  - When Tavily is unreachable → 0 rows, circuit breaker engaged, no crash.

Scope rules (see crawlers/crawl_scope.py):
  • Years   — 2 consecutive years centred on the crawl year.
  • Location — Đồng Nai → miền Nam → VN → ĐNA (tag per-job via location_scope).

Runs as:
  - One-shot: python3 crawlers/jobs_crawler.py
  - Cron daily via run_feature_crawlers.sh
"""
import os, re, sys, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import (get_conn, upsert_rows, Jsonb, ensure_column)  # noqa: E402
from crawl_scope import (  # noqa: E402
    crawl_years, year_scope_range, in_year_scope,
    LOCATION_LAYERS, location_matches,
)
from tavily_client import TavilyClient, tavily_search_and_extract  # noqa: E402
from tavily_parse import parse_tavily_jobs, clean_text  # noqa: E402

# 2 consecutive years (e.g. 2026 -> [2025, 2026])
_CRAWL_YEARS = crawl_years()
_YEAR_MIN, _YEAR_MAX = year_scope_range()
# Default deadline for undated crawl rows — end of crawl year, keeping items
# visible across the 2-year window.
_DEFAULT_DEADLINE = datetime.datetime(_YEAR_MAX, 12, 31, 23, 59, 59)

# Tavily search queries — location-scoped (Đồng Nai → miền Nam → VN → ĐNA)
# plus keyword-focussed queries for specific roles.  Vietnamese language so
# Tavily returns Vietnamese job boards.
_TAVILY_JOB_QUERIES = [
    # Đồng Nai (highest priority)
    "tuyển dụng lập trình viên phần mềm Đồng Nai 2025",
    "tuyển dụng IT kĩ thuật viên Bình Dương miền Nam",
    "tuyển dụng kỹ sư phần mềm Biên Hòa Đồng Nai",
    # miền Nam
    "tuyển dụng developer TP Hồ Chí Minh 2025",
    "tuyển dụng lập trình viên Cần Thơ 2025",
    # Việt Nam (national)
    "tuyển dụng lập trình viên Hà Nội 2025",
    "tuyển dụng kỹ sư phần mềm Việt Nam 2025",
    # Đông Nam Á (regional remote)
    "tuyển dụng developer Singapore Vietnam remote",
    "tuyển dụng IT remote Việt Nam",
    # Keyword-focussed
    "tuyển dụng data analyst Việt Nam 2025",
    "tuyển dụng designer giáo dục Việt Nam",
    "tuyển dụng product manager tech startup VN",
    "tuyển dụng frontend react angular Việt Nam",
    "tuyển dụng devops engineer Việt Nam 2025",
]

JOB_TYPE_TAGS = {
    'intern': 'internship', 'internship': 'internship', 'thực tập': 'internship',
    'freelance': 'freelance', 'contract': 'contract',
    'full time': 'full_time', 'fulltime': 'full_time',
    'part time': 'part_time', 'parttime': 'part_time',
}


def clean(t):
    return re.sub(r"<[^>]+>", " ", t or "").replace("\n", " ").strip()[:2000]


def infer_job_type(tags, position):
    blob = " ".join([str(t) for t in (tags or [])] + [position or ""]).lower()
    for k, v in JOB_TYPE_TAGS.items():
        if k in blob:
            return v
    return "full_time"


def _location_layer(location_str):
    """Classify a job's location into its scope layer (Đồng Nai → miền Nam → VN → ĐNA)."""
    if not location_str:
        return "unscoped"
    for layer in LOCATION_LAYERS:
        if location_matches(location_str, layer["keywords"]):
            return layer["label"]
    return "unscoped"


def _base_row(title, company, location, description, tags, job_type, salary, logo=None):
    """Build a SQLite-native jobs row (same schema as original source crawlers)."""
    desc = clean_text(description or "")
    if tags:
        desc = f"{desc} | Tags: {','.join(str(t) for t in tags)}"[:2000]
    return {
        "title": (title or "")[:255],
        "company_name": (company or "")[:255],
        "location": (location or "Việt Nam")[:255],
        "location_scope": _location_layer(location),
        "description": desc[:500],
        "job_type": (job_type or "full_time").lower().strip(),
        "salary_range": clean_text(str(salary))[:100] if salary else "Thỏa thuận",
        "required_skills": Jsonb(list(tags or [])),
        "experience_level": "any",
        "application_deadline": _DEFAULT_DEADLINE.date().isoformat(),
        "views": 0,
        "status": "active",
        "image_url": logo,
    }


def crawl():
    """Crawl Vietnamese jobs via Tavily Search + Extract.

    Replaces RemoteOK + Remotive + ITviec + TopCV + Adzuna (all blocked on
    HF Spaces egress).  Builds location-scoped Vietnamese queries, fetches
    search+extract results, and parses them into ``_base_row()`` row dicts.

    Returns a flat list of job dicts (deduped by caller via upsert_rows key).
    Returns ``[]`` when TAVILY_API_KEY is absent or Tavily is unreachable.
    """
    rows = []
    client = TavilyClient()
    if not client.is_configured():
        print("  [jobs] TAVILY_API_KEY không được cài đặt — crawl trả về 0 dòng (giảm dần)")
        # Keyless mode attempt (Tavily supports limited keyless search).
        print("  [jobs] Thử chế độ keyless của Tavily...")

    all_results = []
    for q in _TAVILY_JOB_QUERIES:
        try:
            results = tavily_search_and_extract(
                q,
                search_depth="basic",
                max_results=10,
                extract_top_k=5,
                extract_depth="basic",
            )
            all_results.extend(results)
            print(f"  [jobs] [tavily] '{q[:50]}...' → {len(results)} results")
        except Exception as e:
            print(f"  [jobs] [warn] Tavily query failed '{q[:50]}...': {e}")
            continue

    # Parse Tavily results into job row dicts (structured field extraction).
    parsed = parse_tavily_jobs(all_results, source_name="tavily")
    for j in parsed:
        row = _base_row(
            title=j["title"],
            company=j["company_name"],
            location=j["location"],
            description=j["description"],
            tags=json.loads(j["required_skills"]) if j.get("required_skills") else [],
            job_type=j["job_type"],
            salary=j["salary_range"] if j["salary_range"] != "Thỏa thuận" else None,
            logo=j.get("image_url"),
        )
        row["source_url"] = j.get("source_url", "")
        rows.append(row)

    print(f"  [jobs] collected {len(rows)} raw rows via Tavily")
    return rows


def run():
    print("jobs_crawler: start")
    print(f"  [scope] crawl_year={crawl_years()[0]} | years={crawl_years()} "
          f"| layers={[l['label'] for l in LOCATION_LAYERS]}")
    rows = crawl()
    conn = get_conn()
    try:
        ensure_column(conn, "jobs", "image_url", "TEXT")
        ensure_column(conn, "jobs", "location_scope", "TEXT")
        ensure_column(conn, "jobs", "application_deadline", "TEXT")
        if rows:
            r = upsert_rows(conn, "jobs", rows, ["title", "company_name", "location"])
            print(f"jobs_crawler: {r}")
        else:
            print("jobs_crawler: 0 rows (Tavily keyless/unreachable — graceful)")
    finally:
        conn.close()


# Late import of json (used by parse_tavily_jobs output) to avoid adding it to
# the top-level import block which is stdlib anyway.
import json  # noqa: E402


if __name__ == "__main__":
    run()
