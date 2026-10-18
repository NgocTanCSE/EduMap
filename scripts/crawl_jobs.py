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


def ensure_column(conn, table, column, col_type="TEXT"):
    """Add a column to a SQLite table if it doesn't already exist (idempotent)."""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cursor.fetchall()}
    if column not in existing:
        cursor.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {col_type}')
        conn.commit()
        print(f"  [ensure_column] added '{column}' to {table}")
    cursor.close()


def extract_card_image(card_html, source_domain=None):
    """Extract the FIRST relevant <img> src from a single card's HTML block.

    Card-aware: searches <img> tags *within* the card block, not across
    the whole page.  Filters tracking pixels (1x1, .gif, pixel/track/spacer).
    """
    if not card_html:
        return None
    img_tags = re.findall(r'<img\s+[^>]*>', card_html, re.IGNORECASE | re.DOTALL)
    if not img_tags:
        return None
    content_imgs = []
    for tag in img_tags:
        src_match = re.search(r'src="([^"]+)"', tag, re.IGNORECASE)
        if not src_match:
            continue
        src = src_match.group(1)
        # Skip data: URIs
        if src.startswith("data:"):
            continue
        low = src.lower()
        if any(x in low for x in ("pixel", "track", "spacer", "loading", "1x1", ".gif")):
            continue
        w_match = re.search(r'width\s*=\s*["\']?1["\']?', tag, re.IGNORECASE)
        h_match = re.search(r'height\s*=\s*["\']?1["\']?', tag, re.IGNORECASE)
        if w_match or h_match:
            continue
        content_imgs.append(src)
    if source_domain:
        domain_imgs = [i for i in content_imgs if source_domain in i.lower()]
        if domain_imgs:
            return domain_imgs[0]
    return content_imgs[0] if content_imgs else None

USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
ITVIEC_API = 'https://itviec.com/api/v1/jobs'
MAX_PAGES = 5  # ~500 jobs max per run
PAGE_SIZE = 100


def _extract_logo(job):
    """Extract company/logo URL from an ITviec API job object.

    ITviec API may return logo under various keys depending on version.
    Checks common patterns: logo, company.logo, image, thumbnail, etc.
    """
    if not job:
        return None
    # Direct logo field
    for key in ('logo', 'image_url', 'image', 'thumbnail', 'logo_url', 'photo'):
        val = job.get(key)
        if val and isinstance(val, str) and val.startswith(('http://', 'https://')):
            return val
    # Nested under company dict
    comp = job.get('company')
    if isinstance(comp, dict):
        for key in ('logo', 'image', 'image_url', 'logo_url', 'photo', 'avatar'):
            val = comp.get(key)
            if val and isinstance(val, str) and val.startswith(('http://', 'https://')):
                return val
    return None

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
                    'image_url': _extract_logo(job),  # company logo from API
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
    """Parse ITviec HTML job listings (fallback when API requires auth).

    ITviec uses /it-jobs/<id>-<slug> for job detail pages. Each card's
    HTML block is isolated so the company logo img is matched 1-to-1
    with the correct job (not a global index).
    """
    results = []
    # ITviec job detail links: /it-jobs/<id>-<slug>
    job_pattern = r'<a[^>]*href="(/it-jobs/\d+[^"]*)"[^>]*title="([^"]+)"'
    job_links = re.findall(job_pattern, raw_html)

    if not job_links:
        # Fallback: try newer pattern without title attr
        job_pattern = r'href="(/it-jobs/\d+[^"]*)"[^>]*>\s*<h3[^>]*>([^<]+)'
        job_links = re.findall(job_pattern, raw_html, re.DOTALL)

    if not job_links:
        # Fallback: /jobs/<slug> pattern (older ITviec)
        job_pattern = r'href="(/jobs/[^"]+)"[^>]*title="([^"]+)"'
        job_links = re.findall(job_pattern, raw_html)

    # Build card-to-image mapping by extracting <img> within each card block
    for href, title in job_links[:30]:
        # Find the card block around this href
        idx = raw_html.find(f'href="{href}"')
        if idx < 0:
            idx = raw_html.find(href)
        if idx < 0:
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
                'image_url': None,
            })
            continue

        # Extract a reasonable card block (500 chars before + after href)
        card_block = raw_html[max(0, idx - 500):idx + 800]
        logo = extract_card_image(card_block, source_domain="itviec")

        results.append({
            'title': clean_text(title.strip()),
            'company_name': 'ITviec Employer',
            'location': 'Ho Chi Minh City / Hanoi',
            'salary_range': 'Thoa thuan',
            'description': '',
            'job_type': 'full_time',
            'required_skills': json.dumps([]),
            'experience_level': '',
            'source_url': f'https://itviec.com{href}',
            'image_url': logo,
        })
    total = len(job_links)
    return results, total


