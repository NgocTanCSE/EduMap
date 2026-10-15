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

CRAWLERS="jobs internships hackathons events community_posts social scholarships donations gamification"

for c in $CRAWLERS; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] run $c"
  python3 "crawlers/${c}_crawler.py" || echo "[$(date '+%H:%M')] $c FAILED (skipped, continue)"
done
echo "[$(date '+%Y-%m-%d %H:%M:%S')] feature crawlers done"
