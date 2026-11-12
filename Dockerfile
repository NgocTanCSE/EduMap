
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm ci --legacy-peer-deps --no-audit --no-fund --jobs=1
COPY frontend/ ./
RUN rm -f .env.local
ENV BACKEND_URL=http://127.0.0.1:3000
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build

FROM node:20-slim AS frontend-deps
WORKDIR /app
COPY frontend/package*.json ./
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund --jobs=1

# Marker stage: only `backend/package*.json`, consumed by `osrm-builder` as a
# cache-busting signal (it needs *something* from the backend tree).
FROM node:20-slim AS backend-marker
WORKDIR /app
COPY backend/package*.json ./

# ---------------------------------------------------------------------------
# Rust backend (axum/sqlx) — replaces `npx nest build`.
# Cross-compiled to a static musl binary so the runtime image needs no libpq
# and no glibc version match. sqlx's postgres driver is pure Rust (tls-rustls).
# ---------------------------------------------------------------------------
FROM rust:1.81-slim AS backend-builder
WORKDIR /app/backend

RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends ca-certificates musl-tools && \
    rm -rf /var/lib/apt/lists/*

RUN rustup target add x86_64-unknown-linux-musl

COPY backend/Cargo.toml ./
COPY backend/Cargo.lock ./ 2>/dev/null || true
RUN cargo fetch --target x86_64-unknown-linux-musl

COPY backend/src ./src
RUN CARGO_BUILD_JOBS=2 cargo build --release --target x86_64-unknown-linux-musl

FROM python:3.11-slim AS ai-deps
WORKDIR /app
COPY ai-service/requirements.txt ./
ENV PIP_NUM_THREADS=1

RUN pip install --no-cache-dir filelock typing-extensions sympy networkx jinja2 fsspec mpmath MarkupSafe && \
    echo "[ai-deps] torch deps installed"

COPY --from=frontend-builder /app/package.json /tmp/frontend-build-done

RUN ( \
    (fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 2>/dev/null) && \
    chmod 600 /swapfile && \
    (mkswap /swapfile 2>/dev/null && swapon /swapfile 2>/dev/null || echo "[ai-deps] swap unavailable") \
  ) || true ; \
    pip install --no-cache-dir --no-deps torch --index-url https://download.pytorch.org/whl/cpu && \
    (swapoff /swapfile 2>/dev/null || true) && rm -f /swapfile && \
    echo "[ai-deps] torch installed"

RUN pip install --no-cache-dir fastapi uvicorn pydantic python-dotenv requests python-multipart && \
    pip install --no-cache-dir psycopg2-binary pandas numpy==1.26.4 pypdf redis && \
    pip install --no-cache-dir posthog httpx tqdm Pillow gTTS && \
    pip install --no-cache-dir edge-tts && \
    echo "[ai-deps] core + ML + TTS packages installed"

RUN pip install --no-cache-dir kubernetes onnxruntime mmh3 click graphene grpcio pybase64 pypika schema brotli datasketch deprecated overrides tenacity opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp opentelemetry-exporter-otlp-proto-grpc opentelemetry-exporter-otlp-proto-http && \
    pip install --no-cache-dir --no-deps "chromadb>=0.4.0,<0.6.0" && \
    echo "[ai-deps] chromadb + deps installed"

FROM python:3.11-slim AS elevation-builder
WORKDIR /data
RUN pip install --no-cache-dir rasterio numpy
RUN wget -O /tmp/srtm_vn.tif \
    "https://s3.amazonaws.com/earthdata-download-all/n57w095.SRTMGL1.hgt.tar" 2>/dev/null || \
    echo "[elevation-builder] SRTM download fallback — will retry at runtime"
COPY scripts/convert_srtm_to_npy.py /tmp/convert_srtm_to_npy.py
RUN python3 /tmp/convert_srtm_to_npy.py /tmp/srtm_vn.tif /data/srtm_vn.npy 2>/dev/null || \
    python3 -c "import numpy as np; np.save('/data/srtm_vn.npy', np.zeros((1500,1400), dtype=np.float32))" && \
    echo "[elevation-builder] SRTM .npy created (or zero-padded placeholder)"

FROM debian:bookworm-slim AS osm-downloader
WORKDIR /data
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends wget ca-certificates osmium-tool && \
    rm -rf /var/lib/apt/lists/*
ARG OSM_CACHEBUST=20261030
RUN wget -O /data/vietnam.osm.pbf \
    https://download.geofabrik.de/asia/vietnam-latest.osm.pbf
RUN osmium tags-filter /data/vietnam.osm.pbf \
    'w/highway=motorway,trunk,primary,secondary,tertiary,unclassified,primary_link,secondary_link,tertiary_link,trunk_link,traffic_signals,mini_roundabout' \
    'n/barrier' \
    -o /data/vietnam-filtered.osm.pbf && \
    mv /data/vietnam-filtered.osm.pbf /data/vietnam.osm.pbf && \
    echo "[osm-downloader] Filtered to major roads (no residential/service/path) — ready for osrm-extract"

FROM osrm/osrm-backend:v5.25.0 AS osrm-builder
WORKDIR /data
COPY --from=ai-deps /app/requirements.txt /tmp/ai-deps-complete
COPY --from=backend-marker /app/package.json /tmp/backend-build-complete
COPY --from=osm-downloader /data/vietnam.osm.pbf /data/vietnam.osm.pbf
ENV OSRM_PROFILE=car
RUN osrm-extract -p /opt/car.lua /data/vietnam.osm.pbf
RUN ( \
    (fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 2>/dev/null) && \
    chmod 600 /swapfile && \
    (mkswap /swapfile 2>/dev/null && swapon /swapfile 2>/dev/null || echo "[osrm-builder] swap unavailable — proceeding without") \
  ) || true ; \
    osrm-contract /data/vietnam.osm.pbf && \
    (swapoff /swapfile 2>/dev/null || true) && \
    rm -f /swapfile && \
    echo "[osrm-builder] CH contraction complete"
RUN mkdir -p /osrm-bin /osrm-libs && cp "$(command -v osrm-routed)" /osrm-bin/
RUN ldd "$(command -v osrm-routed)" | grep "=>" | awk '{print $3}' | grep '^/' | \
    while read lib; do \
        cp -L "$lib" /osrm-libs/ 2>/dev/null; \
        ldd "$lib" 2>/dev/null | grep "=>" | awk '{print $3}' | grep '^/' | \
        while read sublib; do cp -L "$sublib" /osrm-libs/ 2>/dev/null; done; \
    done && \
    echo "[osrm-builder] collected $(ls /osrm-libs/ | wc -l) shared libs for osrm-routed" || \
    echo "[osrm-builder] shared lib collection failed — will rely on apt-installed libs"

FROM node:20-slim AS runtime
WORKDIR /app

RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
      python3 python3-pip supervisor curl ca-certificates cron \
      libprotobuf32 libtbb12 libgomp1 libatomic1 \
      libboost-filesystem1.74.0 libboost-iostreams1.74.0 \
      libboost-system1.74.0 libboost-thread1.74.0 \
      libboost-program-options1.74.0 \
      zlib1g libbz2-1.0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY scripts/ /app/scripts/
COPY crawlers/ /app/crawlers/
COPY crawlers/crontab /etc/cron.d/edumap-crawlers
RUN chmod +x /app/scripts/*.sh /app/scripts/*.py && \
    chmod 0644 /etc/cron.d/edumap-crawlers && \
    crontab /etc/cron.d/edumap-crawlers


WORKDIR /app/backend
COPY --from=backend-builder /app/backend/target/x86_64-unknown-linux-musl/release/edumap-backend ./edumap-backend
RUN chmod +x /app/backend/edumap-backend

WORKDIR /app/ai-service
COPY --from=ai-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=ai-deps /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY ai-service/ ./
RUN touch services/__init__.py routers/__init__.py && \
    rm -f /usr/local/bin/python /usr/local/bin/python3 /usr/local/bin/python3.11 \
          /usr/local/bin/uvicorn /usr/local/bin/uvicorn3 \
          /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.11 \
          /usr/local/bin/chardetect 2>/dev/null; \
    ldconfig

WORKDIR /app
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN mkdir -p /app/uploads /app/data /app/ai-service/models \
    /app/uploads/offline-models /app/osrm-data

COPY --from=osrm-builder /data/ /app/osrm-data/
COPY --from=osrm-builder /osrm-bin /usr/local/bin/
COPY --from=osrm-builder /osrm-libs /tmp/osrm-libs
RUN mkdir -p /usr/local/osrm-lib && \
    cp /tmp/osrm-libs/* /usr/local/osrm-lib/ 2>/dev/null || true; \
    rm -f /usr/local/osrm-lib/libc.so.6 /usr/local/osrm-lib/libm.so.6 \
        /usr/local/osrm-lib/libpthread.so.0 /usr/local/osrm-lib/libdl.so.2 \
        /usr/local/osrm-lib/librt.so.1 /usr/local/osrm-lib/ld-linux-*.so* \
        /usr/local/osrm-lib/libc-*.so \
        /usr/local/osrm-lib/libstdc++.so.6 /usr/local/osrm-lib/libstdc++fs-*.so \
        /usr/local/osrm-lib/libgcc_s.so.1 /usr/local/osrm-lib/libatomic.so.1 \
        /usr/local/osrm-lib/libgomp.so.1 \
        /usr/local/osrm-lib/libprotobuf.so* /usr/local/osrm-lib/libprotoc.so* \
        /usr/local/osrm-lib/libz.so* /usr/local/osrm-lib/libzstd.so* \
        /usr/local/osrm-lib/libbz2.so* \
        2>/dev/null; \
    if [ ! -f /usr/local/osrm-lib/libboost_program_options.so.1.62.0 ] && \
       [ -f /usr/lib/x86_64-linux-gnu/libboost_program_options.so.1.74.0 ]; then \
      ln -sf /usr/lib/x86_64-linux-gnu/libboost_program_options.so.1.74.0 \
             /usr/local/osrm-lib/libboost_program_options.so.1.62.0 && \
      echo "[runtime] symlinked boost_program_options 1.62 -> 1.74 for osrm-routed"; \
    fi; \
    rm -rf /tmp/osrm-libs; \
    echo "/usr/local/osrm-lib" > /etc/ld.so.conf.d/99-osrm-lib.conf && \
    ldconfig
COPY --from=elevation-builder /data/srtm_vn.npy /app/ai-service/models/elevation/srtm_vn.npy

ARG CACHEBUST=20261030_osrm-boost-chroma-fix

ENV NODE_ENV=production
ENV DB_TYPE=postgres
ENV DB_SYNC=false
ENV ENABLE_DEV_LOGIN=true
ENV PORT=3000
ENV BACKEND_URL=http://127.0.0.1:3000
ENV AI_SERVICE_URL=http://127.0.0.1:8000
ENV AI_SERVICE_TIMEOUT=45
ENV OFFLINE_TUTOR_USE_LLM=true
# Rust đọc `ROUTING_SERVICE_URL` (OSRM/ORS). `OSRM_URL` là tên cũ của NestJS,
# giữ lại cho script crawler cũ.
ENV ROUTING_SERVICE_URL=http://127.0.0.1:5000
ENV OSRM_URL=http://127.0.0.1:5000
ENV BACKEND_PORT=3000
ENV OSRM_HOST=127.0.0.1
ENV OSRM_PORT=5000
ENV REDIS_HOST=127.0.0.1
ENV STORAGE_DIR=/app/uploads
ENV CLOUDFLARE_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8,@cf/google/gemma-7b-it-lora,@cf/mistralai/mistral-small-3.1-24b-instruct
ENV GEMINI_MODEL=gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-flash-latest
ENV GEMINI_EMBEDDING_MODEL=gemini-embedding-001
ENV ANONYMIZED_TELEMETRY=False
ENV LOCAL_LLM_ENABLED=false
ENV BING_MAPS_API_KEY=""
ENV EMBED_GLOBAL_TIMEOUT_SECONDS=6
ENV EMBED_PROVIDER_TIMEOUT_SECONDS=4
ENV RAG_TIMEOUT_SECONDS=8
ENV GEN_TIMEOUT_SECONDS=8
ENV CHROMA_DB_PATH=/tmp/chroma_db
ENV CHROMA_INIT_TIMEOUT_SECONDS=60
ENV CHROMA_RETRY_SECONDS=30
ENV PYTHONPATH=/usr/local/lib/python3.11/site-packages
ENV PYTHONUNBUFFERED=1
ENV CF_AI_GATEWAY_ID=""
ENV CF_AI_GATEWAY_ENABLED="false"
ENV TAVILY_API_KEY=""
ENV TAVILY_TIMEOUT_SECONDS=25
ENV TAVILY_MAX_RESULTS=8
ENV TAVILY_CIRCUIT_BREAKER_FAILURES=5
ENV TAVILY_CIRCUIT_BREAKER_TTL=300

EXPOSE 3000
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
