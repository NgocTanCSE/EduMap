#!/bin/bash











set -u
cd "$(dirname "$0")/.."


set -a; . ./.env 2>/dev/null || . /app/.env 2>/dev/null; set +a


export DB_TYPE="${DB_TYPE:-sqlite}"
export DB_SQLITE_PATH="${DB_SQLITE_PATH:-/app/data/edumap.db}"




export EDUMAP_CRAWL_YEAR="${EDUMAP_CRAWL_YEAR:-$(date -u +%Y)}"

ARGS=()
if [ -n "${CRAWL_BBOX:-}" ]; then ARGS+=(--bbox $CRAWL_BBOX); fi
if [ "${CRAWL_DRY_RUN:-0}" = "1" ]; then ARGS+=(--dry-run); fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tavily POI upsert start (bbox=${CRAWL_BBOX:-full-VN})"
exec python3 scripts/crawl_pois_vietnam.py "${ARGS[@]}"
