# -*- coding: utf-8 -*-
"""
Internships crawler -> `internships` table (title UNIQUE).

Multiple sources, ALL walking many pages (crawl nhiều trang, không chỉ 1-2):

  1. RemoteOK  — free API ?category=internship (one-shot list).
                 https://remoteok.com/api?category=internship  (NO key)
  2. Remotive  — free JSON API, offset-paginated (limit=100/page); we keep only
                 projects whose title/tags look like an internship.
                 https://api.remotive.com/v1/projects  (NO key)
  3. ITviec    — Vietnam jobs HTML list, paginated ?page=N; keep cards whose
                 title contains 'intern' / 'thực tập'. (best-effort regex)

Map: title <- position/name, field/tags, description, salary_range, deadline,
requirements, benefits, status='open'. company_id / location_point left NULL
(organizations not in these sources; no geocoding). Idempotent upsert by title.
"""
import os, re, sys, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import (get_conn, upsert_rows, Jsonb, make_session, fetch_json, fetch_html,
                      crawl_pages, ensure_column, extract_itviec_jobs, extract_topcv_jobs)
from crawl_scope import (
    crawl_years, year_scope_range, in_year_scope,
    LOCATION_LAYERS, location_matches,
)

# 2 consecutive years (e.g. 2026 -> [2025, 2026])
_CRAWL_YEARS = crawl_years()
_YEAR_MIN, _YEAR_MAX = year_scope_range()
_DEFAULT_DEADLINE = datetime.datetime(_YEAR_MAX, 12, 31, 23, 59, 59)

REMOTEOK_INTERN = "https://remoteok.com/api?category=internship"
REMOTIVE = "https://api.remotive.com/v1/projects"
ITVIEC = "https://itviec.com/cong-nghe-thong-tin"
ITVIEC_PAGES = 12
TOPCV = "https://www.topcv.vn/viec-lam-thuc-tap-cong-nghe-thong-tin"
TOPCV_PAGES = 12
# Adzuna — free JSON API (env-gated). Reuses the same Adzuna credentials as the
# jobs crawler; filters results to internship/thực tập postings.
ADZUNA_COUNTRY = os.getenv("ADZUNA_COUNTRY", "vn")
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "")
ADZUNA_INTERN_Q = "intern thực tập"

INTERN_HINTS = ("intern", "internship", "thực tập", "thuc tap", "trainee", "internship")


def clean(t):
    return re.sub(r"<[^>]+>", " ", t or "").replace("\n", " ").strip()[:2000]


def parse_date(d):
    if not d:
        return None
    try:
        return datetime.datetime.fromisoformat(d.replace("Z", "+00:00"))
    except Exception:
        return None


def _is_intern(title, tags):
    blob = " ".join([str(title or ""), *(str(t) for t in (tags or []))]).lower()
    return any(h in blob for h in INTERN_HINTS)


def _location_layer(location_str):
    """Classify a posting's location into its scope layer (Đồng Nai → miền Nam → VN → ĐNA)."""
    if not location_str:
        return "unscoped"
    for layer in LOCATION_LAYERS:
        if location_matches(location_str, layer["keywords"]):
            return layer["label"]
    return "unscoped"


def _intern_row(title, company, description, field, tags, salary, logo=None, deadline=None):
    desc = clean(description or "")
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


# ---- Source 1: RemoteOK internships (one-shot) ----
def _remoteok_items(data):
    rows = []
    if not data or not isinstance(data, list) or len(data) < 2:
        return rows
    for j in data[1:]:
        title = (j.get("position") or "").strip()
        if not title:
            continue
        tags = j.get("tags") or []
        if not isinstance(tags, list):
            tags = [tags]
        if not _is_intern(title, tags):
            continue
        yield _intern_row(title, j.get("company"), j.get("description"),
                         (tags[0] if tags else "internship"), tags,
                         _parse_remoteok_salary(j), j.get("logo"), parse_date(j.get("date")))


def _parse_remoteok_salary(j):
    mn = j.get("salary_min"); mx = j.get("salary_max")
    if mn and mx:
        return f"{mn}-{mx} USD"
    if mn:
        return f"${mn}+ USD"
    if mx:
        return f"up to ${mx} USD"
    return None


# ---- Source 2: Remotive (offset-paginated) -> filter internships ----
def _remotive_items(data):
    rows = []
    if not data or not isinstance(data, dict):
        return rows
    for p in data.get("projects", []):
        title = (p.get("title") or "").strip()
        if not title:
            continue
        tags = [t for t in (p.get("tags") or []) if isinstance(t, str)]
        if not _is_intern(title, tags):
            continue
        location = p.get("location") or (p.get("category", {}).get("name") if isinstance(p.get("category"), dict) else "") or "Remote"
        yield _intern_row(title, p.get("company_name"), p.get("description"),
                          (tags[0] if tags else "internship"), tags,
                          p.get("salary"), p.get("company_logo"))


