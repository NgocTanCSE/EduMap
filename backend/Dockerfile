# 🚀 STAGE 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install ALL dependencies
RUN npm install
COPY . .
RUN npm run build

# 🏃 STAGE 2: Development/Runner with full dependencies and source
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=development

COPY package*.json ./
# Re-install dependencies inside the container to avoid binary compatibility issues
RUN npm install

# Copy built code from builder stage
COPY --from=builder /app/dist ./dist
# Copy source code (respecting .dockerignore)
COPY . .

EXPOSE 3000

CMD ["node", "dist/main"]
