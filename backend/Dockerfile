# 🚀 STAGE 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Install build tools required for native modules (e.g., sqlite3)
RUN apk add --no-cache python3 make g++ gcc

COPY package*.json ./
# Install ALL dependencies (including dev) using a clean lockfile if present
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# 🏃 STAGE 2: Runtime (development) with full dependencies and source
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=development
# Default to SQLite for environments without a PostgreSQL instance
ENV DB_TYPE=sqlite
ENV DB_SYNC=true

COPY package*.json ./
# Install runtime dependencies (including native sqlite3) – same build tools for native compile then remove them
RUN apk add --no-cache python3 make g++ gcc && \
    npm ci --only=production --legacy-peer-deps && \
    apk del python3 make g++ gcc

# Copy built code from builder stage
COPY --from=builder /app/dist ./dist
# Copy source code (respecting .dockerignore)
COPY . .

EXPOSE 3000

CMD ["node", "dist/main"]
