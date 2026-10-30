# -*- coding: utf-8 -*-
"""
Shared DB + HTTP helpers for EduMap feature crawlers (B).

Design rules
------------
* Read connection params from environment (loaded via `set -a; . ./.env; set +a`
  by the runner / docker entrypoint).
* ONLY upsert (SELECT-then-UPDATE / INSERT) — NEVER DROP SCHEMA / full refresh.
  Safe to run on the live dev DB at 00:00 every night.
* Graceful degradation: every external source is wrapped so a network/HTTP
  failure returns 0 rows instead of crashing the nightly run.
"""
import os
import re
import time
import random
import json
import sqlite3
import contextlib

# HF Spaces runs SQLite only (no PostgreSQL server). psycopg2 is optional —
# only needed when DB_TYPE=postgresql (dev / docker-compose). Crawlers on
# HF Spaces use sqlite3 (stdlib) to upsert into edumap.db.
try:
    import requests
except ImportError:
    requests = None

try:
    import psycopg2
    from psycopg2 import sql
    from psycopg2.extras import RealDictCursor
    try:
        from psycopg2.extras import Jsonb as _NativeJsonb
    except ImportError:  # pragma: no cover
        from psycopg2.extras import Json as _NativeJsonb
    _HAS_PSYCOPG = True
except ImportError:
    psycopg2 = None
    sql = None
    RealDictCursor = None
    _NativeJsonb = None
    _HAS_PSYCOPG = False


def Jsonb(obj):
    """Wrap a dict/list as a PostgreSQL jsonb value (old + new psycopg2).

    On SQLite (HF Spaces), stores as JSON TEXT string instead.
    """
    if _IS_SQLITE:
        return json.dumps(obj, ensure_ascii=False) if obj is not None else None
    return _NativeJsonb(obj)


# --------------------------------------------------------------------------- #
# Schema helpers
# --------------------------------------------------------------------------- #

def ensure_column(conn, table, column, col_type="TEXT"):
    """Add a column to a table if it doesn't already exist.

    Uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS (PostgreSQL).
    On SQLite (used in HF Spaces / local Docker), falls back to
    checking PRAGMA table_info and ALTER TABLE ADD COLUMN.
    Safe to call every run — no-op if column already exists.
    """
    if _has_col(conn, table, column):
        return
    try:
        with _cursor(conn) as cur:
            cur.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {col_type}')
        conn.commit()
        _TABLE_COLS_CACHE.pop(table, None)  # invalidate cached columns
        print(f"  [ensure_column {table}] added column '{column}' ({col_type})")
    except Exception as e:
        conn.rollback()
        print(f"  [ensure_column {table}] cannot add '{column}': {e}")


# --------------------------------------------------------------------------- #
# Image extraction helpers
# --------------------------------------------------------------------------- #

def extract_card_image(card_html, source_domain=None):
    """Extract the FIRST relevant <img> src from a single card's HTML block.

    This is **card-aware**: it searches for <img> tags *within* the card's
    HTML, not across the whole page.  This prevents grabbing site logos,
    banners, or other unrelated images (the common bug of ``imgs[i]`` index
    matching on Eventbrite/Devpost listing pages).

    Also filters out tracking pixels, 1×1 spacers (detected via URL patterns
    *and* width/height attributes), logos, and placeholder GIFs.

    Args:
        card_html: HTML snippet for a single card / list item.
        source_domain: (optional) prefer images from this domain
                       (e.g. "eventbrite" for Eventbrite listings).

    Returns:
        Image URL string or ``None``.
    """
    if not card_html:
        return None
    # Find full <img> tags (with attributes) within this card block only
    img_tags = re.findall(r'<img\s+[^>]*>', card_html, re.IGNORECASE | re.DOTALL)
    if not img_tags:
        return None
    # Filter out tracking pixels, 1×1 spacers, and obvious non-content images
    content_imgs = []
    for tag in img_tags:
        src_match = re.search(r'src="([^"]+)"', tag, re.IGNORECASE)
        if not src_match:
            continue
        src = src_match.group(1)
        low = src.lower()
        # Skip by URL pattern
        if any(x in low for x in ("pixel", "track", "spacer", "loading", "1x1", ".gif")):
            continue
        # Skip by width/height = 1 (tracking pixel)
        w_match = re.search(r'width\s*=\s*["\']?1["\']?', tag, re.IGNORECASE)
        h_match = re.search(r'height\s*=\s*["\']?1["\']?', tag, re.IGNORECASE)
        if w_match or h_match:
            continue
        content_imgs.append(src)
    # Prefer source_domain images if specified
    if source_domain:
        domain_imgs = [i for i in content_imgs if source_domain in i.lower()]
        if domain_imgs:
            return domain_imgs[0]
    return content_imgs[0] if content_imgs else None


