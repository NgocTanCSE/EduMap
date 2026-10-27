#!/usr/bin/env python3
"""
EduMap — portable SQLite content seeder for HF Spaces (DB_TYPE=sqlite).

HISTORY / WHY THIS FILE IS NOW A THIN WRAPPER
---------------------------------------------
This script used to inject *demo* feature data into `frontend/public/edumap.db`:
"EduMap Foundation" scholarships, "EduMap Academy" courses, "Test Campaign"
summer rows, EduMap-branded hackathons, synthetic mentors on `@edumap.vn`, …
Users verified the live HF Space and reported that data as fabricated.

All content now lives in `scripts/real_vn_data.py` (verified Vietnamese
organisations with official source URLs) and is applied by
`scripts/migrate_real_data.py`. This script simply forwards to that migration so
existing regeneration pipelines (`scripts/regenerate_sqlite_db.sh`) keep
working.

USAGE
-----
    python3 scripts/seed_sqlite_db.py
    EDUMAP_SQLITE_DB=/path/to/edumap.db python3 scripts/seed_sqlite_db.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from migrate_real_data import main as migrate_main  # noqa: E402


def main() -> int:
    print("ℹ️  seed_sqlite_db.py now seeds verified Vietnamese data")
    print("   (source of truth: scripts/real_vn_data.py)")
    return migrate_main()


if __name__ == "__main__":
    raise SystemExit(main())
