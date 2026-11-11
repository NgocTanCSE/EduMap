#!/bin/bash







set -euo pipefail


export DB_TYPE="${DB_TYPE:-postgres}"
export DB_SQLITE_PATH="${DB_SQLITE_PATH:-/app/data/edumap.db}"

DB_PATH="${DB_SQLITE_PATH}"
CRAWLERS_DIR="/app/crawlers"



export EDUMAP_CRAWL_YEAR="${EDUMAP_CRAWL_YEAR:-$(date -u +%Y)}"

sleep_time="${CRAWL_INTERVAL_SECONDS:-86400}"  # 24h default

while true; do
  if [ "$DB_TYPE" = "postgres" ] || [ -f "$DB_PATH" ]; then
    # --- Jobs (SQLite, primary container path) ---
    python3 /app/scripts/crawl_jobs.py --db "$DB_PATH" 2>&1 || \
      echo "[crawler] crawl_jobs.py failed (graceful — continue)" >&2

    # --- Feature crawlers (Postgres path — runs in dev/docker-compose;
    #     degrades to 0 rows on host where DB_TYPE=sqlite) ---
    if [ -f "/app/scripts/run_feature_crawlers.sh" ]; then
      bash /app/scripts/run_feature_crawlers.sh 2>&1 || \
        echo "[crawler] feature crawlers failed (graceful — continue)" >&2
    fi

    # --- Overpass POI upsert (Postgres path — same dev/prod caveat) ---
    # NOTE: Overpass API is blocked on host; crawl_pois_vietnam.py now
    # uses Tavily (TAVILY_API_KEY) instead. When the key is absent, the script
    # degrades to 0 rows gracefully.
    if [ -f "/app/scripts/run_overpass_seed.sh" ]; then
      bash /app/scripts/run_overpass_seed.sh 2>&1 || \
        echo "[crawler] poi seed failed (graceful — continue)" >&2
    fi
  else
    echo "[crawler] DB at $DB_PATH not found, skipping crawl this cycle..." >&2
  fi

  echo "[crawler] EDUMAP_CRAWL_YEAR=$EDUMAP_CRAWL_YEAR | Sleeping $sleep_time seconds until next cycle..." >&2
  sleep "$sleep_time"
done
