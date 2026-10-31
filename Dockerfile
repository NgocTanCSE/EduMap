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
# --no-audit/--no-fund skips metadata download; --jobs=1 serializes extraction (4 jobs = 8GB V8 heap cap on HF free tier)
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm ci --legacy-peer-deps --no-audit --no-fund --jobs=1
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
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund --jobs=1

# === Stage 2: Build Backend (needs native modules, keep full deps) ===
FROM node:20-slim AS backend-builder
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq python3 make g++ gcc && rm -rf /var/lib/apt/lists/*
ARG CACHEBUST
COPY backend/package*.json ./
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm ci --legacy-peer-deps --no-audit --no-fund --jobs=1
# Wait for frontend-builder to complete before proceeding with build/compile.
# Next.js npm run build (~2GB) + NestJS npx nest build (~1.5GB) in parallel
# exceed HF Spaces' 4GB limit → OOMKilled. npm ci can run in parallel;
# this COPY sits between npm ci and nest build, so only the compile waits.
COPY --from=frontend-builder /app/package.json /tmp/frontend-build-done
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
# Reduces pip memory by limiting parallel downloads
ENV PIP_NUM_THREADS=1

# Step 1: torch DEPS only (filelock, typing-extensions, etc. — lightweight ~100MB).
# These run in parallel with frontend-builder npm ci — safe (<200MB total).
# The actual torch wheel (~800MB) is deferred to Step 2a below, AFTER the
# frontend build completes, so torch (~2.5GB peak with swap) never overlaps
# with frontend npm ci (~1GB) + backend npm ci (~500MB) + other stages.
# Without this split, all parallel stages summed to ~5.2GB physical when
# swap was unavailable → OOMKilled exit 137 on HF Spaces free plan.
RUN pip install --no-cache-dir filelock typing-extensions sympy networkx jinja2 fsspec mpmath MarkupSafe && \
    echo "[ai-deps] torch deps installed"

# Step 2: Dependency edge — WAIT for frontend-builder to finish (npm ci + npm run build).
# This ensures the frontend's ~2-3GB build RAM is freed before the heaviest
# pip install stages begin. Prevents the build-time OOM where torch (2.5GB)
# ran in parallel with frontend npm ci (1GB) + backend npm ci (500MB) +
# elevation/vision/osm stages, summing to 5+GB against the ~4GB build limit.
COPY --from=frontend-builder /app/package.json /tmp/frontend-build-done

# Step 2a: torch (--no-deps, CPU-only — 800MB wheel, ~2.5GB peak RAM with swap).
# Now runs ONLY after frontend build is done — torch is alone with lightweight
# stages (frontend-deps, elevation-builder, etc.) instead of all npm ci's too.
RUN ( \
    (fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 2>/dev/null) && \
    chmod 600 /swapfile && \
    (mkswap /swapfile 2>/dev/null && swapon /swapfile 2>/dev/null || echo "[ai-deps] swap unavailable") \
  ) || true ; \
    pip install --no-cache-dir --no-deps torch --index-url https://download.pytorch.org/whl/cpu && \
    (swapoff /swapfile 2>/dev/null || true) && rm -f /swapfile && \
    echo "[ai-deps] torch installed"

# Step 2b: Core + ML + TTS packages (everything EXCEPT chromadb).
# Split from chromadb to avoid OOM — pip's resolver loads the entire
# dependency tree (kubernetes, onnxruntime, etc.) into memory at once,
# causing exit 137 when combined with transformers + scikit-learn.
#
# Further split into 7 sequential pip install calls — each resolves a
# smaller dependency graph (<~20 transitive deps), keeping peak RAM <2GB
# on HF Spaces free tier (2 vCPU, limited build RAM).
RUN pip install --no-cache-dir fastapi uvicorn pydantic python-dotenv requests python-multipart && \
    pip install --no-cache-dir psycopg2-binary pandas numpy pypdf redis && \
    pip install --no-cache-dir posthog httpx tqdm Pillow gTTS && \
    pip install --no-cache-dir huggingface_hub accelerate sentencepiece && \
    pip install --no-cache-dir transformers && \
    pip install --no-cache-dir sentence-transformers scikit-learn scipy && \
    pip install --no-cache-dir edge-tts && \
    echo "[ai-deps] core + ML + TTS packages installed"

# Step 3: chromadb deps FIRST (kubernetes, onnxruntime — large graph),
# then chromadb itself with --no-deps so pip doesn't re-resolve everything.
# This isolates chromadb's huge dependency tree from the rest.
RUN pip install --no-cache-dir kubernetes onnxruntime mmh3 click graphene grpcio pybase64 pypika schema brotli datasketch deprecated && \
    pip install --no-cache-dir --no-deps "chromadb>=0.4.0,<0.6.0" && \
    echo "[ai-deps] chromadb + deps installed"

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
    apt-get install -y -qq --no-install-recommends wget ca-certificates osmium-tool && \
    rm -rf /var/lib/apt/lists/*
# Filter OSM data to major road types only — removes service/path/footway/
# cycleway/track/steps/residential (~50% of edges) to reduce osrm-extract's
# edge-expanded graph memory from ~3.5GB to ~2.2GB (fits in HF Spaces' 4GB).
# Still keeps: motorway/trunk/primary/secondary/tertiary/unclassified
#        + link roads + traffic_signals + barrier nodes (for routing correctness)
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
# Force sequential build: BuildKit runs independent stages in parallel.
# Both of these pairs exceed HF Spaces' ~4GB Docker build RAM → OOMKilled 137:
#   1. osrm-extract (2–4GB) + ai-deps pip install (~1–2GB)   → fixed by --from=ai-deps
#   2. osrm-extract (2–4GB) + backend npx nest build (~1.5GB) → fixed by --from=backend-builder
# COPY creates build-graph edges: osrm-builder waits for both stages to finish.
COPY --from=ai-deps /app/requirements.txt /tmp/ai-deps-complete
COPY --from=backend-builder /app/package.json /tmp/backend-build-complete
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
      python3 python3-pip supervisor curl ca-certificates cron \
      libprotobuf32 libtbb12 libgomp1 \
      libboost-filesystem1.74.0 libboost-iostreams1.74.0 \
      libboost-system1.74.0 libboost-thread1.74.0 \
      libboost-program-options1.74.0 \
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
# Copy the crawler package — required by run_feature_crawlers.sh + run_overpass_seed.sh
COPY crawlers/ /app/crawlers/
# Install crontab for nightly feature crawlers + Overpass POI upsert
COPY crawlers/crontab /etc/cron.d/edumap-crawlers
RUN chmod +x /app/scripts/*.sh /app/scripts/*.py && \
    chmod 0644 /etc/cron.d/edumap-crawlers && \
    crontab /etc/cron.d/edumap-crawlers

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
    # CRITICAL: Remove ALL system-provided C/C++ runtime libraries to prevent
    # GLIBCXX/GLIBC version conflicts. osrm/osrm-backend:v5.25.0 is Debian-based
    # and ships OLDER libstdc++/libc. The /etc/ld.so.conf.d/99-osrm-lib.conf dir
    # has HIGHER priority than built-in /usr/lib paths, so the dynamic linker
    # loads OLD libstdc++.so.6 from osrm-lib instead of Debian 12's GCC 12
    # libstdc++ (which has GLIBCXX_3.4.29, CXXABI_1.3.11).
    # Result: ALL native modules crash (sqlite3, scipy, torch) → backend +
    # AI service can't start → 0 features work.
    #
    # Fix: remove libc/libstdc++/libprotobuf/libtbb/libgomp/libz etc. — ALL
    # these are available via apt in the runtime stage (Debian 12, newer).
    # System libs are backward-compatible with osrm-routed. Only OSRM-specific
    # libs (libosrm.so, etc.) AND boost libs (different soname: 1.62 vs 1.74)
    # remain in /usr/local/osrm-lib. Boost is NOT removed because osrm-routed
    # links against the specific 1.62 ABI and the system's 1.74 soname won't
    # satisfy it — different sonames mean no conflict for other programs.
    rm -f /usr/local/osrm-lib/libc.so.6 /usr/local/osrm-lib/libm.so.6 \
        /usr/local/osrm-lib/libpthread.so.0 /usr/local/osrm-lib/libdl.so.2 \
        /usr/local/osrm-lib/librt.so.1 /usr/local/osrm-lib/ld-linux-*.so* \
        /usr/local/osrm-lib/libc-*.so \
        /usr/local/osrm-lib/libstdc++.so.6 /usr/local/osrm-lib/libstdc++fs-*.so \
        /usr/local/osrm-lib/libgcc_s.so.1 /usr/local/osrm-lib/libatomic.so.1 \
        /usr/local/osrm-lib/libgomp.so.1 \
        /usr/local/osrm-lib/libprotobuf.so* /usr/local/osrm-lib/libprotoc.so* \
        /usr/local/osrm-lib/libtbb*.so* \
        /usr/local/osrm-lib/libz.so* /usr/local/osrm-lib/libzstd.so* \
        /usr/local/osrm-lib/libbz2.so* \
        2>/dev/null; \
    # Symlink fallback: if ldd didn't collect libboost_program_options.so.1.62.0
    # from the osrm-builder (e.g. stripped binary), point the 1.62 soname to the
    # system's 1.74 version. Boost program_options ABI is stable enough for
    # osrm-routed's minimal parse_command_line usage.
    if [ ! -f /usr/local/osrm-lib/libboost_program_options.so.1.62.0 ] && \
       [ -f /usr/lib/x86_64-linux-gnu/libboost_program_options.so.1.74.0 ]; then \
      ln -sf /usr/lib/x86_64-linux-gnu/libboost_program_options.so.1.74.0 \
             /usr/local/osrm-lib/libboost_program_options.so.1.62.0 && \
      echo "[runtime] symlinked boost_program_options 1.62 -> 1.74 for osrm-routed"; \
    fi; \
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
ARG CACHEBUST=20261030_osrm-boost-chroma-fix

ENV NODE_ENV=production
ENV DB_TYPE=sqlite
ENV DB_SQLITE_PATH=/app/frontend/public/edumap.db
ENV DB_SYNC=false
# Enable dev-login on HF Spaces so users always have a working auth path.
# On the free tier the SQLite file reverts to the image on restart; the dev
# user is seeded into edumap.db and re-seeded by ensureSqliteSchema() on boot,
# so its UUID is stable and JWTs remain valid across restarts.
ENV ENABLE_DEV_LOGIN=true
ENV PORT=3000
ENV BACKEND_URL=http://127.0.0.1:3000
ENV NEXT_PUBLIC_API_URL=/api
ENV AI_SERVICE_URL=http://127.0.0.1:8000
# ── Edge AI Tutor (Idea #7) ──────────────────────────────────────────────
# No local tutor model is bundled any more: TinyLlama 1.1B was removed on
# 2026-10-30 (30-60 s per answer on 2 vCPU). The tutor generates through the
# DeepSeek → Gemini → Cloudflare cascade and falls back to Vietnamese
# templates. Set OFFLINE_TUTOR_USE_LLM=false to force template-only answers.
ENV OFFLINE_TUTOR_USE_LLM=true
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
# ── Local LLM (Gemma 2B IT — offline text-gen fallback #4) ─────────────────
# Gemma is GATED on HF Hub (scripts/cache_models.py skips it during build).
# On the free tier it is usually a no-op anyway: without HF_TOKEN during build
# the weights aren't baked, and even with HF_TOKEN at runtime the 4-bit load
# costs ~1.5GB RAM for ~2-5 tokens/s on 2 vCPU. The cascade (DeepSeek →
# Gemini → Cloudflare → template) handles the fallback. Disabling it here
# saves 1.5 GB of runtime RAM and avoids a wasted download+load attempt that
# always fails. The 'generated' NameError bug (fixed in llm_service.py)
# confirmed Gemma could never produce a response even if loaded.
ENV LOCAL_LLM_ENABLED=false
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
# Per-provider generation budget in the streaming fallback cascade.
# Increased from 5 to 8 so Gemini (primary LLM on HF Spaces) has enough time
# for TCP/TLS connect (~4-6s on HF free tier) + first-token latency + response.
# Still stays under the NestJS 10s proxy deadline.
ENV GEN_TIMEOUT_SECONDS=8
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
