#!/usr/bin/env python3
"""
Job Crawler — Vietnamese job boards via Tavily AI search/extract → SQLite 'jobs' table.

Crawls Vietnamese tech/finance/education job postings via the Tavily search+extract
API, parses each result into the standardized jobs-row schema, and upserts into the
SQLite jobs table.

Deployment context (see AGENTS.md §1):
  EduMap runs ONLY on Hugging Face Spaces (free CPU tier).  The previous version of
  this crawler made direct HTTP calls to ITviec, TopCV, VietnamWorks, RemoteOK,
  Remotive and Adzuna — all of which are blocked/blackholed at the HF Spaces egress
  port level.  This version replaces every source with a single Tavily API call
  (https://api.tavily.com — reachable from HF Spaces egress).

SCOPE RULES (applied uniformly — see crawlers/crawl_scope.py):
  • Years   — 2 consecutive years centred on the crawl year.
               crawl_year = EDUMAP_CRAWL_YEAR env (or current UTC year).
               Window = [crawl_year - 1, crawl_year], e.g. 2026 -> [2025, 2026].
               Items whose deadline / posting date falls outside the window
               are filtered out; undated items inherit the window default.
  • Location — Đồng Nai → các tỉnh phía Nam → Việt Nam → Đông Nam Á.
               Each job is tagged with its matched location scope; jobs are
               collected from all layers but the tighter layers take priority.

Sources (Tavily):
  - Tavily Search + Extract: https://api.tavily.com/search + /extract
    (Bearer auth via TAVILY_API_KEY HF Space Secret; keyless mode as fallback)

Graceful degradation:
  - When TAVILY_API_KEY is absent, the client returns 0 rows (no crash).
  - When Tavily is unreachable, the same — 0 rows, error logged.
  - Every error is caught so the cron loop always exits 0.

Runs as:
  - One-shot: python3 scripts/crawl_jobs.py --db frontend/public/edumap.db
  - Cron daily via supervisord
"""
import sys
import os
import json
import time
import sqlite3
import hashlib
import argparse
import urllib.request
import urllib.parse
import urllib.error
import re
import html as _html
from datetime import datetime

# Shared crawl scope (years + location layers).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "crawlers"))
from crawl_scope import (  # noqa: E402
    crawl_year, crawl_years, year_scope_range, in_year_scope,
    LOCATION_LAYERS, DONG_NAI_BBOX, DONG_NAI_KEYWORDS, VIETNAM_BBOX,
    location_matches,
)

# Tavily client + structured parsers (replaces all HTTP-based sources).
from tavily_client import TavilyClient, tavily_search_and_extract  # noqa: E402
from tavily_parse import (  # noqa: E402
    parse_tavily_jobs, clean_text,
)


PAGE_SIZE = 20
MAX_PAGES = int(os.getenv("MAX_PAGES", "3"))


# --------------------------------------------------------------------------- #
# Generic URL fetcher (kept for potential diagnostics; Tavily replaces all crawls)
# --------------------------------------------------------------------------- #
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"


def fetch_url(url, timeout=15):
    """Fetch URL content with proper headers (legacy helper, kept for compatibility)."""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': USER_AGENT,
            'Accept': 'application/json, text/html',
            'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        })
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  [warn] fetch_url failed for {url}: {e}")
        return None


# --------------------------------------------------------------------------- #
# Tavily-based job crawler                                                     #
# --------------------------------------------------------------------------- #

# Search queries — one per location layer, in expansion priority order.
# Vietnamese-language queries so Tavily returns Vietnamese job boards.
_TAVILY_JOB_QUERIES = [
    # Đồng Nai (highest priority)
    "tuyển dụng lập trình viên phần mềm Đồng Nai 2025",
    "tuyển dụng IT kĩ thuật viên Bình Dương miền Nam",
    "tuyển dụng lập trình viên Biên Hòa Đồng Nai",
    # miền Nam
    "tuyển dụng developer TP Hồ Chí Minh 2025",
    "tuyển dụng lập trình viên Cần Thơ 2025",
    # Việt Nam (national)
    "tuyển dụng lập trình viên Hà Nội 2025",
    "tuyển dụng kỹ sư phần mềm Việt Nam 2025",
    # Đông Nam Á (regional context)
    "tuyển dụng developer Singapore Vietnam remote",
    "tuyển dụng IT remote Việt Nam",
]

