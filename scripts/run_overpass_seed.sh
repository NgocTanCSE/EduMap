#!/bin/bash
# EduMap — nightly Tavily POI upsert (markets/schools/greens/wifi...).
# SAFE: crawl_pois_vietnam.py upserts (dedup via name+coords). NEVER drops schema
# or wipes user rows. Run from inside the crawler container (WORKDIR=/app).
#
# Uses Tavily AI Search (TAVILY_API_KEY set as HF Spaces Secret) — Overpass API
# is blocked on HF Spaces egress. When TAVILY_API_KEY is absent, the script
# degrades to 0 rows (graceful); curated snapshots fill Đồng Nai coverage.
#
# Optional overrides (via env in .env or `docker compose run -e`):
#   CRAWL_BBOX="10.85 106.70 11.05 106.92"   # limit to a region (default = full Vietnam)
#   CRAWL_DRY_RUN=1                           # summary only, no DB writes
set -u
cd "$(dirname "$0")/.."

# Load .env so DB_* / token vars are available (cron-spawned bash wipes env).
set -a; . ./.env 2>/dev/null || . /app/.env 2>/dev/null; set +a

# Default to SQLite for HF Spaces (no PostgreSQL server available).
export DB_TYPE="${DB_TYPE:-sqlite}"
export DB_SQLITE_PATH="${DB_SQLITE_PATH:-/app/frontend/public/edumap.db}"

# Crawl year window — 2 consecutive years (e.g. EDUMAP_CRAWL_YEAR=2027 → [2026,2027]).
# Defaults to the current UTC year when unset.  crawl_pois_vietnam.py reads this
# via crawl_scope and walks the location expansion (Đồng Nai → miền Nam → VN).
export EDUMAP_CRAWL_YEAR="${EDUMAP_CRAWL_YEAR:-$(date -u +%Y)}"

ARGS=()
if [ -n "${CRAWL_BBOX:-}" ]; then ARGS+=(--bbox $CRAWL_BBOX); fi
if [ "${CRAWL_DRY_RUN:-0}" = "1" ]; then ARGS+=(--dry-run); fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tavily POI upsert start (bbox=${CRAWL_BBOX:-full-VN})"
exec python3 scripts/crawl_pois_vietnam.py "${ARGS[@]}"