def extract_eventbrite_cards(html):
    """Extract per-card data from an Eventbrite event-listing page.

    Returns a list of dicts: [{title, href, img, date}, ...].

    Key difference from the old approach:
    - Old: ``imgs[i]`` matched the i-th <img> on the *whole page* to the
      i-th card — **unreliable** (site logo, banner, etc. could be image[0]).
    - New: each card's HTML block is isolated; the first relevant <img> *inside
      that block* is the card's image — **accurate 1-to-1 mapping**.
    """
    items = []
    # Match each card anchor: href="/e/...ticket-N"> ... </a>
    # We slice the HTML between consecutive card anchors to get per-card blocks.
    card_anchors = list(re.finditer(r'href="(/e/[^"]+?ticket-\d+)"', html))
    for i, m in enumerate(card_anchors):
        href = m.group(1)
        start = m.start()
        # End of this card = start of next card anchor (or end of HTML)
        end = card_anchors[i + 1].start() if i + 1 < len(card_anchors) else len(html)
        card_block = html[start:end]

        title_match = re.search(r'<h3[^>]*>([^<]+)</h3>', card_block)
        title = title_match.group(1).strip() if title_match else ""
        if not title or title.lower() in ("see all", "xem tất cả", "see all  ", ""):
            continue

        date_match = re.search(r'<time[^>]*datetime="([^"]+)"', card_block)
        date = date_match.group(1) if date_match else None

        # Per-card image extraction (NOT global index)
        img = extract_card_image(card_block, source_domain="eventbrite")

        items.append({
            "title": title[:255],
            "href": href,
            "date": date,
            "img": img,
            "raw_block": card_block,
        })
    # Fallback: if no structured cards found, try <h3>-only extraction
    if not items:
        h3_matches = list(re.finditer(r'<h3[^>]*>([^<]{6,90})</h3>', html))
        for i, m in enumerate(h3_matches):
            title = m.group(1).strip()
            if title.lower() in ("see all", "xem tất cả"):
                continue
            start = m.start()
            end = h3_matches[i + 1].start() if i + 1 < len(h3_matches) else len(html)
            block = html[start:end]
            img = extract_card_image(block, source_domain="eventbrite")
            items.append({
                "title": title[:255],
                "href": "",
                "date": None,
                "img": img,
                "raw_block": block,
            })
    return items


def fetch_og_image(session, url, timeout=15, retries=1):
    """Fetch a page and extract the Open Graph image (og:image meta tag).

    Used for HN stories that link to external articles — the article page's
    og:image is the **exact** image associated with that story.

    Returns the image URL string or ``None``.
    """
    if not url or not url.startswith("http"):
        return None
    try:
        session.headers["User-Agent"] = random.choice(USER_AGENTS)
        r = session.get(url, timeout=timeout, allow_redirects=True)
        if r.status_code != 200:
            return None
        # og:image meta tag
        og = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', r.text, re.IGNORECASE)
        if og:
            img = og.group(1).strip()
            if img.startswith("//"):
                img = "https:" + img
            return img
        # Fallback: first non-tracking <img> on the page
        return extract_card_image(r.text)
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
# SQLite mode (HF Spaces default): DB_TYPE=sqlite → use sqlite3 stdlib.
# PostgreSQL mode (dev / docker-compose): DB_TYPE unset or =postgresql → psycopg2.
_IS_SQLITE = os.getenv("DB_TYPE", "sqlite") == "sqlite"
_DB_SQLITE_PATH = os.getenv("DB_SQLITE_PATH", "/app/frontend/public/edumap.db")
# SQLite uses ? placeholders; PostgreSQL uses %s.
_PLACEHOLDER = "?" if _IS_SQLITE else "%s"
# Timestamp expression: SQLite has no NOW(); use datetime('now').
_NOW_EXPR = "datetime('now')" if _IS_SQLITE else "NOW()"

DB_CFG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5433")),
    "dbname": os.getenv("DB_DATABASE", "edumap_db"),
    "user": os.getenv("DB_USERNAME", "edumap"),
    "password": os.getenv("DB_PASSWORD", ""),
    "connect_timeout": 15,
}

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "EduMapCrawler/1.0 (+https://edumap.vn; contact admin@edumap.vn)",
]

