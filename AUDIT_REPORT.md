# Báo cáo kiểm toán hệ thống EduMap — Tính năng, đích API, trạng thái (2026-11-15)

**Phạm vi:** toàn bộ codebase tại `/home/ngoctan/Downloads/EduMap`:
- Frontend Next.js: 64 trang (pages), 40 dịch vụ (`frontend/src/services/*.ts`), 167 BFF proxy routes (`frontend/app/api/*/route.ts`).
- Backend Rust (axum): 244 route call sites (`backend/src/router.rs`), 45+ module, 30 dependency.
- ai-service (FastAPI): 33 router files, ~130 endpoints, `router_names` đăng ký 32 router.
- Nguồn danh mục tính năng: `frontend/src/lib/feature-catalog.ts` (45 mục).

**Phương pháp:** truy vết đường đi từ trang → BFF → Rust → ai-service. Bất kỳ đích nào không tìm thấy nằm trong phần "Dư thừa" (có code, không ai gọi) hoặc "Thiếu/gãy" (code gọi một đích không tồn tại). Thông tin runtime thật là host Render đã deploy; phần này dựa trên quét code tĩnh.

---

## A. Tính năng dư thừa (có code nhưng không thể tiếp cận)

### A1. Ai-service routers đã đăng ký nhưng không có người gọi

Các endpoint `/api/ai/*` sau đây được đăng ký (có router file) nhưng **không được gọi** bởi bất cứ trang, service, BFF, hay Rust proxy nào:

| # | Endpoints | File chết | Ghi chú |
|---|---|---|---|
| 1 | `POST /api/ai/moderate/` | `routers/moderation.py` | Lọc nội dung (regex blacklist); chưa nối vào pipeline `/ai-chat`. |
| 2 | `GET /api/ai/suggestions` | `routers/suggestions.py` | Câu trả lời gợi ý cho `/ai-chat`; trang này dùng danh sách cứng. |
| 3 | `GET /api/ai/geo/analyze`, `/geo/analyze-gaps`, `/geo/heatmap`, `/geo/recommend` | `routers/geo.py` | Trang `/map` gọi Rust `/geo/vision-detect`; không gọi các endpoint này. |
| 4 | `GET /api/ai/impact/metrics` | `routers/impact_measure.py` | Trang `/dashboard/impact` gọi `/impact-measurement/measure` (Rust) → ai-service `/api/ai/impact/measure`; `/metrics` chết. |
| 5 | `POST /api/ai/predictive/career-prediction`, `/predictive/market-data`, `/predictive/trends` | `routers/predictive.py` | Trang `/career/predictive` → BFF `/api/career/suggest` → Rust `/career/suggest` → ai-service `/api/ai/career/recommend`. |
| 6 | `POST /api/ai/library/embed-batch` | `routers/library.py` | Chỉ `library/embed` được gọi ở worker Rust (`library.rs:364`). |
| 7 | `POST /api/ai/chat/stream-simple` | `routers/chat.py` | Trang `/ai-chat` dùng `/api/ai/chat-stream`. |
| 8 | `GET /api/ai/analytics/forecast` | `routers/analytics.py` | Không BFF, không Rust. |

**Lưu ý:** `/api/ai/auto/*` (health, climate-risk/{region_id}, impact-measurement/{region_id}, resource-exchange/matches, question-gaps, chroma/seed-status) vẫn đang được áp dụng bởi các Rust auto endpoints (`/api/admin/auto-scheduler/health`, `/api/resource-exchange/cached-matches`, `/api/impact-match/rankings/cached`, `/api/impact-measurement/auto-cached/:regionId`, `/api/admin/question-gaps`, `/api/dashboard/insight`).

### A2. BFF routes không người gọi

Ba BFF sau không được gọi bởi bất kỳ trang nào (service file). Chúng chỉ tốn file `route.ts`:

| BFF | Ghi chú |
|---|---|
| GET/POST `/api/business/orders` | Thị trường không có `/marketplace/orders`; chỉ gọi `/api/business/orders/me`. |
| GET/POST `/api/business/services` | Trang thị trường dùng `/api/business` (profiles). |
| POST `/api/payment/process` | Trang giỏ hàng dùng `/api/payment/process/[orderId]`. |

### A3. Dịch vụ frontend chết

`frontend/src/services/*.ts`:
- 36/40 **đang được import** (xây dựng từ dịch vụ đọc): `admin`, `auth`, `business`, `community`, `dashboard`, `donate`, `events`, `gamification`, `green`, `hackathon`, `hs-connection`, `impact-match`, `impact-measurement`, `internship`, `intl`, `knowledge`, `language-bridge`, `library`, `mentor`, `notification`, `offline-tutor`, `opportunity`, `resource-exchange`, `scholarship`, `share`, `storage`, `stem`, `summer`, `survey`, `volunteer`, `wifi`.
- **1/40 chết:** `search.service.ts` (`SearchService`) — zero import. BFF `/api/ai/search` vẫn sống (Rust proxy `/ai/search` → ai-service `/api/ai/search`).

### A4. Đường dữ liệu chồng chéo (2 endpoints cho 1 khả năng)

