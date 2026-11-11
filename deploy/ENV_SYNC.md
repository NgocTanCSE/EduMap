# Đồng bộ biến môi trường — Vercel / Render / Supabase

Cập nhật: 2026-11-11. Kiến trúc đích (không đổi):

File để copy-paste khi deploy (chỉ template, **không chứa secret**):

| Nền tảng | File |
|---|---|
| Vercel (FE + BFF) | `deploy/vercel.env.example` |
| Render `edumap-api` (Rust) | `deploy/render-api.env.example` |
| Render `edumap-ai` (FastAPI) | `deploy/render-ai.env.example` |
| Docker Compose local | `.env.example` |
| `next dev` local | `frontend/.env.example` |

```
Vercel  (Next.js 14 + BFF /app/api/**)      ← chỉ frontend, KHÔNG chạy BE
   ├─ BACKEND_URL    = https://edumap-api.onrender.com
   └─ AI_SERVICE_URL = https://edumap-ai.onrender.com

Render free (2 web service, docker)
   ├─ edumap-api  Rust/axum   :3000   /api/health
   └─ edumap-ai   FastAPI     :8000   /health

Supabase free (Postgres + PostGIS)  — pooler 6543
OSRM public https://router.project-osrm.org
```

Backend là **Rust/axum** (`backend/src`), ai-service là **FastAPI**. Cả hai là
process thường trực (connection pool, in-process cache, SSE hub, scheduler),
nên **không deploy được lên Vercel** — Vercel chỉ chạy Next.js + serverless
functions (10 s Hobby, 4.5 MB body, không WebSocket/SSE, không process nền).

---

## 1. Vercel — chỉ những biến này

| Key | Giá trị | Vì sao cần |
|---|---|---|
| `BACKEND_URL` | `https://edumap-api.onrender.com` | `next.config.js` rewrites + `src/lib/api-config.ts` (mọi BFF route) |
| `AI_SERVICE_URL` | `https://edumap-ai.onrender.com` | `app/api/ai/learning-path`, chat proxy |
| `JWT_SECRET` | **trùng y hệt** secret của `edumap-api` | `src/lib/auth-utils.ts` verify chữ ký JWT |
| `ENABLE_DEV_LOGIN` | `true` (chỉ khi cần nút dev login) | `app/api/auth/dev-login/route.ts` trả 404 nếu khác `true` ở production |
| `GOOGLE_CLIENT_ID` | client id OAuth (GIS) | `app/api/config/route.ts` → Google Identity Services |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | cùng giá trị | fallback phía client |
| `NEXT_PUBLIC_CARTO_API_KEY` | **CARTO API key** | `src/lib/map-tiles.ts` → bản `dark_nolabels` không label |
| `NEXT_PUBLIC_USE_MOCK_API` | `false` | `src/mock/install.ts` miền dữ liệu (true = mock) |
| `NEXT_PUBLIC_TOASTS_ENABLED` | `false` | `src/lib/toast.ts` + `app/layout.tsx` (bật Toaster) |
| `NEXT_PUBLIC_AI_API_URL` | `/api/ai` | `src/services/search.service.ts` fallback URL BFF |
| `ADZUNA_APP_ID` | (tuỳ chọn) | `app/api/career/jobs/route.ts` |
| `ADZUNA_APP_KEY` | (tuỳ chọn) | như trên |
| `TICKETMASTER_API_KEY` | (tuỳ chọn) | `app/api/events/route.ts` |
| `NEXT_PUBLIC_SENTRY_DSN` | (tuỳ chọn) | bật `withSentryConfig` trong `next.config.js` |

Sau khi sửa env trên Vercel **phải Redeploy** (env được nhúng lúc build).

## 2. Xoá khỏi Vercel (BE/AI-only — không file nào trong `frontend/` đọc)

`DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`,
`DB_SYNC`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`,
`DEEPSEEK_API_KEY`, `TAVILY_API_KEY`, `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `OWM_API_KEY`, `GOOGLE_TTS_API_KEY`, `HF_TOKEN`,
`ORS_API_KEY`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PROJECT_ID`,
`GOOGLE_AUTH_URI`, `GOOGLE_TOKEN_URI`, `GOOGLE_AUTH_PROVIDER_CERT_URL`.

Ghi chú: `HF_TOKEN`, `ORS_API_KEY`, `GOOGLE_*` OAuth URI/secret/project **không
được code nào dùng** (đăng nhập Google dùng `credential` GIS, chỉ cần client id;
định tuyến dùng `router.project-osrm.org`; local models đã bị xoá 2026-11-08).
Xoá hẳn khỏi mọi nơi để tránh tưởng nhầm là đang bật.

## 3. Render `edumap-api` (Rust)

| Key | Giá trị |
|---|---|
| `BACKEND_PORT` | `3000` |
| `JWT_SECRET` | **cùng giá trị với Vercel** (đừng dùng `generateValue: true`, nếu không token của BE sẽ không verify được ở FE) |
| `JWT_EXPIRES_IN` | `7d` |
| `ENABLE_DEV_LOGIN` | `true` |
| `DEV_USER_EMAIL` | `dev@edumap.vn` |
| `DB_TYPE` | `postgres` |
| `DB_SYNC` | `false` |
| `DB_HOST` | `aws-0-ap-southeast-1.pooler.supabase.com` |
| `DB_PORT` | `6543` |
| `DB_USERNAME` | `postgres.<ref>` |
| `DB_PASSWORD` | mật khẩu Supabase |
| `DB_DATABASE` | `postgres` |
| `AI_SERVICE_URL` | `http://edumap-ai:8000` (mạng nội bộ Render) |
| `ROUTING_SERVICE_URL` | `https://router.project-osrm.org` |
| `AI_SERVICE_TIMEOUT` | `45` (tuỳ chọn) |
| `SMTP_HOST` / `SMTP_PORT` | tuỳ chọn (mailer) |
| `VNP_TMN_CODE` / `VNP_HASH_SECRET` / `VNP_RETURN_URL` / `VNP_URL` | tuỳ chọn (VNPay) |
| `BING_MAPS_API_KEY` | tuỳ chọn (GeoVision tile) |
| `STORAGE_DIR` | tuỳ chọn (mặc định `/tmp/uploads`) |

