# =========================================================
# EDUMAP HUGGING FACE SPACES DOCKERFILE (UNIFIED)
# =========================================================

# Stage 1: Build Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --legacy-peer-deps
COPY backend/ .
RUN npm run build

# Stage 2: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-peer-deps
COPY frontend/ .
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build

# Stage 3: Final Image
FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    lsb-release \
    supervisor \
    nginx \
    postgresql-14 \
    postgresql-14-postgis-3 \
    redis-server \
    python3 \
    python3-pip \
    wget \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install MinIO
RUN wget https://dl.min.io/server/minio/release/linux-amd64/minio -O /usr/local/bin/minio \
    && chmod +x /usr/local/bin/minio

WORKDIR /app

# Copy Build Artifacts
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/package.json

COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /app/frontend/package.json ./frontend/package.json

# Copy AI Service
COPY ai-service/ ./ai-service/
RUN pip3 install --no-cache-dir -r ./ai-service/requirements.txt

# Copy Infrastructure Configs
COPY infrastructure/nginx/default.conf /etc/nginx/sites-available/default
COPY infrastructure/docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Setup PostgreSQL
USER postgres
RUN /etc/init.d/postgresql start && 
    psql --command "CREATE USER admin WITH SUPERUSER PASSWORD 'password123';" && 
    createdb -O admin edumap_db && 
    /etc/init.d/postgresql stop

USER root

# Setup Directories
RUN mkdir -p /data /var/log/supervisor /var/run/postgresql

# Copy Entrypoint Script
COPY scripts/hf_entrypoint.sh /usr/local/bin/hf_entrypoint.sh
RUN chmod +x /usr/local/bin/hf_entrypoint.sh

# HF Spaces requires port 7860
RUN sed -i 's/listen 80;/listen 7860;/' /etc/nginx/sites-available/default

EXPOSE 7860

# Start via Entrypoint Script (Automated Init)
CMD ["/usr/local/bin/hf_entrypoint.sh"]