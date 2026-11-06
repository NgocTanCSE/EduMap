#!/usr/bin/env bash





set -u

echo "[scheduler] $(date -Iseconds) starting EduMap crawler container"




if [ "${EDUMAP_CRAWLER_BOOT_RUN:-0}" = "1" ] && [ "${EDUMAP_FULL_REFRESH:-0}" = "1" ]; then
  echo "[scheduler] boot-time FULL refresh (EDUMAP_FULL_REFRESH=1)..."
  bash /app/scripts/run_crawl_pipeline.sh || echo "[scheduler] boot full-refresh failed (will retry at next scheduled time)."
elif [ "${EDUMAP_CRAWLER_BOOT_RUN:-0}" = "1" ]; then
  echo "[scheduler] boot-run: executing SAFE feature-crawler upsert (no schema wipe)."
  bash /app/scripts/run_feature_crawlers.sh || echo "[scheduler] boot feature-crawlers failed (will retry at next scheduled time)."
fi

echo "[scheduler] cron schedule (daily 00:00:00):"


install -m 0644 /app/crawlers/crontab /etc/cron.d/edumap-crawler 2>/dev/null && crontab /etc/cron.d/edumap-crawler 2>/dev/null || true
cat /etc/cron.d/edumap-crawler


exec cron -f