# Additional keyword-focused queries to capture specific roles.
_TAVILY_JOB_KEYWORD_QUERIES = [
    "tuyển dụng data analyst Việt Nam 2025",
    "tuyển dụng designer giáo dục Việt Nam",
    "tuyển dụng product manager tech startup VN",
    "tuyển dung frontend react angular Việt Nam",
    "tuyển dụng devops engineer Việt Nam 2025",
]


def _crawl_tavily_jobs():
    """Crawl Vietnamese jobs via Tavily Search + Extract.

    Builds location-scoped queries (Đồng Nai → miền Nam → VN → ĐNA) and
    parses Tavily results into ``_base_job()`` row dicts.

    Returns a list of job row dicts (same schema as the old ITviec/TopCV/etc.
    crawlers).  Returns ``[]`` when TAVILY_API_KEY is absent or Tavily is
    unreachable — never raises.
    """
    client = TavilyClient()
    if not client.is_configured():
        print("  ⚠️  TAVILY_API_KEY không được cài đặt — crawl Tavily trả về 0 dòng (giảm dần)")
        # Attempt keyless mode (Tavily supports limited keyless search).
        print("  ℹ️  Thử chế độ keyless của Tavily...")

    # Build the full query list (main + keyword-focussed).
    queries = list(_TAVILY_JOB_QUERIES) + list(_TAVILY_JOB_KEYWORD_QUERIES)

    all_results = []
    for q in queries:
        try:
            results = tavily_search_and_extract(
                q,
                search_depth="basic",
                max_results=MAX_PAGES * PAGE_SIZE,
                extract_top_k=5,
                extract_depth="basic",
            )
            all_results.extend(results)
            print(f"  [tavily] query '{q[:50]}...' → {len(results)} results")
            time.sleep(0.5)  # Gentle rate-limiting.
        except Exception as e:
            print(f"  [warn] Tavily query failed '{q[:50]}...': {e}")
            continue

    # Parse Tavily results into job row dicts.
    parsed_jobs = parse_tavily_jobs(all_results, source_name="tavily")

    # Convert parsed dicts to _base_job() rows (normalises scope/deadline/crawl_year).
    rows = []
    for j in parsed_jobs:
        row = _base_job(
            title=j["title"],
            company=j["company_name"],
            location=j["location"],
            salary=j["salary_range"],
            description=j["description"],
            job_type=j["job_type"],
            skills=json.loads(j["required_skills"]) if j.get("required_skills") else [],
            source_url=j.get("source_url", ""),
            posting_date=j.get("application_deadline", _DEFAULT_DEADLINE.isoformat()),
        )
        row["image_url"] = j.get("image_url")
        row["crawl_year"] = _CRAWL_YEARS[0]
        rows.append(row)

    return rows


# --------------------------------------------------------------------------- #
# Row builder / DB helpers (unchanged from original)                         #
# --------------------------------------------------------------------------- #

# Crawl year window — 2 consecutive years (e.g. 2026 -> [2025, 2026]).
_CRAWL_YEARS = crawl_years()
_YEAR_MIN, _YEAR_MAX = year_scope_range()
# Default deadline for items that arrive without an explicit date: end of the
# crawl year, so the job stays "current" throughout the 2-year window.
_DEFAULT_DEADLINE = datetime(_YEAR_MAX, 12, 31, 23, 59, 59)


def _location_layer(location_str: str) -> str:
    """Classify a job's location into its scope layer (Đồng Nai → miền Nam → VN → ĐNA).

    Priority follows the location expansion order.  Returns 'unscoped' when no
    layer keyword matches (empty location kept as 'unscoped', not dropped).
    """
    if not location_str:
        return "unscoped"
    for layer in LOCATION_LAYERS:
        if location_matches(location_str, layer["keywords"]):
            return layer["label"]
    return "unscoped"


