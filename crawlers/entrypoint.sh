#!/usr/bin/env bash
# EduMap crawler container entry point.
# Starts cron (foreground) which runs:
#   - nightly 00:00 upsert feature crawlers (run_feature_crawlers.sh) — SAFE, no wipe
#   - optional full-refresh (run_crawl_pipeline.sh, DROPs schema) ONLY if
#     EDUMAP_FULL_REFRESH=1 is set explicitly (off by default).
set -u

echo "[scheduler] $(date -Iseconds) starting EduMap crawler container"

# Optional immediate refresh on boot (best-effort). Gated behind EDUMAP_FULL_REFRESH
# so a default container start NEVER wipes user data — the nightly upsert feature
# crawlers (run_feature_crawlers.sh) are the always-on 00:00 schedule.
if [ "${EDUMAP_CRAWLER_BOOT_RUN:-0}" = "1" ] && [ "${EDUMAP_FULL_REFRESH:-0}" = "1" ]; then
  echo "[scheduler] boot-time FULL refresh (EDUMAP_FULL_REFRESH=1)..."
  bash /app/scripts/run_crawl_pipeline.sh || echo "[scheduler] boot full-refresh failed (will retry at next scheduled time)."
elif [ "${EDUMAP_CRAWLER_BOOT_RUN:-0}" = "1" ]; then
  echo "[scheduler] boot-run: executing SAFE feature-crawler upsert (no schema wipe)."
  bash /app/scripts/run_feature_crawlers.sh || echo "[scheduler] boot feature-crawlers failed (will retry at next scheduled time)."
fi

echo "[scheduler] cron schedule (daily 00:00:00):"
# (Re)install crontab from the bind-mounted source so host edits to
# crawlers/crontab take effect at runtime without an image rebuild.
install -m 0644 /app/crawlers/crontab /etc/cron.d/edumap-crawler 2>/dev/null && crontab /etc/cron.d/edumap-crawler 2>/dev/null || true
cat /etc/cron.d/edumap-crawler

# Run cron in foreground.
exec cron -f
