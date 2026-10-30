#!/bin/bash
# Job Crawler — runs the FULL feature crawl suite + Overpass POI upsert.
# Used by supervisord as [program:crawler] (24h safety-net loop) AND by
# cron (nightly at 00:00 / 01:00 via crawlers/crontab).
#
# Design: cron is the primary scheduler on HF Spaces (installs at build time
# via Dockerfile).  This supervisord loop is a backstop that ensures the
# feature crawlers still run even if cron fails to start.
set -euo pipefail

DB_PATH="/app/frontend/public/edumap.db"
CRAWLERS_DIR="/app/crawlers"

# Crawl year window — 2 consecutive years (e.g. EDUMAP_CRAWL_YEAR=2027 → [2026,2027]).
# Defaults to current UTC year.  All Python crawlers read this via crawl_scope.
export EDUMAP_CRAWL_YEAR="${EDUMAP_CRAWL_YEAR:-$(date -u +%Y)}"

sleep_time="${CRAWL_INTERVAL_SECONDS:-86400}"  # 24h default

while true; do
  if [ -f "$DB_PATH" ]; then
    # --- Jobs (SQLite, primary HF path) ---
    python3 /app/scripts/crawl_jobs.py --db "$DB_PATH" 2>&1 || \
      echo "[crawler] crawl_jobs.py failed (graceful — continue)" >&2

    # --- Feature crawlers (Postgres path — runs in dev/docker-compose;
    #     degrades to 0 rows on HF Spaces where DB_TYPE=sqlite) ---
    if [ -f "/app/scripts/run_feature_crawlers.sh" ]; then
      bash /app/scripts/run_feature_crawlers.sh 2>&1 || \
        echo "[crawler] feature crawlers failed (graceful — continue)" >&2
    fi

    # --- Overpass POI upsert (Postgres path — same dev/HF caveat) ---
    if [ -f "/app/scripts/run_overpass_seed.sh" ]; then
      bash /app/scripts/run_overpass_seed.sh 2>&1 || \
        echo "[crawler] overpass seed failed (graceful — continue)" >&2
    fi
  else
    echo "[crawler] DB at $DB_PATH not found, skipping crawl this cycle..." >&2
  fi

  echo "[crawler] EDUMAP_CRAWL_YEAR=$EDUMAP_CRAWL_YEAR | Sleeping $sleep_time seconds until next cycle..." >&2
  sleep "$sleep_time"
done
