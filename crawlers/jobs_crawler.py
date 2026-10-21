# -*- coding: utf-8 -*-
"""
Jobs crawler  -> `jobs` table.

Multiple sources, ALL multi-page (crawl many trang, not just 1-2):

  1. RemoteOK  — free public API, one big list (~99 remote jobs).
                 https://remoteok.com/api  (NO key)
  2. Remotive  — free JSON API, offset-paginated (limit=100 per page, walk
                 offset=0,100,200,... until <100 returned).
                 https://api.remotive.com/v1/projects  (NO key)
  3. ITviec    — Vietnam tech jobs, server-side HTML list, paginated ?page=N.
                 https://itviec.com/cong-nghe-thong-tin?page={N}
                 (best-effort regex; blocked/drift -> graceful 0 rows, no crash)

Map:  title         <- position/name
      company_name  <- company/company_name
      location      <- location / category / "Remote"
      description   <- description (tags stripped)
      job_type      <- inferred from tags/title (enum-valid)
      salary_range  <- salary
      required_skills <- tags (jsonb)
      experience_level, views, status, ...
created_by/posted_by_user_id/career_path_id left NULL (crawled rows have no
owner). Idempotent: upsert by (title, company_name, location) — `jobs` has no
unique constraint, so SELECT-then-UPDATE/INSERT (db_utils.upsert_rows) is used
(no schema change).
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import (get_conn, upsert_rows, Jsonb, make_session, fetch_json, fetch_html,
                      crawl_pages, ensure_column, extract_itviec_jobs, extract_topcv_jobs)

REMOTEOK = "https://remoteok.com/api"
REMOTIVE = "https://api.remotive.com/v1/projects"
ITVIEC = "https://itviec.com/cong-nghe-thong-tin"
ITVIEC_PAGES = 12  # walk 12 listing pages (graceful: stops early if empty)
TOPCV = "https://www.topcv.vn/viec-lam-cong-nghe-thong-tin"
TOPCV_PAGES = 12
# Adzuna — free job search API (paginated JSON, uses env credentials). Optional:
# skipped gracefully when ADZUNA_APP_ID / ADZUNA_APP_KEY are not set.
ADZUNA_COUNTRY = os.getenv("ADZUNA_COUNTRY", "vn")
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "")
ADZUNA_Q = "it developer cong nghe thong tin"

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


def _base_row(title, company, location, description, tags, job_type, salary, logo=None):
    desc = clean(description or "")
    if tags:
        desc = f"{desc} | Tags: {','.join(str(t) for t in tags)}"[:2000]
    return {
        "title": (title or "")[:255],
        "company_name": (company or "")[:255],
        "location": (location or "Remote")[:255],
        "description": desc,
        "job_type": job_type,
        "salary_range": salary,
        "required_skills": Jsonb(list(tags or [])),
        "experience_level": "any",
        "application_deadline": None,
        "views": 0,
        "status": "active",
        "image_url": logo,
    }


# ---- Source 1: RemoteOK (one-shot list) ----
def _remoteok_items(data):
    rows = []
    if not data or not isinstance(data, list) or len(data) < 2:
        return rows
    for j in data[1:]:  # element 0 is the {legal,last_updated} metadata object
        title = (j.get("position") or "").strip()
        if not title:
            continue
        tags = j.get("tags") or []
        if not isinstance(tags, list):
            tags = [tags]
        yield _base_row(title, j.get("company"),
                        j.get("location") or "Remote",
                        j.get("description"), tags,
                        infer_job_type(tags, j.get("position")),
                        _parse_remoteok_salary(j), j.get("logo"))


def _parse_remoteok_salary(j):
    mn = j.get("salary_min"); mx = j.get("salary_max")
    if mn and mx:
        return f"{mn}-{mx} USD"
    if mn:
        return f"${mn}+ USD"
    if mx:
        return f"up to ${mx} USD"
    return None


# ---- Source 2: Remotive (offset-paginated JSON) ----
def _remotive_items(data):
    rows = []
    if not data or not isinstance(data, dict):
        return rows
    for p in data.get("projects", []):
        title = (p.get("title") or "").strip()
        if not title:
            continue
        tags = [t for t in (p.get("tags") or []) if isinstance(t, str)]
        # location is usually empty for remote listings; fall back to category
        location = p.get("location") or (p.get("category", {}).get("name") if isinstance(p.get("category"), dict) else "") or "Remote"
        yield _base_row(title, p.get("company_name"), location,
                        p.get("description"), tags,
                        infer_job_type(tags, p.get("title")),
                        p.get("salary"), p.get("company_logo"))


def _remotive_url(page, limit=100):
    return f"{REMOTIVE}?limit={limit}&offset={(page - 1) * limit}"


# ---- Source 3: ITviec (HTML list, paginated) — best-effort ----
def _itviec_items(html):
    rows = []
    if not html:
        return rows
    # ITviec job listing is paginated (?page=N). We walk many pages and let
    # crawl_pages dedup by (title, company, location). Card-aware parsing lives
    # in db_utils.extract_itviec_jobs (shared with internships_crawler).
    for c in extract_itviec_jobs(html):
        yield _base_row(c["title"], c["company"], c["location"],
                        f"Xem chi tiết tại https://itviec.com{c['href']}",
                        [], "full_time", None, None)


# ---- Source 4: Adzuna (free JSON API, offset/page paginated, env-gated) ----
def _adzuna_url(page):
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        return None
    return (f"https://api.adzuna.com/v1/api/jobs/{ADZUNA_COUNTRY}/search/{page}"
            f"?app_id={ADZUNA_APP_ID}&app_key={ADZUNA_APP_KEY}"
            f"&results_per_page=50&what={ADZUNA_Q.replace(' ', '+')}")


def _adzuna_items(data):
    rows = []
    if not data or not isinstance(data, dict):
        return rows
    for j in data.get("results", []):
        title = (j.get("title") or "").strip()
        if not title:
            continue
        company = ""
        c = j.get("company") or {}
        if isinstance(c, dict):
            company = c.get("display_name") or ""
        loc = ""
        locobj = j.get("location") or {}
        if isinstance(locobj, dict):
            loc = locobj.get("display_name") or " - ".join(locobj.get("area") or [])
        cat = (j.get("category") or {}).get("label") or ""
        tags = [t for t in [cat] if t]
        salary = None
        mn = j.get("salary_min"); mx = j.get("salary_max")
        if mn and mx:
            salary = f"{mn}-{mx}"
        yield _base_row(title, company, loc or "Việt Nam",
                        j.get("description"), tags,
                        infer_job_type(tags, title), salary, j.get("logo"))


# ---- Source 5: TopCV (Vietnam tech jobs, HTML list, paginated) ----
def _topcv_items(html):
    rows = []
    if not html:
        return rows
    for c in extract_topcv_jobs(html):
        yield _base_row(c["title"], c["company"], c["location"],
                        f"Xem chi tiết tại {c['href']}", [], "full_time", None, None)


def crawl():
    """Crawl ALL sources, return a flat list of job dicts (deduped by caller via
    upsert_rows key)."""
    s = make_session()
    rows = []

    # 1) RemoteOK (single call, ~99 remote jobs)
    data = fetch_json(s, REMOTEOK)
    if data:
        rows.extend(_remoteok_items(data))
    else:
        print("  [jobs] RemoteOK unreachable")

    # 2) Remotive — truly paginated (offset 0, 100, 200, ...)
    rows.extend(crawl_pages(
        s, _remotive_url, fetch_json, _remotive_items,
        key=("title", "company_name"), max_pages=10,
        stop_when_fewer_than=100, sleep=0.6, label='jobs(remotive)'))

    # 3) ITviec — Vietnam tech jobs, HTML pagination
    rows.extend(crawl_pages(
        s, lambda p: f"{ITVIEC}?page={p}", fetch_html, _itviec_items,
        key=("title", "company_name", "location"), max_pages=ITVIEC_PAGES,
        sleep=1.0, label='jobs(itviec)'))

    # 4) Adzuna — free paginated JSON API (env-gated; skipped if no creds)
    if ADZUNA_APP_ID and ADZUNA_APP_KEY:
        rows.extend(crawl_pages(
            s, _adzuna_url, fetch_json, _adzuna_items,
            key=("title", "company_name"), max_pages=20,
            stop_when_fewer_than=50, sleep=0.5, label='jobs(adzuna)'))
    else:
        print("  [jobs] Adzuna skipped (ADZUNA_APP_ID / ADZUNA_APP_KEY not set)")

    # 5) TopCV — Vietnam tech jobs, HTML pagination (best-effort)
    rows.extend(crawl_pages(
        s, lambda p: f"{TOPCV}?page={p}", fetch_html, _topcv_items,
        key=("title", "company_name", "location"), max_pages=TOPCV_PAGES,
        sleep=1.0, label='jobs(topcv)'))

    print(f"  [jobs] collected {len(rows)} raw rows across "
          f"RemoteOK+Remotive+ITviec+Adzuna+TopCV")
    return rows


def run():
    print("jobs_crawler: start")
    rows = crawl()
    conn = get_conn()
    try:
        ensure_column(conn, "jobs", "image_url", "TEXT")
        if rows:
            r = upsert_rows(conn, "jobs", rows, ["title", "company_name", "location"])
            print(f"jobs_crawler: {r}")
        else:
            print("jobs_crawler: 0 rows")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
