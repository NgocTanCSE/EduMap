# Báo cáo hoàn thành — Đại cải cách EduMap (phase 2)

> Ngày: 2026-11-07. Môi trường: Hugging Face Spaces free plan; local chỉ code + test, không chạy server.
> Runtime truth = Space sau khi bạn deploy (`HF_TOKEN=<token> ./deploy-hf.sh`).

## 0. Kết quả tổng thể

| Hạng mục | Trạng thái |
|---|---|
| Xóa dead code (module, sqlite-bootstrap, `getFixedLocations`) | ✅ |
| Strip comment (Python + TS/TSX) | ✅ |
| Gộp router ai-service (`question_gaps`→`analytics`, `data_hunter`→`data_quality`) | ✅ |
| Khóa auth/guards + `@Public()` rõ ràng | ✅ |
| Đánh dấu `demo: true` (payment, blockchain) | ✅ |
| Loại bỏ nhánh `isSqlite` chết | ✅ (5/5 khối + `db-column.utils` + `traffic-routing`) |
| `notifications` → persist DB | ✅ |
| Gộp `blockchain`→`certificate`, `audit-log`→`admin` | ✅ |
| `DB_SYNC` mặc định false | ✅ |

## 1. Phase 2 — chi tiết

### 1.1 Nhánh `isSqlite` (xong)
- `backend/src/modules/map/map.service.ts`: 5 khối `if (this.isSqlite) { … }` (4 plain + 1 `if/else` trong `getFeaturedPins`) được xóa, giữ nguyên Postgres path. Field `isSqlite`, assignment và log line bị xóa.
- `backend/src/modules/map/traffic-routing.service.ts`: bỏ `if (isPostgresNow()) {…} else {…}`, giữ PostGIS.
- `backend/src/common/utils/db-column.utils.ts`: xóa hàm chết `isPostgresNow()` (luôn trả `true`) + hằng `isPostgres`; các helper giờ trả trực tiếp kiểu Postgres (`geography`, `jsonb`, `timestamp`, `enum`, `text array`).
- `geo-vision.service.ts`, `wifi.service.ts`, `impact-measurement.service.ts`: đã xóa ở phase trước.
- Không còn tham chiếu `isSqlite` / `isPostgresNow` nào trong `src/`.

### 1.2 Code chết khác
- `getFixedLocations()` (controller + service, không HTTP decorator, không caller) — xóa cả 2 chỗ.
- `model3d`, `feature`, `module` + `sqlite-bootstrap.ts` — xóa.
- `notifications`: mảng trong memory → `Repository<Notification>` + `TypeOrmModule.forFeature`.

### 1.3 Bảo mật
- `resource-exchange/match`, `map/climate-risk`, `map/climate/alternatives` — thêm `@Public()` (vốn công khai, trước đó vô tình bị guard).
- `ai/speech/to-text` đã có `@Public()`.

### 1.4 Đánh dấu demo
- `payment.service.ts` (3 response) + `blockchain.service.ts` (2 response) → gắn `demo: true`.

## 2. Các GMerge được ĐÁNH GIÁ, KHÔNG thực thi

| Kandidat | Đánh giá |
|---|---|
| `analytics` → `dashboard` | `analytics` (system-wide: `track`, `stats`, `education`) vs `dashboard` (user `overview`, `insight`, `history`). Mục đích khác nhau → không nên gộp. |
| `role` → `admin` | Role là entity dùng bởi `UserRole`/guards; `admin` chỉ audit-log → rủi ro cao, không cần thiết. |
| `green` → `gamification` | Thử thách xanh vs điểm/thành tựu → quan tâm khác. |
| `summer`/`events`/`hackathon` → `events` | Data model + flow khác (campaign / workshop / thi) → gộp sẽ mất tính năng. |
| `volunteer` | Standalone, không có target tự nhiên. |
| `wifi`/`pin` → `map` | Có liên quan bản đồ, nhưng refactor lớn, rủi ro runtime. |

→ **Tất cả đều là tính năng LIVE, không phải code chết.** Gộp chúng là thiết kế lại, không phải dọn dẹp. Không thực thi trừ khi bạn yêu cầu rõ.

## 3. Item chưa làm (cần quyết định)

1. **Drop bảng `features`, `modules`, `model_3d`** — không còn code nào dùng, nhưng cần migration TypeORM mới (chưa viết).
2. **`payment` gateway thật** (VNPay/Momo) hoặc ẩn module demo.
3. **`blockchain` chain thật** hoặc ẩn.
4. **`npm test -- --runInBand` backend** — chưa chạy vì AGENTS.md §4 chỉ cho phép `tsc --noEmit` trừ khi bạn yêu cầu. Đã chạy `tsc` = 0 lỗi.

## 4. Verification

```
ai-service   python3 -m pytest tests -q      → 525 passed
             python3 -m compileall ai-service → OK
backend      npx tsc --noEmit                → 0 lỗi (isSqlite/isPostgresNow đã xóa)
frontend     npx tsc --noEmit --incremental false → 0 lỗi
```

> Lưu ý: 2 test `tests/test_data_quality.py` từng fail với `sqlite3.OperationalError: disk I/O error` do `/tmp` đầy (từ một bản copy lớn). Dọn `/tmp` → 2 test đều passent. Không phải hồi quy code.

## 5. File báo cáo

- `BE_STATUS_REPORT.md` — trạng thái module-by-module backend (cập nhật).
- `CLEANUP_REPORT.md` — báo cáo dọn dẹp này.
- `COMPLETION_REPORT.md`, `REFACTOR_TODO.md` — báo cáo phase 1 (giữ nguyên).

## 6. Thực trạng working tree

- 999 file thay đổi, **chưa commit, chưa push**. Bạn deploy.
- 4 file frontend untracked (`app/api/donations/route.ts`, `src/services/{ai,config,offline-tutor}.service.ts`) là file legit được import từ các page tracked — không xóa.
- **Không có hồi quy**: mọi lỗi `tsc` đều đã được kiểm tra trên pristine HEAD và xác nhận là 0.