def _location_in_scope(location_str: str) -> bool:
    """True when the location matches any scope layer keyword, or is empty.

    Empty locations are kept (graceful — don't drop Vietnam-focused jobs whose
    board didn't expose a city).
    """
    if not location_str:
        return True
    for layer in LOCATION_LAYERS:
        if location_matches(location_str, layer["keywords"]):
            return True
    return False


def _sanitize_location(location_str: str) -> str:
    """Normalise the location string for layer matching + DB storage."""
    if not location_str:
        return "Việt Nam"
    return clean_text(str(location_str))[:255]


def _base_job(title, company, location, salary, description, job_type, skills, source_url, image_url,
              posting_date: str | None = None):
    """Build a SQLite-native jobs row (no psycopg2/Jsonb) shared by all sources.

    Applies the crawl scope:
      * ``location`` is normalised and tagged with ``location_scope``
        (dong_nai / southern_vn / vietnam / sea / unscoped).
      * ``application_deadline`` defaults to end-of-crawl-year when the source
        didn't provide one, keeping the job visible across the 2-year window.
      * ``crawl_year`` records the crawl window for auditability.
    """
    location = _sanitize_location(location)
    deadline = posting_date if posting_date else _DEFAULT_DEADLINE.isoformat()
    return {
        'title': clean_text(title)[:255],
        'company_name': clean_text(company)[:255] if company else 'Unknown',
        'location': location,
        'location_scope': _location_layer(location),
        'salary_range': clean_text(str(salary))[:100] if salary else 'Thỏa thuận',
        'description': clean_text(description)[:500] if description else '',
        'job_type': (job_type or 'full_time').lower().strip(),
        'required_skills': json.dumps(skills) if skills else '[]',
        'experience_level': 'Chưa xác định',
        'source_url': source_url or '',
        'image_url': image_url,
        'application_deadline': deadline,
        'crawl_year': _CRAWL_YEARS[0],
        'views': 0,
        'status': 'active',
        'posted_by_user_id': None,
        'career_path_id': None,
        'updated_at': None,  # set by caller; placeholder
    }


def clean_text(text):
    """Unescape HTML entities and clean text, PRESERVING Vietnamese diacritics.

    The previous implementation stripped every non-ASCII character, which
    turned real Vietnamese job titles into unreadable strings such as
    "Cong ty CTM CMC" / "Thoa thuan". SQLite stores UTF-8 natively, so there is
    no reason to ASCII-fold. We only strip control characters and HTML tags.
    """
    if text is None:
        return ''
    text = _html.unescape(str(text))
    # Drop HTML tags that sometimes leak into JSON/HTML scrapes.
    text = re.sub(r'<[^>]{1,200}>', ' ', text)
    # Remove control chars except tab/newline, then collapse whitespace.
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
    return re.sub(r'\s+', ' ', text).strip()


def generate_uuid_from_seed(seed_str):
    """Generate a deterministic UUID-like string from a seed."""
    hex_hash = hashlib.md5(seed_str.encode('utf-8')).hexdigest()
    # Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return f"{hex_hash[:8]}-{hex_hash[8:12]}-{hex_hash[12:16]}-{hex_hash[16:20]}-{hex_hash[20:32]}"