_TABLE_COLS_CACHE: dict = {}


@contextlib.contextmanager
def _cursor(conn):
    """Context manager that works with BOTH sqlite3 and psycopg2 cursors.

    psycopg2 cursors support `with conn.cursor() as cur:` natively (commits/
    rolls back on exit). SQLite3 cursors do NOT — they raise TypeError for
    the context-manager protocol. This helper abstracts that difference.
    """
    cur = conn.cursor()
    try:
        yield cur
    finally:
        cur.close()


def get_conn():
    if _IS_SQLITE:
        return sqlite3.connect(_DB_SQLITE_PATH)
    return psycopg2.connect(**DB_CFG)


def make_session():
    s = requests.Session()
    s.headers.update({"User-Agent": random.choice(USER_AGENTS), "Accept": "application/json, text/html;q=0.9,*/*;q=0.8"})
    return s


def _has_col(conn, table, col):
    """Cache columns per table — some tables (badges/green_challenges) have no
    updated_at, so we never reference a column that doesn't exist.

    SQLite: uses PRAGMA table_info. PostgreSQL: uses information_schema.
    """
    if table not in _TABLE_COLS_CACHE:
        with _cursor(conn) as cur:
            if _IS_SQLITE:
                cur.execute(f"PRAGMA table_info({table})")
                _TABLE_COLS_CACHE[table] = {row[1] for row in cur.fetchall()}
            else:
                cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s", [table])
                _TABLE_COLS_CACHE[table] = {r[0] for r in cur.fetchall()}
    return col in _TABLE_COLS_CACHE[table]


def sync_seq(conn, table, col="id"):
    """Re-align a SERIAL sequence to max(id) to prevent PK collisions that arise
    from manual/seed inserts that bypass nextval (e.g. badges.id).
    `table`/`col` are internal hard-coded names -> safe to interpolate as
    identifiers (psycopg2 %s would render them as quoted strings -> syntax err).

    No-op on SQLite (AUTOINCREMENT handles this automatically).
    """
    if _IS_SQLITE:
        return
    try:
        with _cursor(conn) as cur:
            cur.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}', '{col}'), "
                f"COALESCE((SELECT MAX({col}) FROM {table}), 1), true)"
            )
        conn.commit()
    except Exception as e:
        print(f"    [sync_seq {table}] {e}")


def fetch_json(session, url, timeout=30, retries=3):
    """GET JSON; rotate UA on 429/503; return None on hard failure."""
    for attempt in range(retries):
        try:
            session.headers["User-Agent"] = random.choice(USER_AGENTS)
            r = session.get(url, timeout=timeout)
            if r.status_code == 200:
                try:
                    return r.json()
                except ValueError:
                    return _coerce_json(r.text)
            if r.status_code in (429, 503, 418):
                time.sleep(5 * (attempt + 1)); continue
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1)); continue
            print(f"    [{url}] HTTP {r.status_code}")
            return None
        except requests.RequestException as e:
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1)); continue
            print(f"    [{url}] network error: {e}")
            return None
    return None


def fetch_html(session, url, timeout=25, retries=2):
    """GET text/HTML; return None on failure."""
    for attempt in range(retries + 1):
        try:
            session.headers["User-Agent"] = random.choice(USER_AGENTS)
            r = session.get(url, timeout=timeout)
            if r.status_code == 200 and r.text:
                return r.text
            if r.status_code in (429, 503, 418):
                time.sleep(5 * (attempt + 1)); continue
            print(f"    [{url}] HTTP {r.status_code}")
            return None
        except requests.RequestException as e:
            if attempt < retries:
                time.sleep(2); continue
            print(f"    [{url}] network error: {e}")
            return None
    return None


