# -*- coding: utf-8 -*-
"""
Jobs crawler  -> `jobs` table.

Source: RemoteOK public API (https://remoteok.com/api) — free, NO key required.
Returns ~99 real (remote) job postings. The list is capped by the API, so this
is combined with the internship crawl to cover the career pipeline.

Map:  title  <- position
      company_name <- company
      location  <- location (or 'Remote')
      description <- description + tags
      job_type  <- inferred from tags/position (enum-valid)
      salary_range, required_skills(tags jsonb), experience_level, ...
created_by/posted_by_user_id/career_path_id left NULL (no FK owner on crawled
rows). Idempotent: upsert by (title, company_name, location) — jobs has no
unique constraint, so SELECT-then-UPDATE/INSERT is used (no schema change).
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, make_session, fetch_json

REMOTEOK = "https://remoteok.com/api"

def clean(t):
    return re.sub(r"<[^>]+>", " ", t or "").replace("\n", " ").strip()[:2000]

JOB_TYPE_TAGS = {
    'intern': 'internship', 'internship': 'internship',
    'freelance': 'freelance', 'contract': 'contract',
    'full time': 'full_time', 'part time': 'part_time',
}

def infer_job_type(tags, position):
    blob = " ".join([str(t) for t in (tags or [])] + [position or ""]).lower()
    for k, v in JOB_TYPE_TAGS.items():
        if k in blob:
            return v
    return "full_time"

def parse_salary(j):
    mn = j.get("salary_min"); mx = j.get("salary_max")
    if mn and mx:
        return f"{mn}-{mx} USD"
    if mn:
        return f"${mn}+ USD"
    if mx:
        return f"up to ${mx} USD"
    return None

def crawl():
    s = make_session()
    data = fetch_json(s, REMOTEOK)
    if not data or not isinstance(data, list) or len(data) < 2:
        print("  [jobs] RemoteOK unreachable or empty")
        return []
    rows = []
    for j in data[1:]:  # element 0 is the {legal,last_updated} metadata object
        title = (j.get("position") or "").strip()
        if not title:
            continue
        tags = j.get("tags") or []
        if not isinstance(tags, list):
            tags = [tags]
        desc = clean(j.get("description") or "")
        if tags:
            desc = (desc + " | Tags: " + ",".join(str(t) for t in tags))[:2000]
        rows.append({
            "title": title[:255],
            "company_name": (j.get("company") or "")[:255],
            "location": (j.get("location") or "Remote")[:255] or "Remote",
            "description": desc,
            "job_type": infer_job_type(tags, j.get("position")),
            "salary_range": parse_salary(j),
            "required_skills": Jsonb(list(tags)),
            "experience_level": "any",
            "application_deadline": None,
            "views": 0,
            "status": "active",
        })
    return rows

def run():
    print("jobs_crawler: start")
    rows = crawl()
    conn = get_conn()
    try:
        if rows:
            r = upsert_rows(conn, "jobs", rows, ["title", "company_name", "location"])
            print(f"jobs_crawler: {r}")
        else:
            print("jobs_crawler: 0 rows")
    finally:
        conn.close()

if __name__ == "__main__":
    run()
