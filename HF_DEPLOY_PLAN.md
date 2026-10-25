# 📘 EduMap — Hướng dẫn Triển khai Docker & HuggingFace Spaces

> **✅ Trạng thái**: Hoạt động ổn định — tất cả endpoints đã được kiểm thử qua Docker local. Cấu hình này làm việc trên cả local Docker và HuggingFace Spaces.

EduMap là một ứng dụng full-stack giáo dục bao gồm 3 service chính:

| Service | Port | Tech | Mô tả |
|---|---|---|---|
| **Frontend + BFF** | 7680 | Next.js 14 (App Router) | Trang web công khai, SSR + BFF proxy |
| **Backend** | 3000 | NestJS | API server, xác thực, SQLite data layer |
| **AI Service** | 8000 | FastAPI | Chatbot AI (proxy tới Cloudflare Workers AI + HF Inference) |
| **Crawler** | — | Python | CRON crawl hackathons/events (tùy chọn) |

---

## 🏗️ Kiến trúc (Single Container via supervisord)

```
HF Space / Docker Container (port 7680 là PUBLIC PORT)
│
├─ supervisord (PID 1)
│   ├─ frontend     → Next.js start  :7680   ← PUBLIC
│   ├─ backend      → Node NestJS     :3000   ← localhost
│   ├─ ai-service   → Python FastAPI  :8000   ← localhost
│   └─ crawler      → Python (CRON)     —     ← tùy chọn
│
├─ SQLite  (/app/frontend/public/edumap.db)  — 90 tables, ~1.3MB
├─ ChromaDB (/tmp/chroma_db)                 — vector store (in-memory, ephemeral)
├─ LRU cache (in-process)                    — thay thế Redis
└─ Filesystem (/tmp)                         — thay thế MinIO
```

### Services được thay thế (so với Docker Compose ban đầu)

| Service gốc | Thay thế | Lý do |
|---|---|---|
| PostgreSQL 16 | **SQLite** | Binary + data vượt quá 1GB disk limit của HF Spaces |
| Redis | **LRU cache (in-process)** | Giảm process, giảm RAM |
| OSRM | **OpenRouteService API** | Routing graph chiếm 1GB+ disk |
| MinIO | **Filesystem /tmp** | HF Spaces không có s3 bucket |
| NGINX | **Removed** | Next.js + BFF xử lý routing |

---

## 🐳 Chạy Local với Docker

### 1. Build image

```bash
docker build -t edumap-hf:latest .
```

### 2. Chuẩn bị `.env`

File `.env` chứa các secret cần thiết (được cung cấp sẵn):

```env
# Bắt buộc cho AI service (Cloudflare Workers AI)
CLOUDFLARE_API_TOKEN=⟦SECRET_REDACTED⟧
CLOUDFLARE_ACCOUNT_ID=⟦SECRET_REDACTED⟧
CLOUDFLARE_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8,@cf/google/gemma-7b-it-lora,@cf/mistralai/mistral-small-3.1-24b-instruct
CLOUDFLARE_EMBEDDING_MODEL=@cf/baai/bge-base-en-v1.5,@cf/baai/bge-m3,@cf/qwen/qwen3-embedding-0.6b

# Bắt buộc cho backend auth
JWT_SECRET=edumap-local-dev-secret

# Tùy chọn (cho HF Inference API fallback)
HF_TOKEN=your_hf_token_here
ORS_API_KEY=your_ors_key_here   # cho geo routing
```

### 3. Chạy container

```bash
source .env && docker run -d \
  --name edumap-hf-test \
  -p 7680:7680 -p 3000:3000 -p 8000:8000 \
  -e JWT_SECRET="$JWT_SECRET" \
  -e CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
  -e CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
  -e CLOUDFLARE_MODEL="$CLOUDFLARE_MODEL" \
  -e CLOUDFLARE_EMBEDDING_MODEL="$CLOUDFLARE_EMBEDDING_MODEL" \
  edumap-hf:latest
```

