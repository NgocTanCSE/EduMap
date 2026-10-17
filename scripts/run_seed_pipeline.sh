#!/usr/bin/env bash
# =============================================================================
# EduMap — Seed Data Pipeline (HF Spaces compatible)
#
# Since HF Spaces free tier has NO terminal access, all seed data must be
# baked into the Docker image. This script regenerates the SQLite database
# from PostgreSQL (when available) or uses the pre-built edumap.db.
#
# Optionally runs the job crawler to populate the `jobs` table
# (only when network is available at runtime — not during Docker build).
#
# Usage:
#   scripts/run_seed_pipeline.sh              # SQLite mode, uses pre-built DB
#   DB_TYPE=postgres DB_HOST=... scripts/run_seed_pipeline.sh  # PostgreSQL mode
#   CRAWL_ON_START=true scripts/run_seed_pipeline.sh  # Also run job crawler
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQLITE_DB="$PROJECT_ROOT/frontend/public/edumap.db"
SQLITE_PATH="${DB_SQLITE_PATH:-$SQLITE_DB}"

echo "[seed] $(date -Iseconds) Starting seed pipeline"
echo "[seed] Mode: ${DB_TYPE:-sqlite}"

# Always ensure the output directory exists
mkdir -p "$(dirname "$SQLITE_DB")"

if [ "${DB_TYPE:-sqlite}" = "postgres" ] && [ -n "${DB_HOST:-}" ]; then
  echo "[seed] PostgreSQL mode — running migration from $DB_HOST"
  python3 "$SCRIPT_DIR/migrate-pg-to-sqlite.py" \
    --pg-host "$DB_HOST" \
    --pg-port "${DB_PORT:-5433}" \
    --pg-db "${DB_DATABASE:-edumap_db}" \
    --pg-user "${DB_USERNAME:-edumap}" \
    --pg-password "${DB_PASSWORD:-}" \
    --output "$SQLITE_PATH"
else
  echo "[seed] SQLite mode — checking for existing DB"
  if [ -f "$SQLITE_DB" ]; then
    echo "[seed] Pre-built SQLite DB found at $SQLITE_DB ($(du -h "$SQLITE_DB" | cut -f1))"
  else
    echo "[seed] ERROR: No SQLite DB found and no PostgreSQL available!"
    echo "[seed] Please run: python3 scripts/migrate-pg-to-sqlite.py --pg-host <host> ..."
    exit 1
  fi
fi

# Optionally run job crawler (network required — safe to fail at runtime)
if [ "${CRAWL_ON_START:-false}" = "true" ] && [ -f "$SCRIPT_DIR/crawl_jobs.py" ]; then
  echo "[seed] Running job crawler..."
  python3 "$SCRIPT_DIR/crawl_jobs.py" --db "$SQLITE_DB" 2>&1 || \
    echo "[seed] WARN: Job crawler failed (network issue?) — continuing with existing data"
else
  echo "[seed] Skipping job crawler (set CRAWL_ON_START=true to enable)"
fi

echo "[seed] Verifying SQLite DB..."
TABLE_COUNT=$(sqlite3 "$SQLITE_DB" ".tables" 2>/dev/null | wc -w || echo "0")
JOBS_COUNT=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM jobs WHERE status='active';" 2>/dev/null || echo "0")
echo "[seed] SQLite DB has $TABLE_COUNT tables, $JOBS_COUNT active jobs at $SQLITE_DB"
echo "[seed] $(date -Iseconds) Seed pipeline complete"
