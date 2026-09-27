#!/usr/bin/env bash
# =============================================================================
# EduMap crawler pipeline — runs nationwide crawl and loads real crawled data
# into the PostgreSQL/PostGIS database.
#
# Schedule (in docker): daily at 00:00:00 via cron (see crawlers/crontab).
# Run once manually:
#   docker compose run --rm crawler /app/scripts/run_crawl_pipeline.sh
#
# Flow:
#   1. python crawler/aggregator.py   -> crawlers/crawled_data/consolidated_*.sql
#   2. stage SQL as seed_crawled_data.sql (name execute_db_setup.py globs)
#   3. python scripts/execute_db_setup.py -> DROP SCHEMA + reload schema/seed/crawl (+dedup)
#   4. refresh vector DB (best-effort; optional, needs GEMINI_API_KEY)
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/app}"
cd "$APP_DIR"

# Bring DB/vector env into scope (secrets are NOT echoed; they just flow to subprocesses).
if [ -f "$APP_DIR/.env" ]; then
  set -a; . "$APP_DIR/.env"; set +a
fi

echo "[crawl] $(date -Iseconds) START nationwide aggregation"

# ---------------------------------------------------------------- 1) crawl
cd "$APP_DIR/crawlers"
python3 aggregator.py

# ---------------------------------------------------------------- 2) stage SQL
cd "$APP_DIR"
rm -f seed_crawled_data*.sql
# `cat` handles possible *_partN chunks produced by the aggregator.
CONSOLIDATED=$(ls crawlers/crawled_data/consolidated_crawled_data_*.sql 2>/dev/null || true)
if [ -z "$CONSOLIDATED" ]; then
  echo "[crawl] WARNING: aggregator produced no consolidated SQL; skipping DB load."
  exit 0
fi
cat $CONSOLIDATED > seed_crawled_data.sql
echo "[crawl] staged seed_crawled_data.sql ($(wc -l < seed_crawled_data.sql) lines)"

# ---------------------------------------------------------------- 3) load into DB
# execute_db_setup.py loads schema.sql + seed.sql + seed_crawled_data*.sql +
# analytics + python seed scripts, then dedups map_points (full refresh nightly).
python3 scripts/execute_db_setup.py

# ---------------------------------------------------------------- 4) vector refresh (optional)
if [ -f "$APP_DIR/ai-service/seed_vector_db.py" ]; then
  ( cd "$APP_DIR/ai-service" && python3 seed_vector_db.py ) \
    && echo "[crawl] vector DB refreshed." \
    || echo "[crawl] vector refresh skipped (optional; needs GEMINI_API_KEY + chromadb)."
fi

echo "[crawl] $(date -Iseconds) DONE — DB now contains real crawled data."
