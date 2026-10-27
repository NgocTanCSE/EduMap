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

> **📌 Chính sách triển khai (bắt buộc):** Dự án **chỉ chạy production trên Hugging Face Spaces**. Môi trường local **chỉ dùng để code, đọc code và chạy unit test** — không phải môi trường tham chiếu cho hành vi runtime. Mọi fix phải được kiểm chứng trên HF Space sau khi deploy. Secrets production nằm ở **HF Spaces → Settings → Secrets**, không nằm trong `.env` local. Xem thêm `AGENTS.md`.

> Một số tính năng cần external services (PostgreSQL, Redis) sẽ không khả dụng trong single-container SQLite mode của HF Spaces.

```bash
# Build (chỉ để kiểm tra image)
docker build -t edumap .

# Run (3 services + crawler)
docker run -p 7680:7680 -p 3000:3000 -p 8000:8000 edumap

# Truy cập: http://localhost:7680
```

### Embedding / RAG trên HF Spaces

Chuỗi embedding: `Gemini → Cloudflare → HF → NVIDIA → 01.ai`.
(XKIRO được thử trước nếu `XKIRO_EMBEDDING_MODEL` được cấu hình, nhưng XKIRO
không hỗ trợ `/v1/embeddings` — sẽ nhận 404 và fallback ngay sang Gemini.)
Các biến dùng để giới hạn thời gian (tránh 1 provider treo làm hỏng chat):

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `EMBED_GLOBAL_TIMEOUT_SECONDS` | `6` | Tổng thời gian cho cả chuỗi embedding |
| `EMBED_PROVIDER_TIMEOUT_SECONDS` | `4` | Thời gian tối đa cho 1 provider |
| `RAG_TIMEOUT_SECONDS` | `8` | Giới hạn cứng cho bước RAG trong chat |
| `XKIRO_EMBEDDING_MODEL` | *(rỗng)* | XKIRO không hỗ trợ embeddings — để rỗng, chuỗi sẽ fallback sang Gemini |

> Giữ các giá trị này **dưới 10s** (timeout stream của NestJS). Nếu RAG quá hạn,
> chatbot vẫn trả lời bằng kiến thức LLM thay vì treo/để bong bóng chat rỗng.


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
