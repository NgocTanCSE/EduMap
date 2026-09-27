# Run the nationwide crawl + DB load once at container start (best-effort),
# then keep cron alive in the foreground for the nightly 00:00:00 schedule.
#!/usr/bin/env bash
set -u

echo "[scheduler] $(date -Iseconds) starting EduMap crawler container"

# Optional immediate refresh on boot (don't fail the container if DB isn't up yet).
if [ "${EDUMAP_CRAWLER_BOOT_RUN:-0}" = "1" ]; then
  echo "[scheduler] boot-time crawl run..."
  bash /app/scripts/run_crawl_pipeline.sh || echo "[scheduler] boot run failed (will retry at next scheduled time)."
fi

echo "[scheduler] cron schedule (daily 00:00:00):"
cat /etc/cron.d/edumap-crawler

# Run cron in foreground.
exec cron -f
