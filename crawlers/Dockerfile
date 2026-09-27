# EduMap nightly crawler service.
# Builds a lightweight python:3.11 image with the deps the crawlers/DB-loader
# need, then runs a daily cron at 00:00:00 (UTC+07 handled by container tz).

FROM python:3.11-slim

# cron (scheduler) + libpq/gcc for psycopg2
RUN apt-get update && \
    apt-get install -y --no-install-recommends cron libpq-dev gcc ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Ho_Chi_Minh

WORKDIR /app

# Python deps used by crawler pipeline + DB loader (NOT the heavy ai-service ML stack).
RUN pip install --no-cache-dir \
      "requests>=2.28.0" \
      "psycopg2-binary" \
      "python-dotenv>=0.20.0"

# Crontab + entrypoint
COPY crawlers/crontab      /etc/cron.d/edumap-crawler
COPY crawlers/entrypoint.sh /entrypoint.sh
RUN chmod 0644 /etc/cron.d/edumap-crawler && \
    chmod +x /entrypoint.sh && \
    crontab /etc/cron.d/edumap-crawler

# Runtime entrypoint: best-effort first run, then cron -f (daily 00:00).
ENTRYPOINT ["/entrypoint.sh"]
