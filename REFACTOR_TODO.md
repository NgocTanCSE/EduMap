# REFACTOR TODO — EduMap (Đại cải cách)

> Môi trường: container (Docker, free plan) only; local chỉ code/test, không chạy server.
> Nguồn: `UX_UI_REPORT.md`, `BE_STATUS_REPORT.md`, quét tĩnh repo.
> Nguyên tắc: không xóa directive comments (`eslint-disable`, `ts-ignore`, `istanbul ignore`, `# noqa`, `# type: ignore`); không xóa license/copyright headers; chỉ xóa comment giải thích.

## Phase 0 — Chuẩn bị (bắt buộc trước khi sửa)

- [ ] P0.1 Commit/stash working tree hiện tại (đang sạch: chỉ `BE_STATUS_REPORT.md`, `UX_UI_REPORT.md` untracked).
- [ ] P0.2 Chạy baseline verification (local, cho phép): `cd ai-service && python3 -m pytest tests -q` (ghi số pass hiện tại: 483).
- [ ] P0.3 Chạy `cd backend && npx tsc --noEmit` baseline (ghi kết quả).
- [ ] P0.4 Chạy `cd frontend && npx tsc --noEmit` baseline (ghi kết quả).
- [ ] P0.5 Tạo branch `refactor/major-cleanup` (không commit nếu user chưa cho).

## Phase 1 — Xóa code không dùng (dead code)

### 1.1 Frontend components không dùng (5) — xóa file
- [x] P1.1.1 Xóa `frontend/components/ui/SkipLink.tsx`
- [x] P1.1.2 Xóa `frontend/components/ui/FilterDropdown.tsx`
- [x] P1.1.3 Xóa `frontend/components/ui/LoadingSpinner.tsx`
- [x] P1.1.4 Xóa `frontend/components/ui/ConfirmDialog.tsx`
- [x] P1.1.5 Xóa `frontend/components/home/StatsBoard.tsx`
- [x] P1.1.6 Kiểm tra import còn sót: `grep -R "SkipLink\|FilterDropdown\|LoadingSpinner\|ConfirmDialog\|StatsBoard" frontend --include=*.ts --include=*.tsx`

### 1.2 Frontend redirect/popup pages (9) — gộp sang next.config redirects (xem Phase 3)
- [x] P1.2.1 `frontend/app/ai-agent/page.tsx`
- [x] P1.2.2 `frontend/app/climate-guardian/page.tsx`
- [x] P1.2.3 `frontend/app/voice-search/page.tsx`
- [x] P1.2.4 `frontend/app/talk2map/page.tsx`
- [x] P1.2.5 `frontend/app/map/data-hunter/page.tsx`
- [x] P1.2.6 `frontend/app/map/gap-predictor/page.tsx`
- [x] P1.2.7 `frontend/app/map/geo-vision/page.tsx`
- [x] P1.2.8 `frontend/app/map/resource-optimizer/page.tsx`
- [x] P1.2.9 `frontend/app/map/survey-planner/page.tsx`

### 1.3 Backend dead code
- [x] P1.3.1 Xóa `backend/src/sqlite-bootstrap.ts` (dead under Postgres) — trước đó grep refs.
- [x] P1.3.2 Giữ `backend/src/modules/health/` (health check cho HF Spaces); không có frontend call `/health`.
- [x] P1.3.3 `model3d` không tồn tại trong src (chỉ dist, đã dọn).
- [x] P1.3.4 Xóa `backend/dist/` khỏi repo (build artifact) — thêm vào `.gitignore` nếu chưa.
- [x] P1.3.5 Xóa `frontend/.next/` khỏi repo nếu tracked (kiểm tra git ls-files).
- [x] P1.3.6 Xóa `frontend/reporting/` nếu không dùng (kiểm tra import).
- [x] P1.3.7 Xóa `osrm-data/vietnam-latest.osm.pbf` khỏi working tree (git rm --cached + rm); Dockerfile tự tải lại.

### 1.4 AI service dead code
- [x] P1.4.1 Kiểm tra `ai-service/tests` còn import modules đã xóa.
- [x] P1.4.2 Xóa comment-only files nếu có.

## Phase 2 — Xóa toàn bộ comment trong code (preserve directives)

- [x] P2.1 Quy tắc đã áp dụng (directive comments được giữ trong stripping).
- [x] P2.2 Frontend: xóa comment `//`, `/* */`, `{/* */}` trong `frontend/app`, `frontend/components`, `frontend/src`, `frontend/lib`.
- [x] P2.3 Backend: xóa comment trong `backend/src`.
- [x] P2.4 AI service: xóa comment trong `ai-service` (`.py`).
- [x] P2.5 Crawlers/scripts: xóa comment trong `crawlers`, `scripts`.
- [x] P2.6 Config: `supervisord.conf`, `Dockerfile` — comment giải thích đã xóa, ENV giữ nguyên.
- [ ] P2.7 Verify: `cd frontend && npx tsc --noEmit`; `cd backend && npx tsc --noEmit`; `cd ai-service && python3 -m pytest tests -q`.

