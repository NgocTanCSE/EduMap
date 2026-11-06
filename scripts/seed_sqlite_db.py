

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from migrate_real_data import main as migrate_main  


def main() -> int:
    print("ℹ️  seed_sqlite_db.py now seeds verified Vietnamese data")
    print("   (source of truth: scripts/real_vn_data.py)")
    return migrate_main()


if __name__ == "__main__":
    raise SystemExit(main())