> **Lưu ý**: Các secret (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `JWT_SECRET`) **không bao giờ** được hardcode vào Dockerfile — chúng được truyền qua env vars tại runtime. Các giá trị mặc định không nhạy cảm (như model names, database paths) được đặt trong Dockerfile ENV.

### 4. Kiểm tra

Chờ khoảng 20-30 giây để tất cả services khởi động, sau đó kiểm tra logs:

```bash
docker logs -f edumap-hf-test
```

Bạn nên thấy:
```
supervisord started with pid 1
PostgreSQL disabled (DB_TYPE=sqlite) — AI service relies on backend for data access
success: backend entered RUNNING state
success: frontend entered RUNNING state
AI SERVICE READY
Nest application successfully started
success: ai-service entered RUNNING state
success: crawler entered RUNNING state
```

---

## 🌐 Triển khai trên HuggingFace Spaces

### Cách thức hoạt động

HF Spaces hỗ trợ **Docker** (chức năng "Docker" template). Khi bạn đẩy commit, HF Spaces sẽ tự động build và chạy `Dockerfile` ở thư mục gốc.

### Bước 1: Cấu hình Spacers

Xem file `spacers.yaml` — chỉ định:
- Port 7680 (public)
- Disk: 1GB (cho SQLite + ChromaDB)
- RAM: tối thiểu 2GB

### Bước 2: Cài đặt Secrets trên HF Spaces

Trong trang Quản lý Spaces → **Secrets** → thêm:

| Secret name | Giá trị |
|---|---|
| `JWT_SECRET` | `edumap-local-dev-secret` |
| `CLOUDFLARE_API_TOKEN` | Token từ Cloudflare API |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID của bạn |
| `CLOUDFLARE_MODEL` | `@cf/meta/llama-3.1-8b-instruct-fp8,...` |
| `CLOUDFLARE_EMBEDDING_MODEL` | `@cf/baai/bge-base-en-v1.5,...` |
| `HF_TOKEN` | (tùy chọn) HF token cho fallback |
| `ORS_API_KEY` | (tùy chọn) OpenRouteService API key |

### Bước 3: Deploy

```bash
cd frontend
git remote add origin https://huggingface.co/spaces/your-username/edumap
git add -A && git commit -m "Deploy EduMap to HF Spaces"
git push
```

---

## 🔧 Các fixes đã áp dụng

### Fix 1: Cloudflare API URL Encoding (ROOT CAUSE)

**Vấn đề**: `urllib.parse.quote(model, safe='')` mã hóa cả `/` thành `%2F`, làm mất cấu trúc URL path. Cloudflare trả về `{"success":false,"errors":[{"code":7000,"message":"No route for that URI"}]}`.

**File**: `ai-service/services/llm_service.py` (dòng ~160)

```python
# TRƯỚC (lỗi):
encoded_model = urllib.parse.quote(model, safe='')
# @cf/meta/llama-3.1-8b-instruct-fp8 → %40cf%2Fmeta%2Fllama-3.1-8b-instruct-fp8
# Cloudflare: "No route for that URI" (code 7000)

# SAU (đã fix):
encoded_model = urllib.parse.quote(model, safe='/')
# @cf/meta/llama-3.1-8b-instruct-fp8 → %40cf/meta/llama-3.1-8b-instruct-fp8
# Cloudflare: ✅ Success
```

**Kiểm chứng**: Direct test Cloudflare API trả về `success: true` với phản hồi thực từ LLM.

### Fix 2: AI service PostgreSQL connection noise

**Vấn đề**: `db_service.py` cố kết nối PostgreSQL 3 lần dù `DB_TYPE=sqlite`, tạo log lỗi không cần thiết.

**File**: `ai-service/services/db_service.py`

```python
# TRƯỚC: db_service = DBService() (luôn kết nối PostgreSQL)
# SAU:
if HAS_PSYCOPG2 and os.getenv("DB_TYPE", "postgres").lower() != "sqlite":
    db_service = DBService()
else:
    db_service = None
    if os.getenv("DB_TYPE", "postgres").lower() == "sqlite":
        print("PostgreSQL disabled (DB_TYPE=sqlite) — AI service relies on backend for data access")
    else:
        print("psycopg2 not available — DBService disabled.")
```

