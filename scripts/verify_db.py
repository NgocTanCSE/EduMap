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
    conn.close()
    print(f'  Tables: {n_tables}')

    if n_tables == 0:
        print('  ❌ CRITICAL: edumap.db has no tables — invalid SQLite!')
        sys.exit(1)

    print('  ✅ edumap.db is valid SQLite database')


if __name__ == '__main__':
    main()
