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
ENV NEXT_PUBLIC_API_URL=http://localhost:7680/api
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
RUN pip install --no-cache-dir -r requirements.txt

# === Stage 4: Runtime — combines all 3 services ===
FROM node:20-slim AS runtime
WORKDIR /app

# Install system dependencies: python3 (for AI svc), pip, supervisor (process manager)
RUN apt-get update -qq && apt-get install -y -qq python3 python3-pip supervisor curl ca-certificates && rm -rf /var/lib/apt/lists/*

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
RUN mkdir -p /app/uploads /app/frontend/public /app/ai-service/models

# Environment variables for all 3 services
# ── Cache busters — change to force HF Spaces Docker rebuild ──
ARG CACHEBUST=20261018-curl-installed

ENV NODE_ENV=production
ENV DB_TYPE=sqlite
ENV DB_SQLITE_PATH=/app/frontend/public/edumap.db
ENV DB_SYNC=false
ENV PORT=3000
ENV BACKEND_URL=http://127.0.0.1:3000
ENV NEXT_PUBLIC_API_URL=http://localhost:7680/api
ENV AI_SERVICE_URL=http://127.0.0.1:8000
ENV OSRM_URL=http://127.0.0.1:8000
ENV REDIS_HOST=127.0.0.1
ENV STORAGE_DIR=/app/uploads
# --- AI model configs (HuggingFace Inference API fallback for Cloudflare Workers AI) ---
ENV HF_LLM_MODEL=mistralai/Mistral-7B-Instruct-v0.2
ENV HF_EMBEDDING_MODEL=intfloat/multilingual-e5-base
# Use a fresh, ephemeral ChromaDB path so stale chromadb_data from a previous
# Space revision (whose *.bin files may have been partially excluded by upload
# ignore_patterns) can never block or crash the AI service at startup.
ENV CHROMA_DB_PATH=/tmp/chroma_db
# Ensure Python packages copied from the python:3.11 image are discoverable
# by the system python3 (Debian installs to /usr/lib, not /usr/local)
ENV PYTHONPATH=/usr/local/lib/python3.11/site-packages

EXPOSE 7680
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
