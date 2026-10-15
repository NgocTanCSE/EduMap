# -*- coding: utf-8 -*-
"""
Internships crawler -> `internships` table (title UNIQUE).

Source: RemoteOK public API ?category=internship (https://remoteok.com/api?category=internship)
— free, NO key. Returns ~99 internship postings.

Map: title <- position, field/tags, description, salary_range, deadline(date),
requirements, benefits, status='open'. company_id / location_point left NULL
(organizations is empty; no geocoding from API). Idempotent upsert by title.
"""
import os, re, sys, datetime
sys.path.insert(0, os.path.dirname(__file__))
from db_utils import get_conn, upsert_rows, Jsonb, make_session, fetch_json

REMOTEOK_INTERN = "https://remoteok.com/api?category=internship"

def clean(t):
    return re.sub(r"<[^>]+>", " ", t or "").replace("\n", " ").strip()[:2000]

def parse_date(d):
    if not d:
        return None
    try:
        return datetime.datetime.fromisoformat(d.replace("Z", "+00:00"))
    except Exception:
        return None

def crawl():
    s = make_session()
    data = fetch_json(s, REMOTEOK_INTERN)
    if not data or not isinstance(data, list) or len(data) < 2:
        print("  [internships] RemoteOK internship unreachable/empty")
        return []
    rows = []
    for j in data[1:]:
        title = (j.get("position") or "").strip()
        if not title:
            continue
        tags = j.get("tags") or []
        if not isinstance(tags, list):
            tags = [tags]
        field = tags[0] if tags else "internship"
        rows.append({
            "title": title[:255],
            "company_id": None,
            "description": clean(j.get("description") or "")[:2000],
            "field": (str(field)[:100] if field else "internship"),
            "location_point": None,
            "salary_range": f"${j.get('salary_min','')}-{j.get('salary_max','')} USD" if j.get("salary_min") else None,
            "duration": "Flexible",
            "requirements": "Remote-friendly remote internship. See description.",
            "benefits": "Remote work, flexible schedule, skill development.",
            "deadline": parse_date(j.get("date")),
            "application_count": 0,
            "status": "open",
        })
    return rows

def run():
    print("internships_crawler: start")
    conn = get_conn()
    try:
        rows = crawl()
        if rows:
            r = upsert_rows(conn, "internships", rows, ["title"])
            print(f"internships_crawler: {r}")
        else:
            print("internships_crawler: 0 rows")
    finally:
        conn.close()

if __name__ == "__main__":
    run()
