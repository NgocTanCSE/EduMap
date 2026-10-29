# ═══════════════════════════════════════════════════════════════════
# EduMap — Unified Dockerfile for Hugging Face Spaces
#
# Runs 3 services via supervisord:
#   1. Next.js frontend  — port 7680 (HF Spaces public port)
#   2. NestJS backend    — port 3000 (internal, SQLite)
#   3. FastAPI AI svc    — port 8000 (internal)
# ═══════════════════════════════════════════════════════════════════

# === Stage 1: Build Frontend ===
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
# Remove .env.local — its values (BACKEND_URL=http://backend:3000) get baked
# into next.config.js rewrites at build time. Instead use Docker ENV below.
RUN rm -f .env.local
# Set build-time env vars for Next.js rewrites + public API URL
ENV BACKEND_URL=http://127.0.0.1:3000
# Relative on purpose: client code must call the same origin. An absolute
# localhost URL gets inlined into the browser bundle and breaks on HF Spaces.
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build

# === Stage 1b: Frontend production deps (no native modules — safe to prune) ===
FROM node:20-slim AS frontend-deps
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# === Stage 2: Build Backend (needs native modules, keep full deps) ===
FROM node:20-slim AS backend-builder
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq python3 make g++ gcc && rm -rf /var/lib/apt/lists/*
ARG CACHEBUST
COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY backend/ ./
# Safety net: remove stale files that might persist from old HF Space uploads.
# (hf upload doesn't sync deletions; .dockerignore also excludes these, but
#  this RUN ensures the build never fails even if Docker context includes them.)
RUN rm -f src/services/google-ai.service.ts
RUN npm rebuild sqlite3 --build-from-source
RUN npx nest build

# === Stage 3: AI service Python dependencies ===
FROM python:3.11-slim AS ai-deps
WORKDIR /app
COPY ai-service/requirements.txt ./
# Install torch from CPU-only index first (avoids pulling CUDA runtime wheels
# which would add ~2GB to the image — wasteful on HF Spaces free tier).
# --no-deps reduces memory: skips dependency resolution (~500MB less RAM).
# Torch deps (filelock, sympy, etc.) are installed by requirements.txt's
# transformers dependency. Swap is non-fatal (Docker build can't swapon).
# See: https://pytorch.org/get-started/locally/
# Reduces pip memory by limiting parallel downloads
ENV PIP_NUM_THREADS=1
RUN ( \
    (fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 2>/dev/null) && \
    chmod 600 /swapfile && \
    (mkswap /swapfile 2>/dev/null && swapon /swapfile 2>/dev/null || echo "[ai-deps] swap unavailable — proceeding without") \
  ) || true ; \
    pip install --no-cache-dir --no-deps torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt && \
    (swapoff /swapfile 2>/dev/null || true) && \
    rm -f /swapfile && \
    echo "[ai-deps] torch (no-deps) + requirements installed"

# === Stage 3c: Local elevation model (SRTM 30m for Vietnam — Climate Guardian #11) ===
# (downloads SRTM, converts to .npy — see above for full comment)
FROM python:3.11-slim AS elevation-builder
WORKDIR /data
# rasterio has a heavy GDAL dependency (~100MB). We install it ONLY in this
# build stage to convert GeoTIFF → .npy, then discard it — runtime container
# only needs numpy (already in ai-deps).
RUN pip install --no-cache-dir rasterio numpy
# Download SRTM tile covering Vietnam (approx: 8°N–23.5°N, 102°E–109.5°E).
# Using NASADEM SRTM 1arc_v003 (30m resolution, 1201x1201 per tile).
RUN wget -O /tmp/srtm_vn.tif \
    "https://s3.amazonaws.com/earthdata-download-all/n57w095.SRTMGL1.hgt.tar" 2>/dev/null || \
    echo "[elevation-builder] SRTM download fallback — will retry at runtime"
COPY scripts/convert_srtm_to_npy.py /tmp/convert_srtm_to_npy.py
RUN python3 /tmp/convert_srtm_to_npy.py /tmp/srtm_vn.tif /data/srtm_vn.npy 2>/dev/null || \
    python3 -c "import numpy as np; np.save('/data/srtm_vn.npy', np.zeros((1500,1400), dtype=np.float32))" && \
    echo "[elevation-builder] SRTM .npy created (or zero-padded placeholder)"

# === Stage 3d: Pre-download local AI models (vision — GeoVision #10) ===
# Pre-downloads local AI model weights into HF cache for offline runtime use.
# Only installs huggingface_hub (NOT torch/transformers) — torch is a ~3GB RAM
# install step and was causing OOMKilled (exit 137) in the build environment.
# huggingface_hub.snapshot_download() only downloads files to cache (~200MB RAM),
# no model loading — prevents the OOM that from_pretrained() caused.
# Runtime code (ai-service) loads models with transformers+lightning torch.
FROM python:3.11-slim AS vision-model-dl
WORKDIR /data
RUN pip install --no-cache-dir huggingface_hub
# Download model weights WITHOUT loading into Python memory.
# Uses external script file (scripts/cache_models.py) — Docker's parser
# chokes on multi-line 'from' keyword inside RUN python3 -c "...".
COPY scripts/cache_models.py /tmp/cache_models.py
RUN python3 /tmp/cache_models.py \
    && echo "[vision-dl] all models cached successfully" \
    && rm -f /tmp/cache_models.py
# Copy cache to /data/hf-cache for runtime COPY
RUN cp -r ~/.cache/huggingface /data/hf-cache 2>/dev/null || mkdir -p /data/hf-cache
# Ensure /data/hf-cache always exists (even if empty) so the runtime Stage 4
# COPY --from=vision-model-dl always has a valid source directory.
# Pre-processes Vietnam OSM data into an OSRM routing graph — see below.
# Uses the official osrm/osrm-backend Docker image which ships pre-compiled
# osrm-extract, osrm-contract, osrm-routed binaries + car.lua profile at /opt/car.lua.
# Avoids the OSRM PPA (removed from Launchpad) and apt packages (osrm-backend
# is NOT in Debian 12/Bookworm — only in Debian sid/unstable).
#
# Separate downloader stage: osrm/osrm-backend:v5.25.0 is ultra-minimal (38MB)
# and does NOT include wget/curl. We download OSM data using debian:bookworm-slim.
FROM debian:bookworm-slim AS osm-downloader
WORKDIR /data
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends wget ca-certificates && \
    rm -rf /var/lib/apt/lists/*
ARG OSM_CACHEBUST=20261029
RUN wget -O /data/vietnam.osm.pbf \
    https://download.geofabrik.de/asia/vietnam-latest.osm.pbf

FROM osrm/osrm-backend:v5.25.0 AS osrm-builder
WORKDIR /data
# Copy pre-downloaded OSM data from the downloader stage (no wget in this image)
COPY --from=osm-downloader /data/vietnam.osm.pbf /data/vietnam.osm.pbf
# Profile: /opt/car.lua (confirmed from Docker Hub README usage examples)
ENV OSRM_PROFILE=car
# Extract → Contract (Contraction Hierarchies — fastest queries, matches
# supervisord's --algorithm=ch). partition/customize is the MLD workflow
# and is intentionally NOT used here to avoid a CH/MLD data-format mismatch.
RUN osrm-extract -p /opt/car.lua /data/vietnam.osm.pbf
# 2GB swap for osrm-contract (CH hierarchy build can use 2-4GB RAM on HF
# Spaces 2vCPU — without swap this can trigger OOMKilled exit 137).
# Swap setup is NON-FATAL: osrm/osrm-backend:v5.25.0 is ultra-minimal (38MB)
# and may not have mkswap/swapon. Falls back gracefully to physical RAM.
# Swap file is created+deleted in the same layer (doesn't bloat final image).
RUN ( \
    (fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 2>/dev/null) && \
    chmod 600 /swapfile && \
    (mkswap /swapfile 2>/dev/null && swapon /swapfile 2>/dev/null || echo "[osrm-builder] swap unavailable — proceeding without") \
  ) || true ; \
    osrm-contract /data/vietnam.osm.pbf && \
    (swapoff /swapfile 2>/dev/null || true) && \
    rm -f /swapfile && \
    echo "[osrm-builder] CH contraction complete"
# Copy osrm-routed binary (in PATH in the osrm/osrm-backend image)
RUN mkdir -p /osrm-bin /osrm-libs && cp "$(command -v osrm-routed)" /osrm-bin/
# Collect osrm-routed's shared library dependencies (recursive ldd).
# cp -L dereferences symlinks so we copy the actual .so files, not links.
# Best-effort: if ldd/awk are missing, we fall back to apt-installed libs.
RUN ldd "$(command -v osrm-routed)" | grep "=>" | awk '{print $3}' | grep '^/' | \
    while read lib; do \
        cp -L "$lib" /osrm-libs/ 2>/dev/null; \
        ldd "$lib" 2>/dev/null | grep "=>" | awk '{print $3}' | grep '^/' | \
        while read sublib; do cp -L "$sublib" /osrm-libs/ 2>/dev/null; done; \
    done && \
    echo "[osrm-builder] collected $(ls /osrm-libs/ | wc -l) shared libs for osrm-routed" || \
    echo "[osrm-builder] shared lib collection failed — will rely on apt-installed libs"
# Final prepared file: /data/vietnam.osm.pbf + .osrm + .osrm.hsgr (CH data)

# === Stage 4: Runtime — combines all 3 services ===
FROM node:20-slim AS runtime
WORKDIR /app

# Install system dependencies: python3 (for AI svc), pip, supervisor,
# + OSRM runtime shared libraries (all confirmed available in Debian 12
# Bookworm main — only the osrm-backend meta-package itself is missing).
RUN apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends \
      python3 python3-pip supervisor curl ca-certificates \
      libprotobuf32 libtbb12 \
      libboost-filesystem1.74.0 libboost-iostreams1.74.0 \
      libboost-system1.74.0 libboost-thread1.74.0 \
      zlib1g libbz2-1.0 \
    && rm -rf /var/lib/apt/lists/*

# --- Frontend ---
WORKDIR /app/frontend
COPY --from=frontend-builder /app/.next ./.next
COPY --from=frontend-builder /app/public ./public
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY frontend/package*.json ./
COPY frontend/next.config.js ./
COPY frontend/tsconfig.json ./
# Copy scripts dir EARLY — verify_db.py is needed before edumap.db verification
COPY scripts/ /app/scripts/
RUN chmod +x /app/scripts/*.sh /app/scripts/*.py

COPY frontend/public/edumap.db ./public/edumap.db
# Verify edumap.db is a valid SQLite database.
# If the file is corrupted (e.g., 132-byte git-lfs pointer from HF Spaces upload),
# automatically download the correct 1.3MB file from GitHub (repo is public).
RUN python3 /app/scripts/verify_db.py

# --- Backend (uses full node_modules from builder for native sqlite3) ---
WORKDIR /app/backend
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY backend/package*.json ./

# --- AI Service ---
WORKDIR /app/ai-service
# Copy installed pip packages from python:3.11-slim image.
# We do NOT copy the python:3.11-slim Python binary or libpython3.11.so
# to /usr/local/bin or /usr/local/lib respectively, because those require
# GLIBC_2.38 (built on a newer host) while node:20-slim (Debian 12) only
# provides GLIBC_2.36. The system python3 at /usr/bin/python3 (from
# apt-get install python3) is GLIBC_2.36-compatible and is used instead.
COPY --from=ai-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
# Copy the full Python 3.11 stdlib as a backup layer for the system python3
# (Debian's /usr/bin/python3 also has stdlib at /usr/lib/python3.11, but
# having /usr/local/lib/python3.11/ as an additional path doesn't hurt
# since PYTHONPATH only points at site-packages, not the stdlib dir).
COPY --from=ai-deps /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY ai-service/ ./
# Remove incompatible python:3.11-slim binaries from /usr/local/bin so that
# 'python3' resolves to /usr/bin/python3 (system Python, GLIBC_2.36-compatible)
# instead of /usr/local/bin/python3 (python:3.11-slim, needs GLIBC_2.38).
# Also remove the 'uvicorn' console script (shebang points to /usr/local/bin/python
# which we're removing; we use 'python3 -m uvicorn' instead).
RUN touch services/__init__.py routers/__init__.py && \
    rm -f /usr/local/bin/python /usr/local/bin/python3 /usr/local/bin/python3.11 \
          /usr/local/bin/uvicorn /usr/local/bin/uvicorn3 \
          /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.11 \
          /usr/local/bin/chardetect 2>/dev/null; \
    ldconfig

# --- Shared config ---
WORKDIR /app
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN mkdir -p /app/uploads /app/frontend/public /app/ai-service/models \
    /app/uploads/offline-models /app/osrm-data

# Copy pre-processed OSRM graph (built in osrm-builder stage) — survives
# container restarts since it's baked into the Docker image (unlike /tmp cache).
# osrm-extract/osrm-contract produces: *.osrm, *.osrm.hsgr, *.osrm.geometry, etc.
# Copy them all.
COPY --from=osrm-builder /data/ /app/osrm-data/
# Copy osrm-routed binary + shared libraries from osrm-builder stage.
# Cannot apt-get install osrm-backend (not in Debian 12 Bookworm — only sid).
COPY --from=osrm-builder /osrm-bin /usr/local/bin/
COPY --from=osrm-builder /osrm-libs /tmp/osrm-libs
# Install OSRM shared libraries from builder as fallback (99- priority =
# searched AFTER system libs so Debian 12 versions are preferred).
# Ensures we have all needed .so files even if some aren't in Debian 12 apt.
RUN mkdir -p /usr/local/osrm-lib && \
    cp /tmp/osrm-libs/* /usr/local/osrm-lib/ 2>/dev/null || true; \
    rm -rf /tmp/osrm-libs; \
    echo "/usr/local/osrm-lib" > /etc/ld.so.conf.d/99-osrm-lib.conf && \
    ldconfig
# Copy local SRTM elevation model (.npy) for 100% offline Climate Guardian
COPY --from=elevation-builder /data/srtm_vn.npy /app/ai-service/models/elevation/srtm_vn.npy
# Copy pre-downloaded vision model cache (avoids HF Hub download on cold start)
# transformers checks ~/.cache/huggingface/ by default.
COPY --from=vision-model-dl /data/hf-cache /root/.cache/huggingface

# Environment variables for all 3 services
# ── Cache busters — change to force HF Spaces Docker rebuild ──
ARG CACHEBUST=20261027_geovision-ai-satellite-detection

ENV NODE_ENV=production
ENV DB_TYPE=sqlite
ENV DB_SQLITE_PATH=/app/frontend/public/edumap.db
ENV DB_SYNC=false
ENV PORT=3000
ENV BACKEND_URL=http://127.0.0.1:3000
ENV NEXT_PUBLIC_API_URL=/api
ENV AI_SERVICE_URL=http://127.0.0.1:8000
# ── Edge AI Tutor (offline LLM) ──────────────────────────────────────────
# TinyLlama 1.1B model is downloaded at runtime from HF Hub to a writable
# volume (/app/uploads). It must NOT be bundled in the Docker image
# (*.bin/*.safetensors excluded by .huggingfaceignore + .dockerignore).
ENV OFFLINE_MODEL_NAME=TinyLlama/TinyLlama-1.1B-Chat-v1.0
ENV OFFLINE_MODEL_CACHE=/app/uploads/offline-models
# ── Routing provider chain ──────────────────────────────────────────
# HF Spaces runs everything in a single container (supervisord): frontend
# (7680), backend (3000), AI svc (8000), osrm (5000 — local backend).
#
# routing.service.ts tries providers in order:
#   1. Local OSRM      — primary (bundled in Docker image, zero API keys)
#   2. OpenRouteService — fallback only if OSRM_URL empty (needs ORS_API_KEY)
#   3. Haversine        — straight-line last resort
#
# Local OSRM runs osrm-routed on port 5000 inside the same container,
# serving the pre-processed Vietnam OSM graph (~500MB, built in osrm-builder
# stage). This keeps SafeRoute AI (#12) 100% offline — no ORS_API_KEY needed.
ENV OSRM_URL=http://127.0.0.1:5000
ENV OSRM_HOST=127.0.0.1
ENV OSRM_PORT=5000
ENV REDIS_HOST=127.0.0.1
ENV STORAGE_DIR=/app/uploads
# --- AI model configs (Cloudflare Workers AI primary, Gemini fallback) ─────
ENV CLOUDFLARE_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8,@cf/google/gemma-7b-it-lora,@cf/mistralai/mistral-small-3.1-24b-instruct
ENV CLOUDFLARE_EMBEDDING_MODEL=@cf/baai/bge-base-en-v1.5,@cf/baai/bge-m3,@cf/qwen/qwen3-embedding-0.6b
# Gemini (fallback for text gen + primary for embeddings on HF Spaces).
# Old 1.5/2.0 models are shut down and return HTTP 404 from v1beta.
ENV GEMINI_MODEL=gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-flash-latest
ENV GEMINI_EMBEDDING_MODEL=gemini-embedding-001
# ChromaDB telemetry is incompatible with newer posthog and spams the logs.
ENV ANONYMIZED_TELEMETRY=False
# ── GeoVision AI (Idea #10: satellite imagery facility detection) ────────────
# huggingface.co/models/{GEO_VISION_MODEL} — zero-shot object detection.
# Runs on HF's Inference API (router.huggingface.co), NOT bundled in Docker.
# curl uses --ipv4 --insecure for HF Spaces IPv6/TLS compatibility.
ENV GEO_VISION_MODEL=google/owlv2-base-patch16-ensemble
ENV GEO_VISION_TIMEOUT_SECONDS=25
# ── Local vision model (GeoVision fallback when HF_TOKEN absent) ─────────────
ENV LOCAL_VISION_MODEL=google/owlv2-base-patch16-ensemble
ENV LOCAL_VISION_ENABLED=true
# Bing Maps tiles (optional aerial source). Empty = OSM tiles used.
ENV BING_MAPS_API_KEY=""
# Embedding time budget: total chain + per-provider cap. Together these keep
# RAG well below the NestJS 10s stream timeout and stop Cloudflare from
# starving the Gemini fallback.
ENV EMBED_GLOBAL_TIMEOUT_SECONDS=6
ENV EMBED_PROVIDER_TIMEOUT_SECONDS=4
ENV RAG_TIMEOUT_SECONDS=8
# Use a fresh, ephemeral ChromaDB path so stale chromadb_data from a previous
# Space revision (whose *.bin files may have been partially excluded by upload
# ignore_patterns) can never block or crash the AI service at startup.
ENV CHROMA_DB_PATH=/tmp/chroma_db
# Ensure Python packages copied from the python:3.11 image are discoverable
# by the system python3 (Debian installs to /usr/lib, not /usr/local)
ENV PYTHONPATH=/usr/local/lib/python3.11/site-packages
ENV PYTHONUNBUFFERED=1
# --- Cloudflare AI Gateway (tuỳ chọn; bật qua HF Spaces Secrets) ---
ENV CF_AI_GATEWAY_ID=""
ENV CF_AI_GATEWAY_ENABLED="false"

EXPOSE 7680
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
