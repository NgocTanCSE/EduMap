#!/usr/bin/env python3
"""
Job Crawler — ITviec.com (no API key) → SQLite 'jobs' table.
Crawls ITviec and other Vietnamese job boards, dedupes by title+company,
and inserts into the SQLite jobs table with proper schema mapping.

Sources:
  - ITviec API: https://itviec.com/api/v1/jobs (public, no auth)
  - Fallback: VietnamWorks HTML parsing via search
  - Fallback: TopCV.vn HTML parsing

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

USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
ITVIEC_API = 'https://itviec.com/api/v1/jobs'
MAX_PAGES = 5  # ~500 jobs max per run
PAGE_SIZE = 100

# ITviec job type mapping
ITVIEC_JOB_TYPE_MAP = {
    'full_time': 'full_time',
    'part_time': 'part_time',
    'internship': 'internship',
    'contract': 'contract',
    'freelance': 'freelance',
}

# Common IT/tech keywords to detect from job descriptions
TECH_SKILLS = [
    'python', 'react', 'vue', 'angular', 'node.js', 'nodejs', 'java', 'go', 'rust',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'sql', 'postgresql', 'mongodb',
    'redis', 'graphql', 'typescript', 'javascript', 'php', 'laravel', 'django',
    'flutter', 'android', 'ios', 'swift', 'kotlin', 'figma', 'photoshop', 'seo',
    'agile', 'scrum', 'git', 'devops', 'tensorflow', 'pytorch', 'c++', 'c#',
    'nestjs', 'nextjs', 'express', 'spring', 'django', 'flask',
]


def fetch_url(url, timeout=15):
    """Fetch URL content with proper headers."""
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


def crawl_itviec_api(page):
    """Crawl ITviec jobs via their internal API (may need auth — fallback to HTML)."""
    # Try API first
    url = f"{ITVIEC_API}?page={page}&per_page={PAGE_SIZE}"
    raw = fetch_url(url, timeout=15)
    if raw:
        try:
            data = json.loads(raw)
            jobs = data.get('jobs', [])
            total = data.get('meta', {}).get('total', 0) or data.get('total_pages', 0) * PAGE_SIZE
            results = []
            for job in jobs:
                title = job.get('title', '') or job.get('name', '')
                company = (job.get('company', {}) or {}).get('name', '') if isinstance(job.get('company'), dict) else str(job.get('company', ''))
                location = ''
                if isinstance(job.get('location'), dict):
                    location = job['location'].get('city', {}).get('locale', '')
                salary = job.get('salary', '')
                if isinstance(salary, dict):
                    salary = f"{salary.get('min_price', '')} - {salary.get('max_price', '')}"
                tags = job.get('tags', [])
                if isinstance(tags, list):
                    skills = [t.get('name', '') for t in tags if isinstance(t, dict) and 'name' in t]
                else:
                    skills = []
                description = job.get('description', '')
                job_type_raw = job.get('job_type', '') or job.get('contract_type', '')
                job_type = ITVIEC_JOB_TYPE_MAP.get(job_type_raw.lower(), 'full_time')
                results.append({
                    'title': title.strip() if title else 'Unknown',
                    'company_name': company.strip()[:255] if company else 'Unknown',
                    'location': location.strip()[:255] if location else 'Vietnam',
                    'salary_range': str(salary).strip()[:100] if salary else 'Thoa thuan',
                    'description': description[:500] if description else '',
                    'job_type': job_type,
                    'required_skills': json.dumps(skills) if skills else '',
                    'experience_level': ', '.join(skills[:5]) if skills else 'Chua xac dinh',
                    'source_url': job.get('url', ''),
                })
            if results:
                return results, total
        except json.JSONDecodeError:
            pass

    # Fallback: scrape ITviec HTML
    html_url = f'https://itviec.com/jobs?page={page}'
    raw_html = fetch_url(html_url, timeout=15)
    if not raw_html:
        return [], 0
    return crawl_itviec_html(raw_html, page)


def crawl_itviec_html(raw_html, page):
    """Parse ITviec HTML job listings."""
    results = []
    # ITviec HTML pattern: <a href="/jobs/..." title="Job Title">...</a>
    # Company: <a href="/companies/..." ...>Company Name</a>
    job_links = re.findall(r'href="(/jobs/[^"]+)"[^>]*title="([^"]+)"', raw_html)
    for href, title in job_links[:30]:
        results.append({
            'title': title.strip(),
            'company_name': 'ITviec Employer',
            'location': 'Ho Chi Minh City / Hanoi',
            'salary_range': 'Thoa thuan',
            'description': '',
            'job_type': 'full_time',
            'required_skills': json.dumps([]),
            'experience_level': '',
            'source_url': f'https://itviec.com{href}',
        })
    total = len(job_links)
    return results, total


def crawl_topcv_html():
    """Fallback: scrape TopCV.vn (HTML parsing)."""
    url = 'https://www.topcv.vn/jobs'
    raw = fetch_url(url, timeout=15)
    if not raw:
        return []

    results = []
    # Use regex to extract job cards (lightweight, no bs4 dependency)
    job_pattern = re.findall(
        r'<a[^>]*>([^<]+)</a>.*?<p[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)</p>',
        raw, re.DOTALL
    )
    for title, company in job_pattern[:50]:
        if len(title.strip()) < 5:
            continue
        results.append({
            'title': title.strip(),
            'company_name': company.strip()[:255],
            'location': 'Vietnam',
            'salary_range': 'Thoa thuan',
            'description': '',
            'job_type': 'full_time',
            'required_skills': json.dumps([]),
            'experience_level': '',
            'source_url': url,
        })
    return results


def crawl_vietnamworks_html():
    """Fallback: scrape VietnamWorks (HTML parsing)."""
    url = 'https://www.vietnamworks.com/search/job?page=1'
    raw = fetch_url(url, timeout=15)
    if not raw:
        return []

    results = []
    job_pattern = re.findall(r'"job-title":"(.*?)"', raw)
    company_pattern = re.findall(r'"company-name":"(.*?)"', raw)

    for i, title in enumerate(job_pattern[:30]):
        company = company_pattern[i] if i < len(company_pattern) else 'Unknown'
        results.append({
            'title': title[:255],
            'company_name': company[:255],
            'location': 'Vietnam',
            'salary_range': 'Thoa thuan',
            'description': '',
            'job_type': 'full_time',
            'required_skills': json.dumps([]),
            'experience_level': '',
            'source_url': url,
        })
    return results


def clean_text(text):
    """Unescape HTML entities and clean text."""
    if not text:
        return ''
    text = _html.unescape(text)
    return re.sub(r'[^\x00-\x7f]', '', text)  # Remove non-ASCII for SQLite


def generate_uuid_from_seed(seed_str):
    """Generate a deterministic UUID-like string from a seed."""
    hex_hash = hashlib.md5(seed_str.encode('utf-8')).hexdigest()
    # Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return f"{hex_hash[:8]}-{hex_hash[8:12]}-{hex_hash[12:16]}-{hex_hash[16:20]}-{hex_hash[20:32]}"


def insert_job(cursor, job_data):
    """Insert or update a job in SQLite DB (upsert)."""
    # Generate deterministic ID from title+company
    seed = f"{job_data.get('title', '')}|{job_data.get('company_name', '')}|{job_data.get('source_url', '')}"
    job_id = generate_uuid_from_seed(seed)

    now = datetime.utcnow().isoformat()

    cursor.execute("""
        INSERT OR REPLACE INTO jobs (
            id, title, description, company_name, location,
            job_type, salary_range, required_skills,
            experience_level, application_deadline, views,
            status, posted_by_user_id, career_path_id,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        job_id,
        clean_text(job_data['title']),
        clean_text(job_data.get('description', ''))[:1000],
        clean_text(job_data['company_name']),
        clean_text(job_data['location']),
        job_data['job_type'],
        clean_text(job_data['salary_range']),
        job_data.get('required_skills', json.dumps([])),
        clean_text(job_data.get('experience_level', '')),
        None,  # application_deadline
        0,     # views
        'active',
        None,  # posted_by_user_id
        None,  # career_path_id
        now,
        now,
    ))
    return cursor.rowcount


