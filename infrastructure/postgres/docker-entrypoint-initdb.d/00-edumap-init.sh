#!/usr/bin/env bash
# EduMap database bootstrap for a FRESH postgres volume.
# Runs automatically only on first container start for an empty data directory
# (standard docker-entrypoint-initdb.d contract). On a volume that already has
# data it is skipped — existing data is never wiped.
#
# SAFE (respects the "never DROP SCHEMA" constraint):
#   * 01-schema.sql  -> CREATE TABLE / INDEX / EXTENSION (no DROP)
#   * 02-seed.sql    -> base data (roles, users, categories, DNTU map points)
#   * 03-crawled.sql -> 3192 OSM locations (upsert-friendly snapshot)
# Order matters (schema before seed). No TRUNCATE/DELETE.
set -euo pipefail

if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_DB:-}" ]; then
  echo "[edumap-initdb] POSTGRES_USER/POSTGRES_DB not set — skipping." >&2
  exit 0
fi

PSQL=(psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB")

echo "[edumap-initdb] loading schema ..."
"${PSQL[@]}" -f /edumap-init/01-schema.sql

echo "[edumap-initdb] loading base seed ..."
"${PSQL[@]}" -f /edumap-init/02-seed.sql

if [ -f /edumap-init/03-crawled.sql ]; then
  echo "[edumap-initdb] loading crawled locations snapshot ..."
  "${PSQL[@]}" -f /edumap-init/03-crawled.sql
fi

echo "[edumap-initdb] schema + seed complete (fresh volume bootstrapped)."