def extract_itviec_jobs(html):
    """Extract per-card job data from an ITviec listing page.

    Returns a list of dicts: [{title, company, location, href}, ...].

    Card-aware: isolates each job anchor (`/viec-lam-<id>`) block, then extracts
    title/company/location from THAT block only (never a global index that could
    match the site header). Selectors are best-effort — if ITviec changes its
    DOM, this returns fewer/zero rows but never crashes (graceful degradation).
    """
    items = []
    if not html:
        return items
    anchors = list(re.finditer(r'<a[^>]+href="(/viec-lam-[^\"]+)"[^>]*>', html, re.IGNORECASE))
    for i, m in enumerate(anchors):
        start = m.end()
        end = anchors[i + 1].start() if i + 1 < len(anchors) else len(html)
        block = html[start:end]

        t = re.search(r'title="([^"]{3,120})"', m.group(0), re.IGNORECASE)
        if not t:
            t = re.search(r'<h3[^>]*>([^<]+)</h3>', block, re.IGNORECASE)
        title = (t.group(1).strip() if t else "").strip()
        if not title:
            continue

        co = re.search(r'class="[^"]*company[^"]*"[^>]*>\s*([^<\n]+)', block, re.IGNORECASE)
        company = co.group(1).strip() if co else "ITviec"
        loc = re.search(r'class="[^"]*location[^"]*"[^>]*>\s*([^<\n]+)', block, re.IGNORECASE)
        location = loc.group(1).strip() if loc else "Việt Nam"

        items.append({
            "title": title,
            "company": company,
            "location": location,
            "href": m.group(1),
        })
    return items


