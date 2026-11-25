#!/usr/bin/env bash
# Enrichment loop for Render: run the Overpass POI seed every
# CRAWL_INTERVAL_SECONDS (default 120 = 2 minutes). Intended for a Render
# Background Worker or a service-side wrapper; GitHub Actions cannot schedule
# anything more often than 5 minutes.
set -u
cd "$(dirname "$0")/.."

set -a; . ./.env 2>/dev/null || . /app/.env 2>/dev/null; set +a

export DB_TYPE="${DB_TYPE:-postgres}"
INTERVAL="${CRAWL_INTERVAL_SECONDS:-120}"
BBOX="${OVERPASS_BBOX:-10.75,106.60,11.20,107.20}"

echo "[overpass-loop] start interval=${INTERVAL}s bbox=${BBOX}"
while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] overpass_seed start"
  python3 crawlers/overpass_seed.py --bbox "$BBOX" \
    && echo "[$(date '+%H:%M:%S')] ok" \
    || echo "[$(date '+%H:%M:%S')] overpass_seed FAILED (continue)"
  sleep "$INTERVAL"
done