def main():
    parser = argparse.ArgumentParser(description='Crawl jobs into SQLite DB')
    parser.add_argument('--db', required=True, help='Path to SQLite database')
    parser.add_argument('--max-pages', type=int, default=MAX_PAGES, help='Max pages to crawl per source')
    args = parser.parse_args()

    print(f"🚀 Starting job crawler → {args.db}")

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
        sys.exit(1)

    total_inserted = 0
    total_skipped = 0

    # --- Source 1: ITviec API ---
    print("\n📍 Crawling ITviec API...")
    for page in range(1, args.max_pages + 1):
        try:
            jobs, total = crawl_itviec_api(page)
            if not jobs:
                print(f"  Page {page}: no jobs returned (end or API limit)")
                break

            for job in jobs:
                before = cursor.rowcount
                insert_job(cursor, job)
                if cursor.rowcount > 0:
                    total_inserted += 1
                else:
                    total_skipped += 1

            conn.commit()
            print(f"  Page {page}: {len(jobs)} jobs found, {total} total available")
            time.sleep(1)  # Rate limiting
        except Exception as e:
            print(f"  [error] ITviec page {page}: {e}")
            continue

    # --- Source 2: TopCV (HTML fallback) ---
    print("\n📍 Crawling TopCV HTML...")
    try:
        jobs = crawl_topcv_html()
        for job in jobs:
            insert_job(cursor, job)
            if cursor.rowcount > 0:
                total_inserted += 1
            else:
                total_skipped += 1
        conn.commit()
        print(f"  TopCV: {len(jobs)} jobs found")
    except Exception as e:
        print(f"  [error] TopCV: {e}")

    # --- Source 3: VietnamWorks (HTML fallback) ---
    print("\n📍 Crawling VietnamWorks HTML...")
    try:
        jobs = crawl_vietnamworks_html()
        for job in jobs:
            insert_job(cursor, job)
            if cursor.rowcount > 0:
                total_inserted += 1
            else:
                total_skipped += 1
        conn.commit()
        print(f"  VietnamWorks: {len(jobs)} jobs found")
    except Exception as e:
        print(f"  [error] VietnamWorks: {e}")

    # --- Summary ---
    cursor.execute("SELECT COUNT(*) FROM jobs WHERE status='active'")
    total_jobs = cursor.fetchone()[0]
    cursor.close()
    conn.close()

    print(f"\n✅ Crawl complete!")
    print(f"  Inserted/updated: {total_inserted} jobs")
    print(f"  Skipped (duplicates): {total_skipped}")
    print(f"  Total active jobs in DB: {total_jobs}")


if __name__ == '__main__':
    main()
