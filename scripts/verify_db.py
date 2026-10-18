#!/usr/bin/env python3
"""Verify edumap.db is a valid SQLite database.

If the file in the Docker build context is corrupted (e.g., 132 bytes —
a git-lfs pointer or .gitignore-mangled version from HF Spaces upload),
download the correct 1.3MB file from the public GitHub repo.

This makes the Docker build resilient to HF Spaces file upload issues
where binary .db files may be stored as 132-byte git-lfs pointers.
"""
import sqlite3
import os
import sys
import urllib.request

DB_PATH = './public/edumap.db'
GITHUB_URL = 'https://raw.githubusercontent.com/NgocTanCSE/EduMap/main/frontend/public/edumap.db'
MIN_SIZE = 1_000_000  # 1 MB minimum for a valid SQLite DB


def _ensure_table(conn, table_name, ddl):
    """Create a table if it doesn't exist (idempotent)."""
    existing = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    ).fetchone()
    if not existing:
        conn.execute(f'CREATE TABLE {table_name} ({ddl})')
        conn.commit()
        print(f'  [verify_db] created table: {table_name}')


def _ensure_column(conn, table_name, column_name, col_type="TEXT"):
    """Add a column to a SQLite table if it doesn't exist (idempotent)."""
    existing = {row[1] for row in conn.execute(f'PRAGMA table_info({table_name})').fetchall()}
    if column_name not in existing:
        conn.execute(f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {col_type}')
        conn.commit()
        print(f'  [verify_db] added column: {table_name}.{column_name}')


def main():
    size = os.path.getsize(DB_PATH)
    print(f'  edumap.db initial size: {size} bytes')

    # If file is too small, download from GitHub (repo is public)
    if size < MIN_SIZE:
        print(f'  ⚠️  edumap.db is only {size} bytes — corrupted, downloading from GitHub...')
        urllib.request.urlretrieve(GITHUB_URL, DB_PATH)
        size = os.path.getsize(DB_PATH)
        print(f'  edumap.db downloaded from GitHub: {size} bytes')

    if size < MIN_SIZE:
        print(f'  ❌ CRITICAL: edumap.db is still only {size} bytes after GitHub fallback!')
        sys.exit(1)

    # Verify it's valid SQLite with tables
    conn = sqlite3.connect(DB_PATH)
    n_tables = conn.execute(
        "SELECT count(*) FROM sqlite_master WHERE type='table'"
    ).fetchone()[0]
    print(f'  Tables: {n_tables}')

    if n_tables == 0:
        print('  ❌ CRITICAL: edumap.db has no tables — invalid SQLite!')
        sys.exit(1)

    # ── Ensure runtime tables/columns exist in SQLite mode ──────────────────
    # The pre-seeded edumap.db may be missing tables/columns added to the
    # NestJS entity layer AFTER the DB build (e.g. chat_histories, image_url).
    # CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS are idempotent.
    # This runs during Docker build (before supervisord starts), so the
    # baked-in DB is always schema-complete for runtime.
    _ensure_table(conn, "chat_histories", """
        id TEXT PRIMARY KEY,
        user_id TEXT,
        message TEXT NOT NULL,
        response TEXT NOT NULL,
        context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    """)
    _ensure_column(conn, "jobs", "image_url", "TEXT")
    _ensure_column(conn, "learning_materials", "thumbnail_url", "TEXT")
    conn.close()

    # Re-open to confirm tables persisted
    conn2 = sqlite3.connect(DB_PATH)
    has_chat = conn2.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='chat_histories'"
    ).fetchone() is not None
    conn2.close()
    print(f'  chat_histories table: {"✅ ensured" if has_chat else "❌ missing"}')

    print('  ✅ edumap.db is valid SQLite database')


if __name__ == '__main__':
    main()
