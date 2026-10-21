---
title: EduMap — Vietnam Education Map
emoji: 🎓
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7680
language: vi
license: cc-by-sa-4.0
tags:
  - education
  - vietnam
  - schools
  - libraries
  - wifi
  - open-data
  - map
  - career
---

# 🎓 EduMap — Vietnam Education & Career Map

Bản đồ giáo dục & cơ hội việc làm Việt Nam — ứng dụng web full-stack chạy trên **Hugging Face Spaces Docker** (single container).

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────┐
│  Docker container (HF Spaces)               │
│                                             │
│  frontend    NEXT.js   :7680  ← public      │
│  backend     NestJS    :3000  ← internal    │
│  ai-service  FastAPI   :8000  ← internal    │
│  crawler     Python3   :loop  ← daily       │
│  SQLite DB   edumap.db 1.3MB, 89 tables     │
└─────────────────────────────────────────────┘
```

## 🐳 Chạy local

```bash
# Build
docker build -t edumap .

# Run (3 services + crawler)
docker run -p 7680:7680 -p 3000:3000 -p 8000:8000 edumap

# Truy cập: http://localhost:7680
```

## ⚙️ Environment Variables (HF Spaces Secrets)

| Secret | Mô tả | Bắt buộc |
|--------|------|---------|
| `JWT_SECRET` | JWT signing key | ✅ |
| `ORS_API_KEY` | OpenRouteService routing | ⚠️ (có fallback Haversine) |
| `CLOUDFLARE_API_TOKEN` | AI service LLM | ✅ |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | ✅ |
| `CF_AI_GATEWAY_ID` | Cloudflare AI Gateway ID (tuỳ chọn) | ❌ |
| `CF_AI_GATEWAY_ENABLED` | Bật AI Gateway (true/false, mặc định false) | ❌ |
| `GOOGLE_CLIENT_ID` | OAuth client ID | ⚠️ |
| `CLOUDFLARE_MODEL` | LLM model (default: @cf/meta/llama-3.1-8b-instruct-fp8) | ❌ |
| `CLOUDFLARE_EMBEDDING_MODEL` | Embedding model | ❌ |

> ⚠️ `NEXT_PUBLIC_API_URL` đã được đặt mặc định trong Dockerfile. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_ID` **KHÔNG** được hardcode — bạn **phải** thêm chúng vào HF Spaces → Settings → Secrets (hoặc truyền qua `-e` khi chạy `docker run`).

## 📡 API Endpoints

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/` | GET | Web app |
| `/hackathon` | GET | Devpost hackathons (30 items) |
| `/api/health` | GET | Health check |
| `/api/map/pois` | GET | 1000+ POIs (schools, libraries, etc.) |
| `/api/map/routing/route` | GET | Directions (ORS API + Haversine fallback) |
| `/api/career/jobs` | GET | Job listings (from SQLite crawler) |
| `/api/pins` | GET | User pins |
| `/api/chat/messages` | GET | AI chat (Cloudflare LLM) |

## 🔄 CI/CD

- **Source**: https://github.com/NgocTanCSE/EduMap
- **Build**: 4-stage Dockerfile multi-stage (GitHub Actions v3)
- **Deploy**: Auto-build trên HF Spaces (Docker) khi push lên `main` branch GitHub

## License

Dữ liệu được cấp phép **CC‑BY‑SA 4.0**.