def extract_topcv_jobs(html):
    """Extract per-card job data from a TopCV listing page.

    Returns a list of dicts: [{title, company, location, href}, ...].

    Best-effort: TopCV is heavy on client JS and regularly refreshes its DOM, so
    this parser tries several card selectors and skips anything without a title.
    Blocked/drift -> fewer/zero rows, never crashes (graceful degradation).
    """
    items = []
    if not html:
        return items

    # Job-card anchors: href pointing at a /viec-lam-<id> (relative or absolute).
    anchors = [m for m in re.finditer(r'<a[^>]*href="([^"]*)"[^>]*>', html, re.IGNORECASE)
               if "viec-lam" in (m.group(1) or "")]
    # Fallback: anchors whose block contains a job-title element.
    if not anchors:
        for m in re.finditer(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', html, re.IGNORECASE | re.DOTALL):
            blk = m.group(2)
            if re.search(r'class="[^"]*(?:title|job-name)[^"]*"', blk, re.IGNORECASE) and "viec-lam" in m.group(1):
                anchors.append(m)

    for i, m in enumerate(anchors):
        href = m.group(1)
        if not href.startswith("http"):
            href = "https://www.topcv.vn" + (href if href.startswith("/") else "/" + href)
        start = m.end()
        end = anchors[i + 1].start() if i + 1 < len(anchors) else len(html)
        block = html[start:end]

        # Title: title attr -> h3 -> strong -> .title/.job-title class text.
        t = re.search(r'title="([^"]{3,120})"', m.group(0), re.IGNORECASE)
        if not t:
            t = re.search(r'<h3[^>]*>([^<]+)</h3>', block, re.IGNORECASE)
        if not t:
            t = re.search(r'<strong[^>]*>([^<]+)</strong>', block, re.IGNORECASE)
        if not t:
            t = re.search(r'class="[^"]*(?:job-title|title)[^"]*"[^>]*>\s*([^<]+)', block, re.IGNORECASE)
        title = (t.group(1).strip() if t else "").strip()
        if not title or len(title) < 4:
            continue

        co = re.search(r'class="[^"]*company[^"]*"[^>]*>\s*([^<\n,]+)', block, re.IGNORECASE)
        if not co:
            co = re.search(r'Công ty[:\s]+([^<\n,]+)', block, re.IGNORECASE)
        company = co.group(1).strip() if co else "TopCV"
        loc = re.search(r'class="[^"]*location[^"]*"[^>]*>\s*([^<\n]+)', block, re.IGNORECASE)
        location = loc.group(1).strip() if loc else "Việt Nam"

        items.append({
            "title": title,
            "company": company,
            "location": location,
            "href": href,
        })
    return items


def crawl_pages(session, make_url, fetcher, parser, key=None, max_pages=50,
                stop_when_empty=True, stop_when_fewer_than=None, sleep=0.7,
                label='crawl_pages', max_total=None):
    """Generic multi-page crawler primitive.

    Replaces the per-crawler ``for page in range(1, N): fetch_html(...)`` loops
    with ONE reusable, battle-tested abstraction so EVERY crawler walks many
    pages (not just 1-2) instead of duplicating boilerplate.

    Walks pages 1..max_pages:
      * ``make_url(page) -> str``          — page URL builder (page is 1-based)
      * ``fetcher(url) -> raw | None``     — pass ``fetch_json`` or ``fetch_html``
                                            (they already retry 429/503 and return
                                            None on hard failure -> graceful deg.)
      * ``parser(raw) -> list[dict]``      — turn raw response into item dicts
      * ``key``                            — dedup key: a tuple of column names
                                            (e.g. ("title","company_name")) OR a
                                            callable dict->scalar. None = no dedup.
      * ``stop_when_empty``                — stop at first page that returns
                                            None/[] (common for APIs that 404
                                            past the last page).
      * ``stop_when_fewer_than``           — stop once a page yields < N items
                                            (last partial page), still keeping
                                            those items.
      * ``max_total``                      — hard cap on items collected.
      * ``sleep``                          — polite delay between pages (sec).

    Returns a flat, deduped list of item dicts. Safe to call with no network:
    a fully unreachable source simply returns [] (no crash).
    """
    out = []
    seen = set()

    if isinstance(key, (list, tuple)):
        key_fn = lambda it: tuple(str(it.get(k, '')) for k in key)
    elif callable(key):
        key_fn = key
    else:
        key_fn = None

    fewer = stop_when_fewer_than
    for page in range(1, max_pages + 1):
        url = make_url(page)
        try:
            # fetch_json / fetch_html take (session, url, ...).
            raw = fetcher(session, url)
        except Exception as e:
            print(f"  [{label}] page {page} fetch error: {e}")
            raw = None

        if raw is None:
            if stop_when_empty:
                print(f"  [{label}] page {page} empty/unreachable -> stop")
                break
            continue

        # Materialize parser output (parsers may be generator funcs -> len()
        # and truthiness checks below need a real list).
        items = list(parser(raw)) if parser else (raw if isinstance(raw, list) else [raw])
        if not items and stop_when_empty:
            print(f"  [{label}] page {page} no items -> stop")
            break

        page_added = 0
        for it in items:
            k = key_fn(it) if key_fn else None
            if k is not None and k in seen:
                continue
            if k is not None:
                seen.add(k)
            out.append(it)
            page_added += 1
            if max_total is not None and len(out) >= max_total:
                return out

        # Last/partial page -> we've reached the end of the source.
        if fewer is not None and len(items) < fewer:
            break
        # Every item on this page was a duplicate -> assume nothing new remains.
        if key_fn and page_added == 0 and page > 1:
            break
        if sleep:
            time.sleep(sleep)
    return out


def _coerce_json(text):
    text = (text or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except ValueError:
        try:
            dec = json.JSONDecoder()
            obj, _ = dec.raw_decode(text.lstrip())
            return obj
        except ValueError:
            return None


def upsert_row(conn, table, row, key_cols):
    """
    Idempotent upsert into `table`.

    `row`      : dict col->value (dict/list values already wrapped in Jsonb)
    `key_cols` : columns forming a natural unique key. If a row with the matching
                 key exists -> UPDATE the non-key columns (refresh). Otherwise INSERT.
    Returns True if a new row was inserted, False if updated/existing.
    """
    if not row:
        return False
    cols = list(row.keys())
    vals = [row[c] for c in cols]
    placeholders = ", ".join([_PLACEHOLDER] * len(cols))

    key_where = " AND ".join([f"{c} = {_PLACEHOLDER}" for c in key_cols])
    key_vals = [row[c] for c in key_cols if c in row]

    with _cursor(conn) as cur:
        cur.execute(f"SELECT id FROM {table} WHERE {key_where}", key_vals)
        existing = cur.fetchone()
        if existing:
            set_cols = [c for c in cols if c not in key_cols and c != "id"]
            if set_cols:
                extra = [f"updated_at = {_NOW_EXPR}"] if _has_col(conn, table, "updated_at") else []
                set_clause = ", ".join([f"{c} = {_PLACEHOLDER}" for c in set_cols] + extra)
                cur.execute(
                    f"UPDATE {table} SET {set_clause} WHERE id = {_PLACEHOLDER}",
                    [row[c] for c in set_cols] + [existing[0]],
                )
            return False  # updated, not new
        col_list = ", ".join(cols)
        cur.execute(f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})", vals)
        return True


def upsert_rows(conn, table, rows, key_cols):
    added = updated = skipped = 0
    for r in rows:
        try:
            if upsert_row(conn, table, r, key_cols):
                added += 1
            else:
                updated += 1
            conn.commit()
        except Exception as e:
            conn.rollback()
            skipped += 1
            print(f"    [upsert {table}] skip row key={ {k: r.get(k) for k in key_cols} }: {e}")
    return {"added": added, "updated": updated, "skipped": skipped, "total": len(rows)}