def _remotive_url(page, limit=100):
    return f"{REMOTIVE}?limit={limit}&offset={(page - 1) * limit}"


# ---- Source 3: ITviec (HTML, paginated) -> filter intern/thực tập ----
def _itviec_items(html):
    rows = []
    if not html:
        return rows
    for c in extract_itviec_jobs(html):
        if not _is_intern(c["title"], []):
            continue
        yield _intern_row(c["title"], c["company"],
                          f"Xem chi tiết tại https://itviec.com{c['href']}",
                          "internship", [], None, None)


# ---- Source 4: Adzuna (JSON API, page-paginated, env-gated) -> filter intern ----
def _adzuna_url(page):
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        return None
    return (f"https://api.adzuna.com/v1/api/jobs/{ADZUNA_COUNTRY}/search/{page}"
            f"?app_id={ADZUNA_APP_ID}&app_key={ADZUNA_APP_KEY}"
            f"&results_per_page=50&what={ADZUNA_INTERN_Q.replace(' ', '+')}")


def _adzuna_items(data):
    rows = []
    if not data or not isinstance(data, dict):
        return rows
    for j in data.get("results", []):
        title = (j.get("title") or "").strip()
        if not title or not _is_intern(title, []):
            continue
        company = (j.get("company") or {}).get("display_name") or ""
        locobj = j.get("location") or {}
        loc = locobj.get("display_name") or " - ".join(locobj.get("area") or []) or "Việt Nam"
        cat = (j.get("category") or {}).get("label") or ""
        tags = [t for t in [cat] if t]
        yield _intern_row(title, company, j.get("description"),
                          (tags[0] if tags else "internship"), tags,
                          _adzuna_salary(j), j.get("logo"))


def _adzuna_salary(j):
    mn = j.get("salary_min"); mx = j.get("salary_max")
    if mn and mx:
        return f"{mn}-{mx}"
    if mn:
        return f"${mn}+"
    if mx:
        return f"up to ${mx}"
    return None


# ---- Source 5: TopCV (HTML, paginated) -> filter intern/thực tập ----
def _topcv_items(html):
    rows = []
    if not html:
        return rows
    for c in extract_topcv_jobs(html):
        if not _is_intern(c["title"], []):
            continue
        yield _intern_row(c["title"], c["company"],
                          f"Xem chi tiết tại {c['href']}",
                          "internship", [], None, None)


def crawl():
    s = make_session()
    rows = []

    # 1) RemoteOK internships (single call)
    data = fetch_json(s, REMOTEOK_INTERN)
    if data:
        rows.extend(_remoteok_items(data))
    else:
        print("  [internships] RemoteOK intern unreachable")

    # 2) Remotive — paginated offset, filtered to internships
    rows.extend(crawl_pages(
        s, _remotive_url, fetch_json, _remotive_items,
        key=("title",), max_pages=8, max_total=80,
        stop_when_fewer_than=100, sleep=0.6, label='internships(remotive)'))

    # 3) ITviec — paginated HTML, filter to intern titles
    rows.extend(crawl_pages(
        s, lambda p: f"{ITVIEC}?page={p}", fetch_html, _itviec_items,
        key=("title",), max_pages=ITVIEC_PAGES,
        sleep=1.0, label='internships(itviec)'))

    # 4) Adzuna — env-gated paginated JSON, filter to internships
    if ADZUNA_APP_ID and ADZUNA_APP_KEY:
        rows.extend(crawl_pages(
            s, _adzuna_url, fetch_json, _adzuna_items,
            key=("title",), max_pages=15, max_total=80,
            stop_when_fewer_than=50, sleep=0.5, label='internships(adzuna)'))
    else:
        print("  [internships] Adzuna skipped (ADZUNA_APP_ID / ADZUNA_APP_KEY not set)")

    # 5) TopCV — paginated HTML, filter to intern/thực tập titles (best-effort)
    rows.extend(crawl_pages(
        s, lambda p: f"{TOPCV}?page={p}", fetch_html, _topcv_items,
        key=("title",), max_pages=TOPCV_PAGES,
        sleep=1.0, label='internships(topcv)'))

    print(f"  [internships] collected {len(rows)} raw rows across "
          f"RemoteOK+Remotive+ITviec+Adzuna+TopCV (years in-scope: {crawl_years()})")
    return rows


def run():
    print("internships_crawler: start")
    print(f"  [scope] crawl_years={crawl_years()} "
          f"| layers={[l['label'] for l in LOCATION_LAYERS]}")
    conn = get_conn()
    try:
        ensure_column(conn, "internships", "image_url", "TEXT")
        ensure_column(conn, "internships", "location_scope", "TEXT")
        rows = crawl()
        if rows:
            r = upsert_rows(conn, "internships", rows, ["title", "company_name"])
            print(f"internships_crawler: {r}")
        else:
            print("internships_crawler: 0 rows")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