### Fix 3: BFF chat error handling

**Vấn đề**: Khi backend trả về 401 (thiếu auth), BFF đánh giá là "lỗi kết nối" và trả về 502 — gây nhầm lẫn người dùng.

**File**: `frontend/app/api/ai/chat/route.ts`

```typescript
// TRƯỚC: luôn trả về 502 cho mọi lỗi
{ message: 'Không thể kết nối với dịch vụ AI Backend.', status: 502 }

// SAU: phân biệt 401/403 và các lỗi khác
if (response.status === 401 || response.status === 403) {
  return NextResponse.json(
    { message: 'Bạn cần đăng nhập...', error: 'AUTH_REQUIRED', ... },
    { status: response.status }  // ← 401 thực sự
  );
}
// Các lỗi khác: pass-through status code từ backend
```

### Fix 4: Sentry deprecation warning

**File**: `frontend/next.config.js`

```javascript
// TRƯỚC:
const { withSentryConfig } = require("@sentry/nextjs");      // ← deprecated

// SAU:
const { withSentryConfig } = require("@sentry/nextjs/config"); // ✅ v10+
```

### Fix 5: Dockerfile ENV defaults

Thêm env vars mặc định vào Dockerfile:

```dockerfile
ENV CLOUDFLARE_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8,@cf/google/gemma-7b-it-lora,@cf/mistralai/mistral-small-3.1-24b-instruct
ENV CLOUDFLARE_EMBEDDING_MODEL=@cf/baai/bge-base-en-v1.5,@cf/baai/bge-m3,@cf/qwen/qwen3-embedding-0.6b
```

---

## 🧪 Test Suite (đã chứng minh trên Docker)

Chạy các lệnh sau sau khi container khởi động:

| # | Test | Lệnh | Kết quả kỳ vọng |
|---|---|---|---|
| 1 | Frontend homepage | `curl -s -o /dev/null -w "%{http_code}" http://localhost:7680/` | `200` |
| 2 | Backend health | `curl http://localhost:7680/api/health` | `{"status":"ok","service":"edumap-backend"}` |
| 3 | Map POIs (SQLite) | `curl "http://localhost:7680/api/map/pois?limit=5"` | 5 items từ SQLite |
| 4 | Hackathons | `curl http://localhost:7680/api/hackathons` | 30 hackathons từ Devpost |
| 5 | AI service health | `curl http://localhost:8000/health` | `{"status":"ok","ai_ready":true,"db_ready":false}` |
| 6 | AI chat (Cloudflare) | `curl -X POST http://localhost:8000/api/ai/chat -H "Content-Type: application/json" -d '{"message":"Xin chào","history":[]}'` | `reply` chứa phản hồi thực từ LLM |
| 7 | BFF chat (401) | `curl -X POST http://localhost:7680/api/ai/chat -H "Content-Type: application/json" -d '{"message":"test","history":[]}'` | `401` + `{"error":"AUTH_REQUIRED"}` |
| 8 | BFF search (public) | `curl "http://localhost:7680/api/ai/search?q=university"` | `200` + kết quả tìm kiếm |
| 9 | Frontend map page | `curl -o /dev/null -w "%{http_code}" http://localhost:7680/map` | `200` |
| 10 | Frontend hackathon | `curl -o /dev/null -w "%{http_code}" http://localhost:7680/hackathon` | `200` |

### Kết quả test (phiên bản đã fix)

```
✅ All 10 tests passed — container restart verified (stability)
```

---

