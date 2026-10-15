#!/bin/bash
# EduMap — nightly Overpass POI upsert (schools / labs / greens / restaurants...).
# SAFE: crawl_pois_vietnam.py upserts (dedup via EXISTS guard). NEVER drops schema
# or wipes user rows. Run from inside the crawler container (WORKDIR=/app).
#
# Optional overrides (via env in .env or `docker compose run -e`):
#   CRAWL_BBOX="10.85 106.70 11.05 106.92"   # limit to a region (default = full Vietnam)
#   CRAWL_TILE=0.5                            # tile step (degrees)
#   CRAWL_SLEEP=0.8                           # delay between Overpass requests
set -u
cd "$(dirname "$0")/.."

# Load .env so DB_* / token vars are available (cron-spawned bash wipes env).
set -a; . ./.env 2>/dev/null || . /app/.env 2>/dev/null; set +a

ARGS=()
if [ -n "${CRAWL_BBOX:-}" ]; then ARGS+=(--bbox $CRAWL_BBOX); fi
if [ -n "${CRAWL_TILE:-}" ];  then ARGS+=(--tile "$CRAWL_TILE"); fi
if [ -n "${CRAWL_SLEEP:-}" ]; then ARGS+=(--sleep "$CRAWL_SLEEP"); fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] overpass POI upsert start (bbox=${CRAWL_BBOX:-full-VN})"
exec python3 scripts/crawl_pois_vietnam.py "${ARGS[@]}"
