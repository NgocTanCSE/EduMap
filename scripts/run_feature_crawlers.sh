#!/bin/bash







set -u
cd "$(dirname "$0")/.."


set -a; . ./.env 2>/dev/null || . /app/.env 2>/dev/null; set +a



export DB_TYPE="${DB_TYPE:-sqlite}"
export DB_SQLITE_PATH="${DB_SQLITE_PATH:-/app/data/edumap.db}"



export EDUMAP_CRAWL_YEAR="${EDUMAP_CRAWL_YEAR:-$(date -u +%Y)}"

CRAWLERS="jobs internships hackathons events community_posts social scholarships donations gamification"

for c in $CRAWLERS; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] run $c"
  python3 "crawlers/${c}_crawler.py" || echo "[$(date '+%H:%M')] $c FAILED (skipped, continue)"
done
echo "[$(date '+%Y-%m-%d %H:%M:%S')] feature crawlers done"
