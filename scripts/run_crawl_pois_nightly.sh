#!/bin/bash
# Nightly countrywide POI crawler (chợ + Bách hóa Xanh / convenience stores).
# Sleeps until 00:30 local time, runs one crawl, then loops for the next night.

set -euo pipefail

echo "[crawl-pois] Nightly POI crawler scheduler started at $(date '+%Y-%m-%d %H:%M:%S')"

while true; do
    target=$(date -d "tomorrow 00:30:00" +%s 2>/dev/null || date -v+1d -v0030 +%s 2>/dev/null || echo 0)
    now=$(date +%s)

    if [ "$target" -gt "$now" ]; then
        wait_seconds=$((target - now))
        echo "[crawl-pois] Waiting ${wait_seconds}s until next scheduled crawl at tomorrow 00:30:00..."
        sleep "$wait_seconds"
    fi

    echo "[crawl-pois] Starting POI crawl run at $(date '+%Y-%m-%d %H:%M:%S')..."
    if python3 /app/scripts/crawl_pois_vietnam.py >> /data/crawl_pois.log 2>&1; then
        echo "[crawl-pois] POI crawl completed successfully at $(date '+%Y-%m-%d %H:%M:%S')"
    else
        echo "[crawl-pois] POI crawl finished with non-zero exit status at $(date '+%Y-%m-%d %H:%M:%S')"
    fi

    # Sleep 60 seconds to ensure target calculation moves to the next day
    sleep 60
done