## ⚠️ Known Limitations (HF Spaces mode)

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| AI chat | ✅ Hoạt động | Cloudflare Workers AI (cần API token) |
| Map POIs | ✅ Hoạt động | SQLite, 1000+ POIs |
| Hackathons | ✅ Hoạt động | Crawled từ Devpost API |
| Geo analysis (POSTGIS) | ⚠️ Giới hạn | Cần PostgreSQL/PostGIS — trả về 503 trong SQLite mode |
| Search | ✅ Hoạt động | ChromaDB vector search |
| File upload | ⚠️ Tạm thời | Lưu vào /tmp (mất khi restart) |
| Chat history | ⚠️ Tạm thời | Lưu trong memory (không persist) |
| Career jobs | ✅ Hoạt động | Crawled từ Devpost |

---

## 📁 Cấu trúc dự án

```
EduMap/
├── Dockerfile              # Multi-stage build (frontend-builder, frontend-deps, backend-builder, ai-deps, runtime)
├── supervisord.conf      # Process manager: frontend, backend, ai-service, crawler
├── spacers.yaml          # HF Spaces app configuration (port, disk, cpu)
├── .dockerignore         # Optimized (excludes .next, dist, node_modules)
├── .env.example          # Environment variable template (secrets redacted)
│
├── frontend/             # Next.js 14 App Router (Bundled in Docker)
│   ├── app/
│   │   ├── api/          # BFF routes (auth proxy, ai/chat, ai/search, ai/learning-path)
│   │   └── ...           # Page routes (map, hackathon, career, events, etc.)
│   ├── next.config.js    # Rewrites /api → backend, Sentry config
│   └── public/
│       └── edumap.db     # SQLite database (90 tables)
│
├── backend/              # NestJS API Server
│   ├── src/
│   │   ├── app.module.ts    # ConfigModule + TypeORM + all modules
│   │   ├── config/
│   │   │   └── data-source.ts   # SQLite config (DB_TYPE=sqlite)
│   │   ├── common/
│   │   │   └── adapters/
│   │   │       └── redis-io.adapter.ts  # Socket.IO (falls back to in-memory)
│   │   ├── modules/
│   │   │   ├── ai/       # AI controller/service (proxy to FastAPI)
│   │   │   ├── map/      # Map POIs, geo routing (OpenRouteService)
│   │   │   ├── events/   # Hackathons, career events
│   │   │   ├── ...       # auth, users, materials, etc.
│   │   └── services/
│   │       └── cloudflare-ai.service.ts   # Cloudflare Workers AI integration
│   └── package.json
│
├── ai-service/           # FastAPI AI Service (thin proxy)
│   ├── main.py           # App entry — uvicorn on :8000
│   ├── services/
│   │   ├── llm_service.py       # Cloudflare + HF API proxy (URL encoding fixed)
│   │   ├── db_service.py        # PostgreSQL/PostGIS (disabled in SQLite mode)
│   │   └── vector_store.py      # ChromaDB vector store
│   ├── routers/          # chat, geo, analytics, career, suggestions
│   └── requirements.txt
│
├── scripts/
│   └── verify_db.py      # SQLite validation (90 tables check)
│
├── infrastructure/       # Docker Compose files (for local full-stack dev)
│   ├── docker-compose.yml
│   └── docker-compose.override.yml
│
└── seed_crawled_data.sql # Seed data for hackathons/career events
```

---

## 🚀 Quick Start (Local Dev)

### Docker (single container — HF Spaces config)

```bash
source .env
docker build -t edumap-hf:latest .
docker run -d --name edumap-hf \
  -p 7680:7680 -p 3000:3000 -p 8000:8000 \
  -e JWT_SECRET="$JWT_SECRET" \
  -e CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
  -e CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
  -e CLOUDFLARE_MODEL="$CLOUDFLARE_MODEL" \
  -e CLOUDFLARE_EMBEDDING_MODEL="$CLOUDFLARE_EMBEDDING_MODEL" \
  edumap-hf:latest
```

Truy cập: http://localhost:7680

### Docker Compose (full-stack local dev — PostgreSQL + Redis)

```bash
cd infrastructure
docker-compose up --build
```

---

## 📝 Environment Variables

### Dockerfile ENV (defaults — không nhạy cảm)