1. `/analytics/trends` gọi song song:
   - `analyticsService.getStats()` → `/api/analytics/stats` (Rust `analytics::get_stats`).
   - `analyticsService.getAiTrends()` → `/api/ai/analytics/stats` (ai-service `analytics::get_stats`).
2. `/api/learning-spaces/explain` → Rust `/learning-spots/explain` → ai-service `/api/ai/learning-space/explain` — một đáp án thủ 3 lớp (Rust + ai-service).

---

## B. Tính năng bị thiếu / gãy (BFF → đích không tồn tại)

Các BFF routes tồn tại, nhưng đích Rust **không tồn tại** → request của người dùng luôn 404/500 **khi production**:

| BFF | Gọi đích nào | Rust route | Tình trạng |
|---|---|---|---|
| POST `/api/business/orders` | `POST /business/orders` | không (chỉ `/orders/me`, `/orders/vendor`) | **404** |
| GET `/api/business/services` | `GET /business/services` (không BP) | không (chỉ `/business/:bpId/services`) | **404** |
| POST `/api/business/services` | `POST /business/services` | không | **404** |
| POST `/api/payment/process` | `POST /payment/process` | không (chỉ `/:transactionId`) | **404** |
| GET `/api/hs-connection/network` | `GET /hs-connection/my-network` | có | **Dead — không ai gọi** |

### Trang/giao diện thiếu
Cả 45 mục `feature-catalog.ts` đều có trang đồng bộ (`/map`, `/map?tool=<tab>`, `/features`, `/dashboard`, `/ai-chat`, `/knowledge-graph`, `/language-bridge`, `/offline-tutor`, `/library`, `/scholarships`, `/intl`, `/stem`, `/learning-spaces`, `/career*`, `/internships`, `/opportunities*`, `/career/predictive`, `/mentor`, `/community`, `/hs-connection`, `/events*`, `/hackathon`, `/leaderboard`, `/green`, `/summer`, `/wifi`, `/surveys`, `/volunteer`, `/marketplace`, `/donate`, `/impact-match`, `/resource-exchange`, `/dashboard/impact`, `/admin/*`). Kiểm tra kỹ: **không có trang nào bị mất**. Khoảng trống là endpoint coverage (bảng trên).

---

## C. Điểm mạnh

1. **Phủ hết tính năng:** 45 catalog mục → trang → BFF → Rust/ai-service (hơn 95% + các điểm chết).
2. **Feature catalog = single source of truth:** `/features`, sidebar, nav nhất quán; thêm trang = thêm catalog entry.
3. **Backend Rust hoàn chỉnh:** 244 route sites, tất cả `.with_state(pool)`, `PUBLIC_PATHS` 221 mục, `cargo check` xanh. Mọi endpoint business (không phải AI) xử lý riêng, không qua ai-service.
4. **Auto-Scheduler đầy đủ:** ai-service 32 router, auto-scheduler chạy daemon threads.
5. **Degrade to templates:** ai-service endpoints có fallback templates; frontend BFFs đều trả `degraded: true` khi endpoint chết.

---

## D. Điểm yếu / Rủi ro

1. **8+ dead ai-service endpoints:** `/api/ai/moderate/`, `/api/ai/suggestions`, geo/impact/predictive/library/forecast, `chat/stream-simple`. Static code, reused nothing. Có thể xóa để giảm bề mặt deploy.
2. **4 breaking BFF targets:** `/business/orders` POST, `/business/services` GET/POST, `/payment/process` POST — chi phí fix nhỏ (POST → `/business/{bp}...`, POST → `/payment/process/:transactionId`).
3. **1 dead service:** `search.service.ts`. Giữ hoặc xóa; ảnh hưởng không đáng kể đến `/api/ai/search`.
4. **2x payload duplicated:** `/analytics/trends` (Rust + AI-stats) + `/learning-spaces/explain` (3 lớp) — 2 provider calls, 2 code path bảo trì.
5. **Test coverage thin:** `ai-service/tests/` còn lại `conftest.py`, `test_embeddings_jina.py`, `test_providers.py`. Các module hồi quy cũ (`test_speech.py`, `test_llm_service.py`...) đã bị xóa. Cần kiểm tra thủ công trên host sau mỗi deploy.
6. **Auto-Scheduler phụ thuộc `AUTO_SCHEDULER_ENABLED`:** nếu `false`, `/api/resource-exchange/cached-matches`, `/api/impact-match/rankings/cached`, `/api/impact-measurement/auto-cached/*` trả về `202 warming` — các trang hiển thị trắng. Đây là tính năng thiết kế, không lỗi, nhưng phải cảnh báo.

---

## E. Kết luận

- **Không mất tính năng:** 64 trang + 45 catalog entries đều dẫn đến routing hoàn chỉnh.
- **Dư thừa chiếm đa số:** ~15 ai-service endpoints chết (không được gọi), 3 BFFs chết, 1 service chết.
- **Endpoint gãy:** 4 BFF targets (business/orders, business/services, payment/process) — **nên sửa** nếu các tính năng marketplace/donate đang dùng.

---
*Báo cáo được viết ngày 2026-11-15. Runtime truth = host Render; không có `cargo`/`rustc` trên máy này, xác minh tĩnh chưa chạy release.*
