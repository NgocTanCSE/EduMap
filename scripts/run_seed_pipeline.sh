#!/usr/bin/env bash
# =============================================================================
# EduMap — Seed Data Pipeline (HF Spaces compatible)
#
# Since HF Spaces free tier has NO terminal access, all seed data must be
# baked into the Docker image. This script regenerates the SQLite database
# from PostgreSQL (when available) or from existing SQL seed files,
# then copies it into frontend/public/.
#
# Usage:
#   scripts/run_seed_pipeline.sh          # uses PostgreSQL (local only)
#   scripts/run_seed_pipeline.sh --local  # uses local SQLite seed (no PG needed)
#
# In CI/CD or Docker build, this runs automatically if PostgreSQL is available.
# Otherwise, the pre-built frontend/public/edumap.db is used.
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
    --host "$DB_HOST" \
    --port "${DB_PORT:-5432}" \
    --database "${DB_DATABASE:-edumap_db}" \
    --user "${DB_USERNAME:-edumap}" \
    --password "${DB_PASSWORD:-}" \
    --output "$SQLITE_PATH"
else
  echo "[seed] SQLite mode — checking for existing DB"
  if [ -f "$SQLITE_DB" ]; then
    echo "[seed] Pre-built SQLite DB found at $SQLITE_DB ($(du -h "$SQLITE_DB" | cut -f1))"
  else
    echo "[seed] No SQLite DB found — creating from seed.sql"
    python3 "$SCRIPT_DIR/migrate-pg-to-sqlite.py" --local --seed "$PROJECT_ROOT/backend/src/database/seed.sql" --output "$SQLITE_PATH"
  fi
fi

echo "[seed] Verifying SQLite DB..."
TABLE_COUNT=$(sqlite3 "$SQLITE_DB" ".tables" 2>/dev/null | wc -w || echo "0")
echo "[seed] SQLite DB has $TABLE_COUNT tables at $SQLITE_DB"
echo "[seed] $(date -Iseconds) Seed pipeline complete"
