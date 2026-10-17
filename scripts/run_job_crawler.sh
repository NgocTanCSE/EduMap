#!/bin/bash
# Job Crawler cron wrapper — runs every 24 hours
# Used by supervisord as [program:crawler]
set -euo pipefail

DB_PATH="/app/frontend/public/edumap.db"
sleep_time="${CRAWL_INTERVAL_SECONDS:-86400}"  # 24h default

while true; do
  if [ -f "$DB_PATH" ]; then
    python3 /app/scripts/crawl_jobs.py --db "$DB_PATH" 2>&1 || true
    # Also re-run map crawler if it exists
    if [ -f "/app/scripts/migrate-pg-to-sqlite.py" ]; then
      true  # No re-migration needed — that's for fresh builds
    fi
  else
    echo "[crawler] DB at $DB_PATH not found, skipping..." >&2
  fi
  echo "[crawler] Sleeping $sleep_time seconds until next cycle..." >&2
  sleep "$sleep_time"
done
