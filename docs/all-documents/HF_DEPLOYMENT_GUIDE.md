# EduMap Hugging Face Deployment Guide

## Giới thiệu

Hướng dẫn deploy EduMap lên Hugging Face Spaces sử dụng Docker.

## Yêu cầu

- Docker và Docker Compose installed
- Hugging Face account
- Hugging Face CLI installed

## Bước 1: Chuẩn bị

### 1.1 Cài đặt Hugging Face CLI

```bash
pip install -U huggingface_hub
```

### 1.2 Đăng nhập Hugging Face

```bash
huggingface-cli login
```

## Bước 2: Cấu hình Environment Variables

### 2.1 Tạo file .env.hf

```bash
cp .env.hf.example .env.hf
```

### 2.2 Chỉnh sửa .env.hf

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/edumap
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=edumap

# Redis
REDIS_URL=redis://localhost:6379

# AI Service
GEMINI_API_KEY=your-gemini-api-key-here

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

## Bước 3: Test Local Deployment

### 3.1 Chạy test script

```bash
chmod +x scripts/test-hf-deployment.sh
./scripts/test-hf-deployment.sh
```

### 3.2 Kiểm tra services

```bash
# Kiểm tra trạng thái services
docker-compose -f docker-compose.hf.yml ps

# Xem logs
docker-compose -f docker-compose.hf.yml logs -f
```

## Bước 4: Deploy lên Hugging Face Spaces

### 4.1 Tạo Spaces repo mới

```bash
huggingface-cli repo create edumap --type docker --space-sdk docker
```

### 4.2 Clone Spaces repo

```bash
git clone https://huggingface.co/spaces/your-username/edumap
cd edumap
```

### 4.3 Copy files vào Spaces repo

```bash
# Copy Unified Dockerfile (Hỗ trợ chạy tất cả DB, Redis, BE, FE, AI trong 1 Container trên cổng 7860)
cp ../EduMap/Dockerfile ./

# Copy thư mục cấu hình và scripts
cp -r ../EduMap/infrastructure ./
cp -r ../EduMap/scripts ./

# Copy source code
cp -r ../EduMap/backend ./
cp -r ../EduMap/frontend ./
cp -r ../EduMap/ai-service ./

# Copy SQL data (Mầm dữ liệu)
cp ../EduMap/seed_crawled_data*.sql ./
```

### 4.4 Tạo README.md cho Spaces

```bash
cat > README.md << 'EOF'
---
title: EduMap
emoji: 🗺️
colorFrom: yellow
colorTo: purple
sdk: docker
pinned: false
---

# EduMap - Nền tảng Bản đồ Giáo dục Thông minh

Nền tảng giáo dục toàn diện kết hợp bản đồ địa lý, trí tuệ nhân tạo, và cộng đồng học tập.
EOF
```

### 4.5 Push lên Hugging Face

```bash
git add .
git commit -m "Initial deployment"
git push
```

## Bước 5: Cấu hình Secrets

### 5.1 Truy cập Settings

Vào https://huggingface.co/spaces/your-username/edumap/settings

### 5.2 Thêm Secrets

Thêm các secrets sau trong phần Repository secrets:

- `GEMINI_API_KEY`: API key của Google Gemini
- `DB_PASSWORD`: Mật khẩu PostgreSQL
- `JWT_SECRET`: Secret key cho JWT

## Bước 6: Verify Deployment

### 6.1 Kiểm tra deployment

Vào https://huggingface.co/spaces/your-username/edumap

### 6.2 Kiểm tra logs

```bash
# Xem logs trong Hugging Face Spaces
# Vào Settings -> Logs
```

## Troubleshooting

### Lỗi: Services không start

```bash
# Kiểm tra logs
docker-compose -f docker-compose.hf.yml logs

# Restart services
docker-compose -f docker-compose.hf.yml restart
```

### Lỗi: Database connection failed

```bash
# Kiểm tra PostgreSQL
docker-compose -f docker-compose.hf.yml ps postgres

# Reset database
docker-compose -f docker-compose.hf.yml down -v
docker-compose -f docker-compose.hf.yml up -d postgres
```

### Lỗi: AI Service không hoạt động

```bash
# Kiểm tra Gemini API key
echo $GEMINI_API_KEY

# Kiểm tra AI service logs
docker-compose -f docker-compose.hf.yml logs ai-service
```

## Performance Optimization

### 1. Sử dụng PostgreSQL managed service

Thay vì chạy PostgreSQL trong Docker, sử dụng service managed như:
- Supabase
- Neon
- Aiven

### 2. Sử dụng Redis managed service

Thay vì chạy Redis trong Docker, sử dụng service managed như:
- Upstash
- Redis Cloud

### 3. Optimize Docker images

Sử dụng multi-stage builds để giảm kích thước images.

### 4. Enable caching

Enable caching cho static assets và API responses.

## Monitoring

### 1. Sentry

Sử dụng Sentry để monitor errors.

### 2. Prometheus + Grafana

Sử dụng Prometheus và Grafana để monitor metrics.

### 3. Logs

Xem logs trong Hugging Face Spaces dashboard.

## Security

### 1. HTTPS

Hugging Face Spaces tự động cung cấp HTTPS.

### 2. Secrets

Lưu trữ secrets trong Hugging Face Settings.

### 3. Rate Limiting

Enable rate limiting để prevent abuse.

### 4. Input Validation

Validate tất cả user input.

## Backup

### 1. Database Backup

```bash
# Backup PostgreSQL
docker-compose -f docker-compose.hf.yml exec postgres pg_dump -U postgres edumap > backup.sql
```

### 2. Restore Database

```bash
# Restore PostgreSQL
docker-compose -f docker-compose.hf.yml exec -T postgres psql -U postgres edumap < backup.sql
```

## Support

Nếu gặp vấn đề, hãy:
1. Kiểm tra logs
2. Đọc documentation
3. Tạo issue trên GitHub
