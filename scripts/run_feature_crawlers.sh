#!/bin/bash
# EduMap — nightly FEATURE crawlers (upsert, NO DROP SCHEMA, NEVER wipes user data).
# Scheduled at 00:00 via crawlers/crontab (container TZ = Asia/Ho_Chi_Minh).
# Each crawler is idempotent + degrades gracefully (a blocked source -> 0 rows,
# no crash). Run from inside the crawler container (WORKDIR=/app).
#
#   Override DB target when running from a developer host:
#   DB_HOST=localhost DB_PORT=5433 bash scripts/run_feature_crawlers.sh
set -u
cd "$(dirname "$0")/.."

# Load .env so DB_* / token vars are available to cron-spawned bash (cron wipes env).
set -a; . ./.env 2>/dev/null || . /app/.env 2>/dev/null; set +a

# Default to SQLite for HF Spaces (no PostgreSQL server). The .env or parent
# env may override this for local docker-compose (DB_TYPE=postgresql).
export DB_TYPE="${DB_TYPE:-sqlite}"
export DB_SQLITE_PATH="${DB_SQLITE_PATH:-/app/frontend/public/edumap.db}"

# Crawl year window — 2 consecutive years (e.g. EDUMAP_CRAWL_YEAR=2027 → [2026,2027]).
# Defaults to the current UTC year when unset.  All crawlers read this via crawl_scope.
export EDUMAP_CRAWL_YEAR="${EDUMAP_CRAWL_YEAR:-$(date -u +%Y)}"

CRAWLERS="jobs internships hackathons events community_posts social scholarships donations gamification"

for c in $CRAWLERS; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] run $c"
  python3 "crawlers/${c}_crawler.py" || echo "[$(date '+%H:%M')] $c FAILED (skipped, continue)"
done
echo "[$(date '+%Y-%m-%d %H:%M:%S')] feature crawlers done"