def crawl_topcv_html():
    """Fallback: scrape TopCV.vn (HTML parsing, card-aware image extraction)."""
    url = 'https://www.topcv.vn/viec-lam'
    raw = fetch_url(url, timeout=15)
    if not raw:
        return []

    results = []
    # Match any card with a job title and company inside the <a> block
    job_pattern = re.findall(
        r'<a[^>]*href="([^"]+)"[^>]*>\s*<h3[^>]*>([^<]+)</h3>(.*?)</a>',
        raw, re.DOTALL | re.IGNORECASE
    )
    for href, title, card_body in job_pattern[:50]:
        if len(title.strip()) < 5:
            continue
        logo = extract_card_image(card_body, source_domain="topcv")
        company_match = re.search(r'<p[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)</p>', card_body, re.IGNORECASE)
        results.append({
            'title': clean_text(title.strip()),
            'company_name': clean_text(company_match.group(1).strip()[:255]) if company_match else 'Unknown',
            'location': 'Vietnam',
            'salary_range': 'Thoa thuan',
            'description': '',
            'job_type': 'full_time',
            'required_skills': json.dumps([]),
            'experience_level': '',
            'source_url': href if href.startswith('http') else f'https://www.topcv.vn{href}',
            'image_url': logo,
        })
    return results


def crawl_vietnamworks_html():
    """Fallback: scrape VietnamWorks (Next.js __NEXT_DATA__ JSON extraction).

    VietnamWorks is a Next.js site — the old JSON-in-HTML pattern no longer
    exists.  Job list + company logos now live in the __NEXT_DATA__ script tag
    under ``props.pageProps.outstandingJobs``.

    Each job object has: jobTitle, company, location, salary, url,
    imageUrl, logoUrl — so we get the REAL per-company logo, not an index match.
    """
    url = 'https://www.vietnamworks.com/tim-viec-lam/tim-tat-ca-viec-lam'
    raw = fetch_url(url, timeout=15)
    if not raw:
        return []

    results = []

    # Parse Next.js __NEXT_DATA__ script
    next_data_match = re.search(
        r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',
        raw, re.DOTALL
    )
    if not next_data_match:
        print("  [vietnamworks] No __NEXT_DATA__ script found; HTML structure may have changed")
        return []

    try:
        next_data = json.loads(next_data_match.group(1))
    except json.JSONDecodeError:
        print("  [vietnamworks] Failed to parse __NEXT_DATA__ JSON")
        return []

    # Navigate to outstandingJobs list
    outstanding = next_data.get("props", {}).get("pageProps", {}).get("outstandingJobs", [])
    if not outstanding or not isinstance(outstanding, list):
        print(f"  [vietnamworks] outstandingJobs not found or empty (got {len(outstanding) if outstanding else 0} items)")
        return []

    for job in outstanding[:30]:
        if not isinstance(job, dict):
            continue
        title = job.get("jobTitle", "") or job.get("title", "")
        company = job.get("company", "")
        location = job.get("location", "Vietnam")
        salary = job.get("salary") or job.get("prettySalary", "Thoa thuan")
        job_url = job.get("url", "") or job.get("link", "")
        # logoUrl is full-size company logo; imageUrl is thumbnail
        image_url = job.get("logoUrl") or job.get("imageUrl") or job.get("logo") or None
        # Ensure full URL
        if image_url and image_url.startswith("//"):
            image_url = "https:" + image_url

        results.append({
            'title': clean_text(title) if title else 'Unknown',
            'company_name': clean_text(company) if company else 'Unknown',
            'location': clean_text(location) if location else 'Vietnam',
            'salary_range': clean_text(str(salary)[:100]) if salary else 'Thoa thuan',
            'description': clean_text(job.get("description", ""))[:500] if job.get("description") else '',
            'job_type': 'full_time',
            'required_skills': json.dumps([]),
            'experience_level': clean_text(job.get("experienceLevel", "")) if job.get("experienceLevel") else 'Chua xac dinh',
            'source_url': job_url if job_url else url,
            'image_url': image_url,
        })
    if results:
        print(f"  VietnamWorks: extracted {len(results)} jobs (from outstandingJobs)")
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
            image_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        job_data.get('image_url'),  # company logo / card image
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

    # Ensure image_url column exists (may be missing on older DBs)
    ensure_column(conn, "jobs", "image_url", "TEXT")

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
