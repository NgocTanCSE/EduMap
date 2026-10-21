#!/usr/bin/env bash
# CA01: CI wrapper — run DB drift detection (schema.sql ↔ TypeORM entities).
# Exits 0 (no drift) or 1 (drift detected).
# Usage:  ./scripts/check-db-drift.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PYTHON="${PYTHON:-python3}"

echo "Running CA01 DB drift check (schema.sql ↔ entities)..."
export DRIFT_SCHEMA="$BACKEND_DIR/src/database/schema.sql"
export DRIFT_ENTITIES_DIR="$BACKEND_DIR/src/modules"
export DRIFT_MIGRATIONS_DIR="$BACKEND_DIR/src/database/migrations"
# Optional: comma-separated table names to ignore (e.g. legacy tables w/o entities).
# export DRIFT_IGNORE_TABLES="ai_conversations,alumni_networks,bookmarks"
"$PYTHON" "$SCRIPT_DIR/check-db-drift.py"
