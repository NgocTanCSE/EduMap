# =========================================================
# EDUMAP MOBILE (Web) — Hugging Face Spaces Docker
# =========================================================
# Expo's `export:web` (Webpack) produces a static `web-build/`
# directory. This Dockerfile builds it and serves it on the
# port HF requires (7860) via a dependency-free Node static
# server (server.js).
#
# Env handling:
#   EXPO_PUBLIC_API_BASE_URL is baked at build time so the
#   static bundle can call the backend (mobile/api.ts reads it).
#   If unset/empty, the mobile app falls back to its own
#   default (http://localhost:3000/api on web).
# On HF Spaces you can set EXPO_PUBLIC_API_BASE_URL as a Space
# Secret before the first build so it is baked into the image.
#
# Note on react-native@0.73.2 web shims:
#   RN 0.73.2 omits several `.web.js` files that its own
#   ReactPrivateInterface / StyleSheet require on web. The
#   build stage applies tiny web-only shims (via
#   scripts/rn-web-shims.sh) before exporting. Native builds
#   are untouched (only `.web.js` files are added).
# =========================================================

# ── Stage 1: Build the Expo Web static export ──
FROM node:20-alpine AS builder

WORKDIR /app

# Build tools occasionally needed by native RN modules
RUN apk add --no-cache python3 make g++ git bash

# Install dependencies deterministically from lockfile
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy the rest of the project (app.json, src, assets, scripts, etc.)
COPY . .

# Allow API base URL to be baked at build time (optional).
# Empty -> the app uses http://localhost:3001/api (web default).
ARG EXPO_PUBLIC_API_BASE_URL
ENV EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL}
ENV NODE_OPTIONS=--max_old_space_size=4096

# 1) Patch RN 0.73.2 web shims (web-only, no-op elsewhere)
RUN sh scripts/rn-web-shims.sh

# 2) Static web export -> ./web-build
RUN npx expo export:web --clear

# Sanity check the export landed
RUN test -f web-build/index.html

# ── Stage 2: Serve the static site on HF port 7860 ──
FROM node:20-alpine AS runner

WORKDIR /app

# Non-root user (HF best practice)
RUN addgroup -S appgroup && adduser -S -G appgroup appuser
USER appuser

# Copy the built static site + the zero-dependency server
COPY --from=builder --chown=appuser:appgroup /app/web-build ./web-build
COPY --chown=appuser:appgroup server.js ./

ENV NODE_ENV=production
ENV PORT=7860
ENV HOST=0.0.0.0

# HF Spaces requires the container to listen on 7860.
EXPOSE 7860

# Single process: static file server with SPA fallback.
CMD ["node", "server.js"]