| Variable | Default | Mô tả |
|---|---|---|
| `DB_TYPE` | `sqlite` | Database type |
| `DB_SQLITE_PATH` | `/app/frontend/public/edumap.db` | SQLite file path |
| `BACKEND_URL` | `http://127.0.0.1:3000` | Backend API URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:7680/api` | Frontend BFF URL |
| `AI_SERVICE_URL` | `http://127.0.0.1:8000` | AI service URL |
| `OSRM_URL` | `http://127.0.0.1:8000` | Geo routing proxy |
| `CLOUDFLARE_MODEL` | `@cf/meta/llama-3.1-8b-instruct-fp8,...` | Cloudflare LLM model list |
| `CLOUDFLARE_EMBEDDING_MODEL` | `@cf/baai/bge-base-en-v1.5,...` | Cloudflare embedding model list |
| `HF_LLM_MODEL` | `mistralai/Mistral-7B-Instruct-v0.2` | HF fallback model |
| `CHROMA_DB_PATH` | `/tmp/chroma_db` | ChromaDB persistence path |
| `PYTHONPATH` | `/usr/local/lib/python3.11/site-packages` | Python path |

### Runtime Secrets (qua env vars — KHÔNG hardcode)

| Variable | Bắt buộc | Mô tả |
|---|---|---|
| `JWT_SECRET` | ✅ | JWT signing secret |
| `CLOUDFLARE_API_TOKEN` | ✅ (cho AI chat) | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ (cho AI chat) | Cloudflare account ID |
| `HF_TOKEN` | Tùy chọn | HuggingFace API token (fallback) |
| `ORS_API_KEY` | Tùy chọn | OpenRouteService API key |

---

## 🐛 Troubleshooting

### AI chat trả về "Unexpected result format"

Nguyên nhân: Model URL bị mã hóa sai (`%2F` thay vì `/`). Đã được fix từ `safe=''` → `safe='/'`.

### BFF chat trả về 502

Nguyên nhân: Backend trả về 401 (thiếu auth). Đã fix để trả về 401 với thông báo rõ ràng.

### AI service db_ready: false

Bình thường trong SQLite mode — PostgreSQL được tắt, AI service dựa vào backend để truy cập dữ liệu. Chat vẫn hoạt động vì sử dụng Cloudflare Workers AI.

### career/roadmap "gọi AI không được" (FIXED 2026-10-25)

**Root cause**: Frontend `career/roadmap/page.tsx` không gửi `Authorization: Bearer <token>` header. BFF route `/api/ai/learning-path` gọi `verifyJwt()` và trả về 401 nếu không có token.

**Fix**: Thêm `authService.getAccessToken()` + `Authorization` header, đ thứ với pattern của `ai-chat/page.tsx`.

**Thứ phụ trợ**: `_generate_text_with_fallback` trong `llm_service.py` đã đổi provider order từ OpenRouter→Cloudflare thành Gemini→OpenRouter→Cloudflare, giống `chat_with_rag`. OpenRouter + NVIDIA cũng chuyển từ `urllib.request.urlopen` → `curl --ipv4 --insecure` để tránh IPv6 blackhole trên HF Spaces.

### Library AI summary "không hiện dữ liệu" (FIXED 2026-10-25)

**Root cause**: `summarize_material` → `_generate_text_with_fallback` thử OpenRouter trước bằng `urllib.request.urlopen`, thất bại trên HF Spaces → rơi về template (degraded).

**Fix**: Như trên — Gemini được thử trước tiên, OpenRouter dùng curl.

### Deploying changes to HF Spaces

Changes are committed to the local git repository. To deploy:

```bash
# 1. Push to GitHub (triggers HF Spaces auto-rebuild if connected)
git push origin main

# 2. Or push directly to HuggingFace Hub
git remote add hf https://huggingface.co/spaces/tancse2005/Edumap
git push hf main
```

Sau khi push, HF Spaces sẽ tự động rebuild Docker image. Kiểm tra logs tại:
https://huggingface.co/spaces/tancse2005/Edumap › Settings › Logs
