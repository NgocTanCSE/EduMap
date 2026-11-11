# Chuyển Database từ SQLite (host) sang Supabase (PostgreSQL)

> Kế hoạch + cấu hình. DB hiện tại: `frontend/public/edumap.db` (SQLite, 1.8 MB, 98 bảng, ~4.500 dòng).

## 1. Mục tiêu

- Chuyển persistent DB từ SQLite file trong Docker image sang Supabase Postgres (free tier: 500 MB DB, 2 GB bandwidth/tháng).
- Giảm reliance vào file SQLite ephemeral trên HF; dữ liệu sống sót qua restart.
- Giữ backend (NestJS) + ai-service (FastAPI) trên HF; chỉ đổi DB backend.

## 2. Kiến trúc mục tiêu

```
Vercel (Next.js UI + BFF)
  └─ BACKEND_URL → https://<host>
        └─ host (proxy :7680 → backend :3000 / ai :8000)
              └─ Supabase Postgres (DB_TYPE=postgres)
```

ChromaDB (RAG) vẫn trên `/tmp` HF (ephemeral) — không thuộc Supabase.

## 3. Các bước thực hiện

### 3.1 Tạo project Supabase
1. Tạo project mới trên supabase.com (region gần VN: Singapore).
2. Lấy connection string: Settings → Database → Connection string (URI) → Transaction pooler (port 6543) cho serverless, hoặc direct (port 5432) cho long-lived.
3. Tạo user/password; lưu vào HF Secrets: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`.

### 3.2 Cấu hình host (Secrets)
| Secret | Value |
|---|---|
| `DB_TYPE` | `postgres` |
| `DB_HOST` | `<project>.supabase.co` (hoặc pooler host) |
| `DB_PORT` | `5432` (direct) / `6543` (pooler) |
| `DB_USERNAME` | `postgres` |
| `DB_PASSWORD` | (Supabase DB password) |
| `DB_DATABASE` | `postgres` (default Supabase DB) |
| `DB_SYNC` | `false` (bắt buộc — AGENTS.md §7) |

### 3.3 Dockerfile
- Đổi `ENV DB_TYPE=sqlite` → `ENV DB_TYPE=postgres`.
- Giữ `DB_SQLITE_PATH` làm fallback (không bắt buộc, giữ cho crawlers legacy).
- DB env vars được recover từ PID 1 environ bởi `start.sh` (đã có).

### 3.4 Chạy migrations trên Supabase
Trên máy local (chỉ chạy build/test, không run server):
```bash
cd backend
# set env vars trỏ Supabase
npm run migration:run
```
Hoặc chạy 1 lần trên HF qua exec (nếu có shell). Migrations nằm trong `backend/src/database/migrations/` (21 file).

### 3.5 Migrate dữ liệu SQLite → Supabase
Dùng script `scripts/migrate_sqlite_to_postgres.py`:
```bash
DB_TYPE=postgres DB_HOST=... DB_PORT=... DB_USERNAME=... DB_PASSWORD=... DB_DATABASE=... \
  python3 scripts/migrate_sqlite_to_postgres.py --sqlite frontend/public/edumap.db
```
Script copy từng bảng (INSERT ... ON CONFLICT DO NOTHING theo PK). Idempotent — chạy lại không trùng.

### 3.6 Crawlers
Crawlers hiện ghi SQLite trực tiếp (`sqlite3`). Hai lựa chọn:
- **A (đơn giản):** Giữ crawlers ghi SQLite trên host (ephemeral), nightly chạy `migrate_sqlite_to_postgres.py` để push lên Supabase. Dữ liệu crawl mất khi restart nhưng Supabase giữ bản cuối.
- **B (đúng):** Refactor crawlers dùng `crawlers/db_client.py` (helper psycopg2) khi `DB_TYPE=postgres`. Cần sửa từng crawler (jobs, internships, events, scholarships, map_points, ...).

Khuyến nghị: bắt đầu với A, chuyển B dần.

### 3.7 Backend bootstrap
- `ensureSqliteSchema()` đã return sớm nếu `DB_TYPE === 'postgres'` (sqlite-bootstrap.ts:165).
- `app.module.ts` đã branch Postgres/SQLite. Không đổi.

### 3.8 AGENTS.md
- §1: thêm Supabase vào deployment model (DB persistent).
- §2: diagram DB = Supabase Postgres.
- §7: env vars Supabase.

## 4. Rủi ro / lưu ý

- Supabase free tier pause sau 7 ngày không hoạt động → cần keep-alive (cron ping) hoặc nâng plan.
- Connection pooling: HF backend là long-lived → dùng direct connection (port 5432), không pooler. Nếu dùng serverless (Vercel BFF trực tiếp) → pooler (6543).
- `DB_SYNC` phải false trên Supabase (AGENTS.md §7) — schema qua migrations.
- Crawlers SQLite-centric: nếu không refactor, dữ liệu crawl chỉ tồn tại trong SQLite ephemeral; Supabase giữ snapshot cuối cùng. Chấp nhận cho free tier.
- ai-service (`/tmp/chroma_db`) vẫn ephemeral trên HF — không thuộc Supabase.

## 5. Thứ tự thực hiện

1. Tạo Supabase project + secrets HF.
2. Đổi Dockerfile `DB_TYPE=postgres`.
3. Chạy migrations (local hoặc HF exec).
4. Chạy `migrate_sqlite_to_postgres.py` để seed Supabase.
5. Deploy via the user's tooling (`git push` → host rebuild).
6. Verify: backend log `DB_TYPE=postgres`, query `/api/map/locations` trả dữ liệu, Supabase dashboard thấy rows.
7. (Tùy chọn) Refactor crawlers sang Postgres (lựa chọn B).