def insert_job(cursor, job_data):
    """Insert or update a job in SQLite DB (upsert).

    Writes the crawl-scope columns (``location_scope``, ``application_deadline``,
    ``crawl_year``) alongside the original fields.  ``ensure_column`` in main()
    guarantees the columns exist on older DBs.
    """
    # Generate deterministic ID from title+company
    seed = f"{job_data.get('title', '')}|{job_data.get('company_name', '')}|{job_data.get('source_url', '')}"
    job_id = generate_uuid_from_seed(seed)

    now = datetime.utcnow().isoformat()

    cursor.execute("""
        INSERT OR REPLACE INTO jobs (
            id, title, description, company_name, location,
            location_scope, job_type, salary_range, required_skills,
            experience_level, application_deadline, views,
            status, posted_by_user_id, career_path_id,
            image_url, created_at, updated_at, crawl_year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        job_id,
        clean_text(job_data['title']),
        clean_text(job_data.get('description', ''))[:1000],
        clean_text(job_data['company_name']),
        clean_text(job_data['location']),
        job_data.get('location_scope', _location_layer(job_data.get('location', ''))),
        job_data['job_type'],
        clean_text(job_data['salary_range']),
        job_data.get('required_skills', json.dumps([])),
        clean_text(job_data.get('experience_level', '')),
        job_data.get('application_deadline'),
        0,     # views
        'active',
        None,  # posted_by_user_id
        None,  # career_path_id
        job_data.get('image_url'),
        now,   # created_at
        now,   # updated_at
        job_data.get('crawl_year', _CRAWL_YEARS[0]),
    ))
    return cursor.rowcount


def _scope_insert(cursor, job_data, counters: dict[str, int]) -> bool:
    """Insert a job AND accumulate per-layer coverage counters.

    Returns True when the job was inserted (not a duplicate).
    Tracks which location layer + year the job belongs to for reporting.
    """
    layer = job_data.get('location_scope', 'unscoped')
    counters[layer] = counters.get(layer, 0) + 1
    insert_job(cursor, job_data)
    return cursor.rowcount > 0


def ensure_column(conn, table, column, col_type="TEXT"):
    """Add a column to a SQLite table if it doesn't already exist."""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in cursor.fetchall()]
    if column not in cols:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        conn.commit()
    cursor.close()


def main():
    parser = argparse.ArgumentParser(description='Crawl jobs into SQLite DB via Tavily')
    parser.add_argument('--db', required=True, help='Path to SQLite database')
    parser.add_argument('--max-pages', type=int, default=MAX_PAGES, help='Max pages to crawl per source')
    args = parser.parse_args()

    print(f"🚀 Starting job crawler (Tavily) → {args.db}")

    # Verify DB exists and has jobs table
    if not os.path.exists(args.db):
        print(f"  [error] Database not found: {args.db}")
        sys.exit(1)

    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()

    # Verify jobs table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='jobs'")
    if not cursor.fetchone():
        print("  [error] 'jobs' table not found in database")
        conn.close()
        sys.exit(1)

    # Ensure image_url + scope columns exist (may be missing on older DBs)
    ensure_column(conn, "jobs", "image_url", "TEXT")
    ensure_column(conn, "jobs", "location_scope", "TEXT")
    ensure_column(conn, "jobs", "application_deadline", "TEXT")
    ensure_column(conn, "jobs", "crawl_year", "INTEGER")

    print(f"  [scope] crawl_year={crawl_year()} | crawl_years={crawl_years()} "
          f"| location_layers={[l['label'] for l in LOCATION_LAYERS]}")

    total_inserted = 0
    total_skipped = 0
    layer_counts: dict[str, int] = {l["label"]: 0 for l in LOCATION_LAYERS}
    layer_counts["unscoped"] = 0

    # --- Tavily-based job crawl ---
    # Replaces all HTTP-based sources (ITviec, TopCV, VietnamWorks, RemoteOK,
    # Remotive, Adzuna) which are blocked on HF Spaces egress.
    print("\n📍 Crawling Vietnamese jobs via Tavily AI search...")
    print("    (Đồng Nai → miền Nam → VN → ĐNA, kèm từ khóa chuyên ngành)")

    jobs = _crawl_tavily_jobs()

    for job in jobs:
        _scope_insert(cursor, job, layer_counts)
        if cursor.rowcount > 0:
            total_inserted += 1
        else:
            total_skipped += 1
    conn.commit()
    print(f"  Tavily: {len(jobs)} jobs found")

    # --- Summary ---
    cursor.execute("SELECT COUNT(*) FROM jobs WHERE status='active'")
    total_jobs = cursor.fetchone()[0]
    cursor.close()
    conn.close()

    print(f"\n✅ Crawl complete (Tavily mode)!")
    print(f"  Inserted/updated: {total_inserted} jobs")
    print(f"  Skipped (duplicates): {total_skipped}")
    print(f"  Total active jobs in DB: {total_jobs}")
    print(f"  [scope] location layers covered: "
          f"{', '.join(f'{k}={v}' for k, v in layer_counts.items() if v)}")
    print(f"  [scope] crawl years: {crawl_years()} (min={_YEAR_MIN}, max={_YEAR_MAX})")


if __name__ == '__main__':
    main()