## 4. Render `edumap-ai` (FastAPI)

| Key | Giá trị |
|---|---|
| `PORT` | `8000` |
| `DB_TYPE` / `DB_SYNC` | `postgres` / `false` |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` | **giống hệt** `edumap-api` |
| `CHROMA_DB_PATH` | `/tmp/chroma_db` (ephemeral) |
| `AUTO_SCHEDULER_ENABLED` | `false` trên plan 512 MB (bật lại khi nâng RAM) |
| `DEEPSEEK_API_KEY` | chính (text generation) |
| `GEMINI_API_KEY` | fallback #1 + embeddings |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | fallback cuối (thường bị chặn egress) |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | tuỳ chọn (career trends) |
| `TAVILY_API_KEY` | tuỳ chọn (crawler/search) |
| `OWM_API_KEY` | tuỳ chọn (Climate Guardian thời tiết thật) |
| `GOOGLE_TTS_API_KEY` | tuỳ chọn (Language Bridge TTS; thiếu → edge-tts → gTTS) |

## 5. Supabase

`DB_*` không đặt trên Vercel. Chỉ 2 service Render dùng, và luôn dùng host
**pooler** `...pooler.supabase.com` (direct host là IPv6 → timeout trên Render).
`DB_PORT=6543`, `DB_SYNC=false` (schema qua migrations, không `synchronize`).

## 6. Kiểm tra sau khi đồng bộ

```bash
./scripts/smoke_render.sh https://edumap-api.onrender.com https://edumap-ai.onrender.com

curl -s https://edumap-api.onrender.com/api/health
curl -s "https://edumap-api.onrender.com/api/map/pois?limit=3" | head -c 400
curl -s https://edumap-ai.onrender.com/health

# BFF trên Vercel phải đi xuyên được sang Render (200, không 404/502)
curl -s -o /dev/null -w '%{http_code}\n' https://<app>.vercel.app/api/map/pois?limit=1
```

Log mong đợi: `edumap-api` → `database pool connected`; `edumap-ai` →
`Application startup complete`.

## 7. Deploy từ GitHub Actions (2026-11-11)

file `render.yaml` chỉ định cấu hình (Blueprint). Mỗi push lên `main` kích hoạt
`.github/workflows/render-deploy.yml`: 2 job `render deploys create` (Render CLI)
→ **Render build cho bạn** (quay file ảnh docker từ `backend`/`ai-service`), sau
đó chờ service tiếp tục.

### 7.1 Secrets cần có trong GitHub repo (Settings → Secrets and variables → Actions)

| Secret | Giá trị | Lấy từ đâu |
|---|---|---|
| `RENDER_API_KEY` | `rkr_...` | Render → Account Settings → API Keys |
| `RENDER_SERVICE_ID_API` | `srv-xxxx` | dashboard `edumap-api` → Settings → URL chứa `srv-` |
| `RENDER_SERVICE_ID_AI` | `srv-xxxx` | dashboard `edumap-ai` → Settings |

### 7.2 Chuẩn bị trước khi push

1. **Tắt Auto-Deploy trong Render Dashboard** của 2 service (Settings → Build and Deploy → Auto-Deploy: OFF). Nếu không, push `main` sẽ kích hoạt cả blueprint auto-deploy và workflow → 2 build đồng thời.
2. Điền giá trị thật vào rules từ .env template, đặc biệt `DB_*`, `JWT_SECRET` (phải trùng với Vercel).

### 7.3 Sau khi push `main`

- Lên Actions tab → 2 workflow (`backend-build` green + `ci-cd` green) → `deploy` job.
- Nếu fail: step "Dump recent logs on failure" in ra 100 log cuối của cả 2 service.
- Sau khi deploy: mở link test
  - https://edumap-api.onrender.com/api/health
  - https://edumap-ai.onrender.com/health
- Xong: `./scripts/smoke_render.sh https://edumap-api.onrender.com https://edumap-ai.onrender.com`

### 7.4 Rollback / phát triển

- Chạy lại workflow từ file → "Run workflow" → chọn branch/tag commit muốn rollback.
- Dev login: bật `ENABLE_DEV_LOGIN=true` trong render.yaml (định sẵn) → tự động deploy lại (phải thay render.yaml → push).

### Tại sao không tự build + push ảnh?

Render miễn phí có một khoảnh lưu trữ riêng — workflow chỉ yêu cầu Render build lại,
không cần BuildKit/docker local (máy bạn không có tài nguyên build).
