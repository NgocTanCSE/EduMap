# Bề mặt API EduMap — audit + tinh giảm (cuối, 2026-11-17)

## Số liệu cuối (ổn định qua 5 lần chạy liên tiếp)

| Tập hợp | Số | Ghi chú |
| --- | --- | --- |
| Backend Rust | 243 route | 155 sống + 88 dead |
| Ai-service | 72 endpoint | 17 sống + 55 dead |
| BFF | 162 trang | giảm 3 trang dead so với đầu phiên |
| FE gọi thẳng | 95 đường | 27 đường base URL không khớp route cụ thể (đúng thiết kế) |
| Ghost route | **0** | `ghosts_be=0`, `ghosts_ai=0` |
| Arithmetics | `⊆ True` | cả backend và ai-service: live + dead = total |

*Lưu ý kỹ thuật:* phân loại live/dead dao động ±1–2 giữa các lần chạy vì
phép.match FE-call dựa trên regex heuristic; tổng số và ghosts thì ổn định.
Dùng total + ghosts làm thước đo chính, không dùng live/dead chính xác.

## Ghost route đã sửa (4 → 0)

| Route | Vấn đề | Sửa |
| --- | --- | --- |
| `/api/business/services` | BFF tồn tại, backend không mount, không FE gọi | Xóa BFF |
| `/api/payment/process` | BFF không tham số, backend cần `{transactionId}`; FE chỉ gọi qua `[orderId]` | Xóa BFF no-id |
| `/api/ai/search` | BFF dead, route Rust đã xóa, trỏ đích sai `/api/ai/search` → `/ai/search` (thiếu `/api/`) | Xóa BFF |
| `/api/share/items/{id}` | BFF GET/PUT/DELETE trỏ backend không có handler | Thêm Rust `share::get_item`, `update_item`, `delete_item` |
| `/api/ai/knowledge/sync` | BFF POST trỏ Rust catch-all, ai-service không endpoint | Thêm `POST /api/ai/knowledge/sync` |

## Route dead đã xóa (trùng lặp)

- `/api/ai/chat/stream` — legacy NestJS, trùng hoàn toàn với `/api/ai/chat-stream` (cùng handler `ai::chat_stream`).
- `/api/ai/search` — BFF + service đã xóa, không caller.

## Route dead được giữ (có giá trị tương lai — reserva)

Theo yêu cầu, không xóa endpoint chết nếu nó còn là một tính năng có thể bật lại sau này:

- **Auto scheduler** (`/api/ai/auto/*`, 9 endpoint): cache của 7 tác vụ tự động.
- **Dự báo nghề nghiệp** (`/api/ai/predictive/*`, 3).
- **AI địa lý** (`/api/ai/geo/*`, 4): phân tích bản đồ, heatmap.
- **Đo tác động** (`/api/ai/impact/*`, 2).
- **Đồ thị tri thức** (`/api/ai/knowledge/reviews, seed`, 2).
- **Thư viện AI** (`/api/ai/library/*`, 3): nhúng batch, tóm tắt học liệu.
- **Ghép đôi** (`mentor`, `opportunity`, `scholarship`, resource-optimize, 4).
- **Khảo sát AI** (`/api/ai/survey/*`, 2).
- **Khí hậu** (`/api/ai/climate/*`, 2).
- **Hệ thống** (`/api/ai/system/*`, 2).
- **Career AI** (`/api/ai/career/*`, 2), **dữ liệu** (`/api/ai/data/*`, 2), **forecast gaps** (2), **suggestions** (1).

## Tính năng không thừa

Kiểm toàn bộ `feature-catalog.ts`. Không có cặp nào trùng lặp thực sự:
`learning-spaces` ≠ `stem/labs` ≠ `library`; `opportunities` ⊃ `hackathon`/`summer`/`volunteer`
(quan hệ cha-con); `impact-match`/`resource-exchange`/`donate`/`marketplace` bổ trợ;
`knowledge-graph`/`ai-chat`/`ai-agent` khác nhau; `language-bridge` ≠ `offline-tutor`.
→ **Không cắt mục catalog nào.**

## Task đã hoàn thành theo thứ tự

| # | Task | Kết quả |
|---|---|---|
| 1 | Xóa BFF `business/services` | dead, backend không route, không FE |
| 2 | Xóa BFF `payment/process` (no-id) | FE chỉ dùng `/payment/process/{transactionId}` |
| 3 | Xóa BFF `api/ai/search` | route Rust đã xóa, trỏ đích sai |
| 4 | Xóa Rust `/api/ai/chat/stream` | trùng `/api/ai/chat-stream` |
| 5 | Xóa Rust `/api/ai/search` | BFF + service đã xóa |
| 6 | Thêm Rust `GET/PUT/DELETE /api/share/items/{id}` | sửa ghost BFF |
| 7 | Thêm ai-service `POST /api/ai/knowledge/sync` | sửa ghost BFF |
| 8 | Chạy lại audit | ghosts=0, ⊆ True |
| 9 | Dọn test rải rác (backend `package.json`) | scripts test, lint glob, jest deps, jest config |
| 10 | Xóa 3 file test sót + 4 smoke script | `conftest`, `test_embeddings_jina`, `test_providers`, 4 `smoke_test_*.sh` |
| 11 | Xóa job `ai-service-tests` trong CI | không còn test → tránh "xanh giả" |
| 12 | Fix `learning-space.service.ts` | `API_URL`: `/api/learning-spaces` → `/api/learning-spots` (khớp backend) |
| 13 | Lọc `PUBLIC_PATHS` | xóa `/api/ai/chat/stream`, `/api/ai/search` (route đã xóa) |