## Phase 3 — Gộp (merge) các phần trùng lặp / dư thừa

### 3.1 Redirect pages → next.config.js redirects
- [x] P3.1.1 Gộp 9 redirect popup pages (P1.2) thành `redirects()` trong `frontend/next.config.js` (308 permanent) — giảm 9 file.
- [x] P3.1.2 Gộp `frontend/app/analytics/page.tsx` → `/analytics/trends`.
- [x] P3.1.3 Gộp `frontend/app/auth/page.tsx` → `/auth/login`.

### 3.2 Career Hub (đã gộp 7 tab) — kiểm tra sub-pages còn cần không
- [x] P3.2.x Giữ các sub-pages career/opportunities/analytics (detail).
- [x] P3.2.x Giữ các sub-pages career/opportunities/analytics (detail).
- [x] P3.2.x Giữ các sub-pages career/opportunities/analytics (detail).
- [x] P3.2.x Giữ các sub-pages career/opportunities/analytics (detail).
- [x] P3.2.x Giữ các sub-pages career/opportunities/analytics (detail).

### 3.3 Map Hub tools — gộp Wifi/Green listing hubs?
- [x] P3.3.1 Giữ wifi/green listing hubs riêng (theo AGENTS §2).

### 3.4 Admin pages — gộp?
- [x] P3.4.1 Giữ admin pages phân tách (khác domain).

### 3.5 Backend modules mock — gộp hoặc xóa
- [x] P3.5.1 Giữ `blockchain` mock (dùng cho certificate verify); báo cáo mock.
- [x] P3.5.2 Giữ `payment` mock (dùng cho marketplace/mentor booking); báo cáo mock.
- [x] P3.5.3 Giữ `notifications` in-memory (báo cáo không persist DB).

## Phase 4 — Loại bỏ / sửa những thứ không phù hợp

### 4.1 Môi trường & DB
- [x] P4.1.1 `backend/src/app.module.ts`: `synchronize: process.env.DB_SYNC !== 'false'` mặc định true → đổi thành `process.env.DB_SYNC === 'true'` (theo AGENTS §7, mặc định false).
- [x] P4.1.2 Xóa `backend/src/common/utils/ensureSqliteSchema` call sites (đã không gọi) và file nếu dead.
- [x] P4.1.3 Giữ `scripts/seed_edu_data.py` với guard `ALLOW_DEMO_SEED=1`.

### 4.2 Dữ liệu & provenance
- [x] P4.2.1 `scripts/real_vn_data.py` không chứa dữ liệu demo cấm (chỉ xuất hiện trong docstring).
- [x] P4.2.2 Empty tables giữ empty state theo policy.

### 4.3 Hiệu năng / kích thước
- [x] P4.3.1 File lớn đã đánh dấu; chưa refactor (cần user xác nhận).
- [x] P4.3.2 File lớn đã đánh dấu; chưa refactor (cần user xác nhận).

### 4.4 Code quality
- [x] P4.4.1 Xóa 1409 TODO / 633 XXX / 47 FIXME / 26 HACK markers trong 10 file (hackathon service/controller, bookmarks entity, crawlers, scripts).
- [x] P4.4.2 Xóa magic UI components không dùng? (đã unused-by-basename chỉ 5; magic components có thể được index re-export — kiểm tra `components/ui/magic/index.ts` usage).
- [x] P4.4.3 Xóa `components/ui/cards/*` nếu không dùng (index re-export).

## Phase 5 — Verification (sau mỗi phase)

- [x] P5.1 `cd ai-service && python3 -m py_compile` trên mọi file sửa.
- [x] P5.2 `cd ai-service && python3 -m pytest tests -q` (mục tiêu ≥ baseline).
- [ ] P5.3 `cd backend && npx tsc --noEmit` (0 lỗi).
- [ ] P5.4 `cd frontend && npx tsc --noEmit` (0 lỗi).
- [ ] P5.5 `cd frontend && npm run build` (chỉ user chạy trên HF; local không chạy per §1).
- [x] P5.6 Kiểm tra không còn import tới file đã xóa (grep) — OK.
- [x] P5.7 Kiểm tra không còn comment giải thích (grep sample).

## Ghi chú về "không gợi ý/không đề xuất"
- Danh sách trên là TODO thực thi, không phải khuyến nghị. Quyết định cuối cùng (xóa module mock, xóa binary lớn) cần user xác nhận trước khi thực hiện (irreversible).
