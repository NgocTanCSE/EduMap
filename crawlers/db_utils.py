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
import time
import random
import json
import requests
import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor

# psycopg2 <2.8 has no Jsonb adapter; use Json (emits a quoted JSON string that
# PostgreSQL coerces to jsonb on input) so the crawlers work on old + new envs.
try:
    from psycopg2.extras import Jsonb as _NativeJsonb
except ImportError:  # pragma: no cover
    from psycopg2.extras import Json as _NativeJsonb


def Jsonb(obj):
    """Wrap a dict/list as a PostgreSQL jsonb value (old + new psycopg2)."""
    return _NativeJsonb(obj)


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
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


def get_conn():
    return psycopg2.connect(**DB_CFG)


def make_session():
    s = requests.Session()
    s.headers.update({"User-Agent": random.choice(USER_AGENTS), "Accept": "application/json, text/html;q=0.9,*/*;q=0.8"})
    return s


def _has_col(conn, table, col):
    """Cache columns per table — some tables (badges/green_challenges) have no
    updated_at, so we never reference a column that doesn't exist."""
    if table not in _TABLE_COLS_CACHE:
        with conn.cursor() as cur:
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s", [table])
            _TABLE_COLS_CACHE[table] = {r[0] for r in cur.fetchall()}
    return col in _TABLE_COLS_CACHE[table]


def sync_seq(conn, table, col="id"):
    """Re-align a SERIAL sequence to max(id) to prevent PK collisions that arise
    from manual/seed inserts that bypass nextval (e.g. badges.id).
    `table`/`col` are internal hard-coded names -> safe to interpolate as
    identifiers (psycopg2 %s would render them as quoted strings -> syntax err)."""
    try:
        with conn.cursor() as cur:
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
    placeholders = ", ".join(["%s"] * len(cols))

    key_where = " AND ".join([f"{c} = %s" for c in key_cols])
    key_vals = [row[c] for c in key_cols if c in row]

    with conn.cursor() as cur:
        cur.execute(f"SELECT id FROM {table} WHERE {key_where}", key_vals)
        existing = cur.fetchone()
        if existing:
            set_cols = [c for c in cols if c not in key_cols and c != "id"]
            if set_cols:
                extra = ["updated_at = NOW()"] if _has_col(conn, table, "updated_at") else []
                set_clause = ", ".join([f"{c} = %s" for c in set_cols] + extra)
                cur.execute(
                    f"UPDATE {table} SET {set_clause} WHERE id = %s",
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
        except psycopg2.Error as e:
            conn.rollback()
            skipped += 1
            print(f"    [upsert {table}] skip row key={ {k: r.get(k) for k in key_cols} }: {e.diag.message_primary if e.diag else e}")
    return {"added": added, "updated": updated, "skipped": skipped, "total": len(rows)}