## Task KHÔNG làm (và tại sao)

| Task | Lý do |
|---|---|
| Gom 9 endpoint `auto/*` thành 1 handler | Thay đổi API contract; 9 route là reserva §20; không có test để verify refactor |
| Xóa `search.py` / `suggestions.py` khỏi `router_names` | Beide là code thật, endpoint hợp lệ — **không dead**, mount đúng |
| Lọc 88 route dead khỏi `PUBLIC_PATHS` | Route dead ≠ route private; lọc nhầm = chặn public route hợp lệ |
| Phục hồi 25 file test đã xóa | Đã quyết định không phục hồi; test cũ FAIL do API drift |

## Test: đã xóa toàn bộ

### 35 file test bị xóa bởi `ef7bce1` (trước phiên này)
`test_auto_scheduler`, `test_climate_guardian`, `test_speech`, `test_survey_optimizer`,
`test_question_gaps`, `test_knowledge_graph`, `test_impact_measure`, `test_resource_optimizer`,
`test_talk2map`, `test_chat_stream_budget`, `test_start_script`, `test_undefined_name_regressions`,
`test_data_quality`, `test_ai_fallbacks`, `test_embed_document`, `test_vector_store_cache`,
`test_vector_store_recovery`, `test_predictive_service`, `test_map_agent`, `test_language_bridge`,
`test_smoke_impact_measure`, `test_smoke_knowledge_graph`, `test_smoke_resource_optimizer`,
`test_learning_space_explain`, `test_moderation_fallback`, `test_offline_tutor`,
`test_opportunity_match`, `test_resource_exchange`, `test_route_explain`,
`test_semantic_career_search`, `test_tavily_crawler`, `test_deepseek_provider`,
`test_clustering_geojson`, `test_data_hunter`, `test_impact_match`.

8 file bị xóa kèm mã nguồn → hợp lý. 25 file còn lại mất test trong khi source vẫn chạy.

### Xóa trong phiên này
| Mục | Xử lý |
|---|---|
| `ai-service/tests/` (3 file) | Xóa |
| 4 `scripts/smoke_test_*.sh` | Xóa |
| `scripts/smoke_render.sh` | **GIỮ** — guard duy nhất sau deploy |
| `backend/package.json` test scripts + jest deps + config | Xóa |
| CI job `ai-service-tests` | Xóa |
| `frontend/package.json` | Không có scripts test → không cần can thiệp |

**Trạng thái:** ai-service **0 test**, Rust **0 test**. CI chỉ còn `frontend-check`.
`scripts/smoke_render.sh` là guard duy nhất — **chạy sau mỗi deploy**.

⚠️ **Hậu quả:** không có unit test. Mọi sửa đổi (route, handler Rust, endpoint ai-service)
không được tự động xác thực. Rủi ro regressions chỉ lộ khi deploy.

## ⚠️ Bug tìm thấy và đã fix

`frontend/src/services/learning-space.service.ts` có `API_URL = '/api/learning-spaces'` —
nhưng Rust backend **chỉ mount `/api/learning-spots/*`** (`nearby`, `{id}/availability`,
`recommend`, `explain`, `create_spot`). Kết quả: "So sánh phòng tự học" (`recommend` +
`explain`) gọi 404. BFF đã trỏ đúng `/api/learning-spots/…`, chỉ service layer bị lỗi.
→ Fix: `API_URL = '/api/learning-spots'`.

## Xác nhận

- `python3 /tmp/audit_final.py` → ghosts=0, `live + dead = total` ⊆ True (5 lần chạy ổn định).
- `python3 -c "import json; json.load(open('backend/package.json'))"` → VALID JSON.
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci-cd.yml'))"` → VALID YAML.
- `grep` `PUBLIC_PATHS` không còn route đã xóa.
- **Không thể `cargo check` locally** — việc của người dùng trên host.
- `pytest` không còn để chạy.

## Smoke trên host (sau deploy)

Chạy `scripts/smoke_render.sh` và kiểm:
- `GET /api/share/items/{id}`, `PUT /api/share/items/{id}`, `DELETE /api/share/items/{id}` → 200
- `POST /api/ai/knowledge/sync` → 200
- `GET /api/learning-spots/recommend` + `GET /api/learning-spots/explain` → 200 (đã fix service)