#!/usr/bin/env bash














set -euo pipefail

APP_DIR="${APP_DIR:-/app}"
cd "$APP_DIR"


if [ -f "$APP_DIR/.env" ]; then
  set -a; . "$APP_DIR/.env"; set +a
fi

echo "[crawl] $(date -Iseconds) START nationwide aggregation"


cd "$APP_DIR/crawlers"
python3 aggregator.py


cd "$APP_DIR"
rm -f seed_crawled_data*.sql

CONSOLIDATED=$(ls crawlers/crawled_data/consolidated_crawled_data_*.sql 2>/dev/null || true)
if [ -z "$CONSOLIDATED" ]; then
  echo "[crawl] WARNING: aggregator produced no consolidated SQL; skipping DB load."
  exit 0
fi
cat $CONSOLIDATED > seed_crawled_data.sql
echo "[crawl] staged seed_crawled_data.sql ($(wc -l < seed_crawled_data.sql) lines)"




python3 scripts/execute_db_setup.py


if [ -f "$APP_DIR/ai-service/seed_vector_db.py" ]; then
  ( cd "$APP_DIR/ai-service" && python3 seed_vector_db.py ) \
    && echo "[crawl] vector DB refreshed." \
    || echo "[crawl] vector refresh skipped (optional; needs GEMINI_API_KEY + chromadb)."
fi

echo "[crawl] $(date -Iseconds) DONE — DB now contains real crawled data."
