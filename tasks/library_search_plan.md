# Implementation Plan: Sửa lỗi Tìm kiếm tài liệu thư viện trên HF Spaces

**Task này riêng biệt** — `plan.md` trong thư mục `tasks/` thuộc về task `predictive_service.py` (Holt's Linear Forecasting), đang được giữ lại cho một session khác.

## Overview

Dự án EduMap đã triển khai kiến trúc dual-source search (OpenLibrary primary → SQLite fallback) trong BFF route `/api/library/search`. Tuy nhiên còn **2 lỗ hổng kỹ thuật** khi chạy trên HF Spaces (SQLite mode) khiến tính năng "Tìm kiếm tài liệu thư viện" không hoạt động trọn vẹn:

1. **`seed_data()` trong `seed_vector_db.py`** — đã có hàm `get_sqlite_connection()` và `fetch_data_from_sqlite()` (được thêm vừa rồi) nhưng `seed_data()` **vẫn không gọi chúng**. Trên HF Spaces → PostgreSQL conn = None → rơi thẳng về `get_default_fallback_knowledge()` (7 docs) → **ChromaDB chỉ có 7 fallback docs, không có 188 learning_materials**. Semantic search `/api/ai/search` về thư viện sẽ trả về kết quả rất kém.

2. **`ILIKE` trong `library.service.ts:43`** — `ILIKE` là PostgreSQL-only operator → trên SQLite (HF Spaces) → `SQLITE_ERROR: near "ILIKE"` → endpoint `/api/library/search?q=...` trả về **HTTP 500**. BFF đã bypass endpoint này (dùng `/library/resources` + filter client-side), nhưng endpoint vẫn bị chết nếu gọi trực tiếp.

## Current State Verification (confirmed by reading source)

| Thành phần | File | Trạng thái |
|---|---|---|
| BFF dual-source search | `frontend/app/api/library/search/route.ts` (243 dong) | ✅ Hoạt động — OpenLibrary primary + SQLite fallback, có timeout 8s |
| Backend search (ILIKE) | `backend/src/modules/library/library.service.ts:43` | ✅ FIXED — ILIKE → LIKE + LOWER() |
| Backend findAll | `backend/src/modules/library/library.service.ts:14` | ✅ `findAndCount` → OK trên SQLite |
| DB_TYPE switching | `backend/src/app.module.ts:99` | ✅ `type: process.env.DB_TYPE === 'postgres' ? 'postgres' : 'sqlite'` |
| Seed SQLite functions | `ai-service/seed_vector_db.py:52-269` | ✅ `get_sqlite_connection()` + `fetch_data_from_sqlite()` tồn tại |
| Seed data() function | `ai-service/seed_vector_db.py:499-564` | ✅ Đã fix — thử SQLite trước, PostgreSQL, rồi mới fallback (được sửa bởi session trước) |
| Library entity | `backend/src/modules/library/entities/learning-material.entity.ts` | ✅ DB_TYPE-aware columns |
| Frontend library page | `frontend/app/library/page.tsx` | ✅ FIXED — thêm source badge, result count, fallback banner |
| data-source.ts | `backend/src/config/data-source.ts` | ⚠️ Dead code — hardcoded postgres, không dùng bởi app (config inline trong AppModule) |

## Architecture Decisions

- **ILIKE → LIKE**: Dùng `LOWER(material.title) LIKE LOWER(:query)` — chuẩn SQL, hoạt động trên cả PostgreSQL và SQLite. Giữ nguyên logic, chỉ đổi operator.
- **seed_data SQLite fallback**: Thêm 1 layer mới giữa PostgreSQL và fallback knowledge — thử PostgreSQL trư�Qc, nếu thất bại thử SQLite, chỉ rơi về fallback khi cả 2 đều thất bại.
- **UI indicator**: Thêm "source badge" + "số kết quả tìm thấy" trên trang `/library` để người dùng biết đang dùng nguồn nào.
- **data-source.ts**: Đánh dấu dead code, để cho task sau (có thể xóa nếu không import đâu).

## Task List

### Phase 1: Fix ILIKE bug trên backend
- [x] **Task 1**: Fix `ILIKE` → `LIKE` trong `library.service.ts` (dòng 43)
- [x] Verification: `npx tsc --noEmit` trong backend pass (no new errors; 2 pre-existing errors in session-memory.service.ts)

### Phase 2: Fix ChromaDB seed trên HF Spaces
- [x] **Task 2**: `seed_data()` đã được fix bởi session trước — thử SQLite trước, PostgreSQL, rồi fallback. Verified compile OK.

### Phase 3: UI indicator cho fallback mode
- [x] **Task 3**: Thêm source badge + result count + fallback banner trong `library/page.tsx`
- [x] Verification: `npx tsc --noEmit` trong frontend pass (exit code 0, no errors)

### Phase 4: Documentation & final verification
- [x] **Task 4**: Ghi chú "local only for code" trong README
- [x] **Verification**: Git diff reviewed — all changes correct, TypeScript compiles cleanly

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| ILIKE → LIKE chậm trên PostgreSQL | Low | LIKE vẫn work, chưa có index nên không khác biệt. Có thể thêm index sau nếu cần. |
| SQLite seed không đọc được bảng learning_materials | Medium | fetch_data_from_sqlite() có try/except per-table, rơi về fallback nếu lỗi |
| Thay đổi entity không match schema SQLite thực tế | High | Đã verify schema qua schema.sql + SQLite introspection (188 rows confirmed) |
| BFF fallback fetch 500 records → chậm | Low | Đã có in-memory filter + pagination, fetch một lần duy nhất |

## Open Questions (deferred)
- Có nên thêm SQLite-compatible index trên `learning_materials` để tăng tốc search? (chưa biết perf issue thực tế trên HF Spaces)
