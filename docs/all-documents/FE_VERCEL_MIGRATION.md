# Tách Frontend từ host sang Vercel

> Kế hoạch triển khai. Runtime hiện tại: host free tier (single container, public port 7680). Mục tiêu: chuyển Next.js UI + BFF sang Vercel, giữ backend (NestJS :3000) và ai-service (FastAPI :8000) + OSRM (:5000) trên host.

## 1. Mục tiêu

- Giảm tải CPU/RAM/disk trên host free tier (bỏ Next.js build + runtime ~1 GB RAM, ~500 MB image).
- Frontend được phục vụ qua Vercel CDN/Edge, cold start nhanh hơn cho người dùng.
- Backend và ai-service vẫn chạy trên host; chỉ expose qua một proxy công khai trên port 7680.

## 2. Kiến trúc hiện tại

```
host container (public :7680)
├─ frontend  Next.js 14  :7680  (public)
├─ backend   NestJS      :3000  (internal)
├─ ai-service FastAPI    :8000  (internal)
├─ osrm      osrm-routed :5000  (internal)
└─ SQLite    frontend/public/edumap.db
```

BFF routes trong `frontend/app/api/*` gọi `getBackendUrl()` / `getAIServiceUrl()` (localhost trong container).

## 3. Kiến trúc mục tiêu

```
Vercel (Next.js 14 + BFF routes)
  └─ BACKEND_URL / AI_SERVICE_URL → https://<host>
        └─ host container (public :7680)
            ├─ proxy (Node, :7680)  ← NEW, thay Next.js
            │     /api/ai/*  → 127.0.0.1:8000
            │     /api/*    → 127.0.0.1:3000
            ├─ backend   NestJS      :3000
            ├─ ai-service FastAPI    :8000
            └─ osrm      osrm-routed :5000
```

## 4. Vấn đề cần giải quyết

- Backend (:3000) và ai-service (:8000) không public. host free tier chỉ expose 1 port (7680).
- Vercel BFF là server-side, gọi HF qua HTTPS. Không cần CORS cho browser→HF.
- SQLite (`edumap.db`) nằm trong image; backend đọc qua `DB_SQLITE_PATH`. Giữ nguyên.
- Vercel serverless có timeout (Hobby: 10s Node / 30s Edge). Chat streaming BFF dùng `fetch` + `TransformStream` — cần runtime Node và không vượt timeout.

## 5. Giải pháp: proxy công khai trên HF port 7680

Thay Next.js trên HF bằng một reverse proxy Node nhỏ (không dependency) lắng nghe :7680:

- `/api/ai/*` → `http://127.0.0.1:8000` (path giữ nguyên, ai-service routes đều có prefix `/api/ai`).
- `/api/*` → `http://127.0.0.1:3000` (backend routes đều có prefix `/api`).
- `/health` → trả `{"status":"ok"}` (cho host health check / Vercel probe).
- Tất cả path khác → 404.

File đề xuất: `backend/src/modules/proxy.rs` (rust stdlib `http`), ~80 dòng.

## 6. Các bước thực hiện (file-level)

### 6.1 Tạo proxy

- Thêm `backend/src/modules/proxy.rs` (Node-free Rust proxy, listen `0.0.0.0:7680`, routing theo prefix trên).
- Xóa `scripts/run_hf_proxy.sh` (bỏ proxy, stack chạy bản địa).

### 6.2 supervisord.conf

- Xóa `[program:frontend]` (Next.js).
- Xóa `[program:proxy]`:
  ```
  command=next start --host 0.0.0.0
  directory=/app
  autostart=true
  autorestart=true
  startsecs=2
  ```
- Giữ `[program:backend]`, `[program:ai-service]`, `[program:osrm]`, `[program:crawler]`, `[program:cron]`.

### 6.3 Dockerfile

