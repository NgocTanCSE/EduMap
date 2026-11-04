#!/usr/bin/env python3
"""Migrate data from the shipped SQLite DB into a Supabase/Postgres DB.

Usage:
    DB_TYPE=postgres DB_HOST=... DB_PORT=5432 DB_USERNAME=postgres \
      DB_PASSWORD=... DB_DATABASE=postgres \
      python3 scripts/migrate_sqlite_to_postgres.py --sqlite frontend/public/edumap.db

Idempotent: uses INSERT ... ON CONFLICT DO NOTHING on the table's primary key,
so re-running will not duplicate rows. Tables that do not exist in Postgres
(or are SQLite-internal) are skipped with a warning.

Dependencies: psycopg2 (available in the ai-deps stage / ai-service venv).
"""
import argparse
import os
import sqlite3
import sys

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError as e:  # pragma: no cover - environment guard
    print(f"ERROR: psycopg2 not available: {e}")
    sys.exit(1)

SKIP_TABLES = {"sqlite_sequence", "sqlite_master", "sqlite_stat1"}


def pg_conn():
    host = os.getenv("DB_HOST", "localhost")
    kwargs = dict(
        host=host,
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.getenv("DB_USERNAME", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        dbname=os.getenv("DB_DATABASE", "postgres"),
    )
    # Supabase (and most managed Postgres) require TLS. Enable sslmode=require
    # for any non-localhost host so local docker-compose (plain) keeps working.
    if host and host != "localhost" and host != "127.0.0.1":
        kwargs["sslmode"] = os.getenv("DB_SSLMODE", "require")
    return psycopg2.connect(**kwargs)


def pg_tables(cur):
    cur.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' AND table_type='BASE TABLE'"
    )
    return {r[0] for r in cur.fetchall()}


def pg_columns(cur, table):
    cur.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=%s",
        (table,),
    )
    return [r[0] for r in cur.fetchall()]


def pg_pk(cur, table):
    cur.execute(
        """
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = %s::regclass AND i.indisprimary
        """,
        (table,),
    )
    rows = cur.fetchall()
    return rows[0][0] if rows else None


def migrate(sqlite_path):
    if not os.path.exists(sqlite_path):
        print(f"ERROR: sqlite file not found: {sqlite_path}")
        sys.exit(1)

    sconn = sqlite3.connect(sqlite_path)
    sconn.row_factory = sqlite3.Row
    pconn = pg_conn()
    pcur = pconn.cursor()

    pg_tbls = pg_tables(pcur)
    sqlite_tbls = [
        r[0]
        for r in sconn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
    ]

    total_rows = 0
    for table in sqlite_tbls:
        if table in SKIP_TABLES:
            continue
        if table not in pg_tbls:
            print(f"  SKIP (no PG table): {table}")
            continue

        cols = pg_columns(pcur, table)
        pk = pg_pk(pcur, table)

        # SQLite columns for this table
        s_cols = [r[1] for r in sconn.execute(f"PRAGMA table_info({table})").fetchall()]
        # intersect, preserving PG column order
        common = [c for c in cols if c in s_cols]
        if not common:
            print(f"  SKIP (no common columns): {table}")
            continue

        rows = sconn.execute(
            f"SELECT {', '.join(common)} FROM {table}"
        ).fetchall()
        if not rows:
            print(f"  {table}: 0 rows (empty)")
            continue

        values = [tuple(r[c] for c in common) for r in rows]
        col_sql = ", ".join(f'"{c}"' for c in common)

        if pk and pk in common:
            conflict = f' ON CONFLICT ("{pk}") DO NOTHING'
        else:
            conflict = ""

        sql = f'INSERT INTO "{table}" ({col_sql}) VALUES %s{conflict}'
        execute_values(pcur, sql, values, page_size=500)
        pconn.commit()
        total_rows += len(values)
        print(f"  {table}: {len(values)} rows migrated")

    pcur.close()
    pconn.close()
    sconn.close()
    print(f"\nDONE: {total_rows} rows migrated.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sqlite", default=os.getenv("DB_SQLITE_PATH", "frontend/public/edumap.db"))
    args = ap.parse_args()
    print(f"Migrating {args.sqlite} -> Postgres ({os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_DATABASE')})")
    migrate(args.sqlite)


if __name__ == "__main__":
    main()
