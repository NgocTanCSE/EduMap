# 🚀 STAGE 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 🏃 STAGE 2: Create slim runner for production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --only=production

# Copy built code from Stage 1
COPY --from=builder /app/dist ./dist

EXPOSE 3000
USER node

CMD ["node", "dist/main"]