- Xóa stage `frontend-builder`, `frontend-deps` (hoặc giữ để build locally? Không — Vercel build).
- Xóa `COPY --from=frontend-builder ...` trong runtime stage.
- Xóa `COPY frontend/ ...`, `COPY frontend/public/edumap.db ...`? Giữ copy `edumap.db` nếu backend cần path `/app/frontend/public/edumap.db` (DB_SQLITE_PATH). Đổi `DB_SQLITE_PATH` sang `/app/data/edumap.db` và copy db sang `/app/data/edumap.db`.
- Runtime image giảm ~1 GB (node_modules frontend + .next).
- Giữ Node runtime (cho proxy + backend) — backend cần Node.

### 6.4 Backend env

- `PORT=3000` (giữ).
- CORS: backend hiện không cấu hình CORS? Kiểm tra `main.ts`. BFF là server-side nên không cần CORS cho browser. Nhưng nếu có direct browser call, thêm origin Vercel. Kiểm tra `backend/src/main.ts`.

### 6.5 Vercel project

- Root directory: `frontend`.
- Build command: `npm run build` (default Next.js).
- Env vars (Production + Preview):
  - `BACKEND_URL=https://<host>`
  - `AI_SERVICE_URL=https://<host>`
  - `NEXT_PUBLIC_API_URL=https://<host>` (nếu dùng)
- Không set `BACKEND_URL` trỏ localhost.

### 6.6 Frontend code

- `getBackendUrl()` / `getAIServiceUrl()` đã normalize trailing `/api` → không đổi.
- BFF routes đã proxy qua backend/ai-service → không đổi.
- Kiểm tra direct fetch tới host trong frontend (OSRM, images). Hiện tại dùng BFF `/api/map/*` → OK.

### 6.7 DB path

- Đổi `DB_SQLITE_PATH` default từ `/app/frontend/public/edumap.db` sang `/app/data/edumap.db`.
- Dockerfile runtime: `COPY frontend/public/edumap.db /app/data/edumap.db`.
- Cập nhật `AGENTS.md` §2 và §7.

## 7. Biến môi trường Vercel

| Var | Value |
|---|---|
| `BACKEND_URL` | `https://<host>` |
| `AI_SERVICE_URL` | `https://<host>` |

## 8. Kiểm chứng sau deploy

1. host log: `proxy` listening on :7680; `backend` + `ai-service` started; không có `ECONNREFUSED`.
2. `curl -s https://<host>/health` → `{"status":"ok"}`.
3. `curl -s -o /dev/null -w '%{http_code}' https://<host>/api/ai/health` → 200 (hoặc degraded, không 502/503).
4. Vercel deploy thành công; mở URL Vercel, gửi 1 câu hỏi trên `/ai-chat` → nhận trả lời (không phải template degraded).
5. host RAM usage giảm (không còn Next.js). Kiểm tra qua `/api/ai/system/status` (qua proxy).

## 9. Rủi ro / lưu ý

- Vercel Hobby function timeout 10s: chat streaming có thể bị cắt nếu backend chậm. Cân nhắc Edge runtime cho `chat-stream` route hoặc tăng `maxDuration` (Pro). AGENTS §13 đã có budget 10s — khớp.
- host free tier sleep sau 48h inactivity → Vercel BFF gọi HF sẽ nhận cold start (ECONNREFUSED) → backend degraded reply (đã có). Chấp nhận.
- SQLite ghi trên host ephemeral: crawler nightly ghi vào `/app/data/edumap.db` (writable trong container) nhưng mất khi restart. Hiện tại cũng mất (`/tmp`? không — edumap.db trong image là read-only-ish, crawler ghi vào image copy trong container → ephemeral). Không thay đổi hành vi này.
- Không deploy FE lên Vercel nếu backend vẫn localhost-only — phải hoàn thành 6.1–6.3 trước.

## 10. Thứ tự thực hiện

1. 6.1 proxy + 6.2 supervisord + 6.3 Dockerfile (host side) — commit + deploy.
2. Verify 8.1–8.3 trên host.
3. 6.5 Vercel env + deploy frontend.
4. Verify 8.4–8.5.
5. Cập nhật AGENTS.md §2 architecture diagram + §7 env.
