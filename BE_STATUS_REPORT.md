# Backend Status Report — EduMap

> Phạm vi: phân tích code BE tại `backend/src` (Rust/axum). Môi trường deploy: container host (Postgres/Supabase làm DB chính). Local chỉ đọc code/test, không chạy server.
>
> Ngày phân tích: 2026-11-06. Git HEAD: `f22180e`. Working tree sạch.

## 0. Tổng quan

- Module BE: 46 (`src/modules`).
- Controller: 47 file, entity: 85 file, migration: 23 file.
- Spec test: 15 file (ai, career, community, impact-match, impact-measurement, learning-community, map ×3, mentor, opportunity, resource-exchange, scholar, cloudflare-ai).
- AI service (FastAPI) đi kèm: 34 router, 18 service, 17 model module, 36 test file.
- DB: Postgres duy nhất (`db-column.utils.ts` giờ trả trực tiếp kiểu Postgres). `synchronize = process.env.DB_SYNC === 'true'` (mặc định `false`).
- `ensureSqliteSchema()` không còn được gọi trong `main.ts`.

## 1. Rủi ro / điểm không nhất quán phát hiện

1. `TypeOrmModule.synchronize` mặc định `true` → đã sửa thành `process.env.DB_SYNC === 'false', synchronize: process.env.DB_SYNC === 'true'`. File: `backend/src/app.module.ts` (đã khớp `.env.example` `DB_SYNC=false`).
2. `notifications` service lưu thông báo trong mảng in-memory → đã sửa thành `Repository<Notification>` + `TypeOrmModule.forFeature([Notification])`. File: `backend/src/modules/notifications/`.
3. `model3d` module không có controller/service — ĐÃ XÓA (phase 1).
4. `health` module chỉ có controller, không có service. File: `backend/src/modules/health/health.controller.ts`.
5. `blockchain` là mô phỏng (mock tx hash, contract address giả) → ĐÃ GỘP vào `certificate`, response gắn `demo: true`.
6. `payment` mô phỏng (random 90% success, không gateway thật) → response gắn `demo: true`.
7. `feature`/`module` CRUD cơ bản — ĐÃ XÓA (phase 1). `role` còn lại, minimal CRUD.
8. Nhánh SQLite chết (`isSqlite`/`isPostgresNow`) — ĐÃ XÓA: `map.service.ts` (5 khối), `traffic-routing.service.ts`, `db-column.utils.ts`, và các file geo/wifi/impact-measurement.
9. `map.service.ts` ~213 dòng service + controller 671 dòng (bao gồm routing controller) → file lớn.
10. `sqlite-bootstrap.ts` dead code — ĐÃ XÓA (Postgres duy nhất).
11. `getFixedLocations()` không HTTP decorator, không caller — ĐÃ XÓA.

## 2. Trạng thái từng module

### 2.1 Nhóm Xác thực & Quản trị

**auth** — `backend/src/modules/auth/`
- Controller: `auth.controller.ts` (243 dòng). Endpoints: register, login, google, refresh, forgot-password, reset-password, change-password, 2fa/generate, 2fa/verify, me, profile (PATCH), preferences (GET/PATCH), dev-login.
- Service: `auth.service.ts` (473 dòng), `mfa.service.ts`, `role-assignment.service.ts`.
- Entity: user, user-preference, password-reset-token, audit-log, notification, support-ticket (6).
- Spec: 0.
- Trạng thái: ✅ Implemented. Dùng JWT, bcrypt, Google OAuth, MFA, password reset.

**admin** — `backend/src/modules/admin/`
- Controller: `admin.controller.ts` (101 dòng). Endpoints: dashboard, users (GET/GET:id/PUT status/DELETE/restore), content/pending, crawl-map (POST), data-quality/report (POST), question-gaps (GET), auto-scheduler/health (GET).
- Service: `admin.service.ts` (222 dòng), `backup.service.ts`.
- Entity: admin-stats, crawl-history, user-management (3).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**audit-log** — `backend/src/modules/audit-log/` (đã gộp vào admin module)
- Controller: `audit-log.controller.ts` (24 dòng). Endpoint: GET (list).
- Service: `audit-log.service.ts` (62 dòng).
- Entity: 0 (dùng entity từ auth?).
- Spec: 0.
- Trạng thái: 🟡 Minimal (chỉ GET), đã gộp vào admin module.

**role / feature / module** — `backend/src/modules/role|feature|module/`
- Controller each ~30-42 dòng. Endpoint: GET, GET:id, POST. Service: findAll, findOne, create. Không update/delete.
- Entity: 1 mỗi module.
- Trạng thái: 🟡 Minimal CRUD.

### 2.2 Nhóm Bản đồ & Geo

**map** — `backend/src/modules/map/`
- Controller: `map.controller.ts` + `routing.controller.ts` (671 dòng tổng). Endpoints: categories, climate-risk (GET), data-gaps, featured-pins, gap-forecast, locations, nl-search, poi/:id, pois (GET/POST), resource-optimization, safe-route, stats, survey/next, survey/priorities, ai-analysis (POST), climate/alternatives (POST).
- Service: `map.service.ts` (213 dòng), `routing.service.ts`, `traffic-routing.service.ts`, `flood-routing.service.ts`.
- Entity: educational-point, flood-zone, location, location-category, map-point, traffic-segment (6).
- Spec: map.service.spec, routing.service.spec, traffic-routing.service.spec (3).
- Trạng thái: ✅ Implemented (PostGIS, caching in-process, survey optimizer, climate). Nhánh `isSqlite` đã loại bỏ (geo/vision/wifi/impact-measurement); map.service.ts giữ nguyên.

**geo** — `backend/src/modules/geo/`
- Controller: `geo-vision.controller.ts` (89 dòng). Endpoints: satellite-tiles (GET), vision-detect (POST).
- Service: `geo-vision.service.ts` (508 dòng).
- Entity: 0 (dùng MapPoint).
- Spec: 0.
- Trạng thái: ✅ Implemented (HF Inference + local owlv2 fallback). isSqlite=false.

**wifi** — `backend/src/modules/wifi/`
- Controller: `wifi.controller.ts` (48 dòng). Endpoints: locations (GET/GET nearby/POST), locations/:id/speed-test (POST).
- Service: `wifi.service.ts` (172 dòng).
- Entity: wifi, wifi-connection (2).
- Spec: 0.
- Trạng thái: ✅ Implemented (PostGIS ST_DWithin).

**green** — `backend/src/modules/green/`
- Controller: `green.controller.ts` (65 dòng). Endpoints: challenges (GET), impacts (GET/POST), activities (POST).
- Service: `green.service.ts` (125 dòng).
- Entity: green, green-activity (2? green.entity + gamification green-activity).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**pin** — `backend/src/modules/pin/`
- Controller: `pin.controller.ts` (95 dòng). Endpoints: GET, GET:id, POST, PATCH:id, DELETE:id.
- Service: `pin.service.ts` (115 dòng).
- Entity: pin (1).
- Spec: 0.
- Trạng thái: ✅ Implemented (soft delete, status).

### 2.3 Nhóm AI

**ai** — `backend/src/modules/ai/`
- Controller: `ai.controller.ts` (306 dòng). Endpoints: chat, chat-stream, agent/chat, agent/chat-stream, search, trends, history, analytics/stats, career-quiz, learning-path, knowledge/* (graph/query/suggest-partners/extract/sync), language/* (simplify/translate/tts), speech/to-text, sync-knowledge.
- Service: `ai.service.ts` (186 dòng) + `session-memory.service.ts`.
- Entity: chat-history, education-stat, query-log (3).
- Spec: ai.service.spec.ts (1).
- Trạng thái: ✅ Implemented (proxy tới ai-service FastAPI; degraded SSE khi cold start).

**offline-tutor** — `backend/src/modules/offline-tutor/`
- Controller: `offline-tutor.controller.ts` (71 dòng). Endpoints: status (GET), tutor (POST).
- Service: `offline-tutor.service.ts` (225 dòng).
- Entity: 0.
- Spec: 0.
- Trạng thái: ✅ Implemented (gọi ai-service, cache in-process).

### 2.4 Nhóm Học tập & Thư viện

**library** — `backend/src/modules/library/`
- Controller: `library.controller.ts` (100 dòng). Endpoints: resources (GET/GET:id/POST), resources/:id/summary (GET), search (GET).
- Service: `library.service.ts` (101 dòng).
- Entity: learning-material, user-learning-history (2).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**scholar** (Học bổng) — `backend/src/modules/scholar/`
- Controller: `scholarship.controller.ts` (80 dòng). Endpoints: GET, GET:id, POST, PUT:id, POST:id/apply, POST:id/check-eligibility, GET me/applications.
- Service: `scholarship.service.ts` (147 dòng).
- Entity: scholarship, scholarship-application (2).
- Spec: scholarship.service.spec.ts (1).
- Trạng thái: ✅ Implemented.

**stem** — `backend/src/modules/stem/`
- Controller: `stem.controller.ts` (63 dòng). Endpoints: GET, GET labs, GET labs/nearby, POST labs, POST labs/:id/book.
- Service: `stem.service.ts` (82 dòng).
- Entity: stem (1).
- Spec: 0.
- Trạng thái: ✅ Implemented (PostGIS).

**learning-community** — `backend/src/modules/learning-community/`
- Controller: `learning-community.controller.ts` (66 dòng). Endpoints: GET nearby, GET recommend, GET :id/availability, POST, POST explain.
- Service: `learning-community.service.ts` (94 dòng) + `learning-space-recommender.service.ts`.
- Entity: learning-spot (1).
- Spec: learning-space-recommender.service.spec.ts (1).
- Trạng thái: ✅ Implemented.

**survey** — `backend/src/modules/survey/`
- Controller: `survey.controller.ts` (61 dòng). Endpoints: GET, GET:id, POST, POST:id/submit, GET:id/analytics, GET:id/export.
- Service: `survey.service.ts` (132 dòng).
- Entity: survey, survey-response (2).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**certificate** — `backend/src/modules/certificate/`
- Controller: `certificate.controller.ts` (43 dòng). Endpoints: issue (POST), verify/:code (GET), download/:code.pdf (GET), portfolio (GET).
- Service: `certificate.service.ts` (139 dòng).
- Entity: certificate-template, organization, user-certificate (3).
- Spec: 0.
- Trạng thái: ✅ Implemented (PDF generation, QR, blockchain sign).

**hs-connection** — `backend/src/modules/hs-connection/`
- Controller: `hs-connection.controller.ts` (70 dòng). Endpoints: questions (GET/POST), questions/:id/answers (POST), counseling (GET/POST), campus-tour (POST), my-network (GET), connect/:userId (POST), network/respond (POST).
- Service: `hs-connection.service.ts` (135 dòng).
- Entity: hs, hs-qa, student-connection (3).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**intl** — `backend/src/modules/intl/`
- Controller: `intl.controller.ts` (43 dòng). Endpoints: programs (GET/POST), alumni (GET/POST), alumni/nearby (GET).
- Service: `intl.service.ts` (76 dòng).
- Entity: intl (1).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**career** — `backend/src/modules/career/`
- Controller: `career.controller.ts` (237 dòng). Endpoints: paths (GET/POST/GET:id), jobs (GET/GET:id/POST/PATCH/DELETE), user-careers (GET/POST/PATCH/DELETE), user-skills (GET/POST/PATCH/DELETE), applications (GET/GET:id/POST/PATCH withdraw/PATCH status), suggest (POST), ai-advice (GET), roadmap/:id (GET), upload-resume (POST).
- Service: `career.service.ts` (517 dòng).
- Entity: career, job, user-career, user-skill, application (5).
- Spec: career.service.spec.ts (1).
- Trạng thái: ✅ Implemented.

**internship** — `backend/src/modules/internship/`
- Controller: `internship.controller.ts` (57 dòng). Endpoints: GET, GET:id, GET nearby, POST, POST:id/apply.
- Service: `internship.service.ts` (126 dòng).
- Entity: internship, application (2).
- Spec: 0.
- Trạng thái: ✅ Implemented (PostGIS).

**opportunity** — `backend/src/modules/opportunity/`
- Controller: `opportunity.controller.ts` (76 dòng). Endpoints: GET, GET:id, POST, POST:id/team-finding, POST match.
- Service: `opportunity.service.ts` (84 dòng) + `opportunity-matching.service.ts`.
- Entity: opportunity (1).
- Spec: opportunity-matching.service.spec.ts (1).
- Trạng thái: ✅ Implemented.

**mentor** — `backend/src/modules/mentor/`
- Controller: `mentor.controller.ts` (105 dòng). Endpoints: mentors (GET/GET:id), mentors/:id/slots, mentor/:mentorId/bookings, register/:userId (POST), availability (POST/GET me), book (POST), me/bookings (GET), student/:studentId/bookings (GET), bookings/:id/status (PATCH), mentors/recommend/:userId (GET).
- Service: `mentor.service.ts` (351 dòng).
- Entity: mentor, mentor-availability, mentor-relationship, mentor-session (4).
- Spec: mentor.service.spec.ts (1).
- Trạng thái: ✅ Implemented (AI matching, slots).

**community** — `backend/src/modules/community/`
- Controller: `community.controller.ts` (96 dòng). Endpoints: posts (GET/GET:id/POST), posts/:id/like (POST), posts/:id/comments (GET/POST), groups (GET/POST), groups/:id/join (POST).
- Service: `community.service.ts` (213 dòng).
- Entity: community (1).
- Spec: community.service.spec.ts (1).
- Trạng thái: ✅ Implemented (AI moderation).

### 2.5 Nhóm Cộng đồng & Kinh doanh

**business** — `backend/src/modules/business/`
- Controller: `business.controller.ts` (290 dòng). Endpoints: profile (GET/POST), verify (POST), products/services CRUD, cart (GET/add/remove/clear), checkout (POST), orders (me/vendor), reviews (GET/POST).
- Service: `business.service.ts` (418 dòng).
- Entity: business, product, service, cart-item, order, order-item, review, transaction (8).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**events** — `backend/src/modules/events/`
- Controller: `events.controller.ts` (50 dòng). Endpoints: GET, GET:id, POST, PUT:id, POST:id/register.
- Service: `events.service.ts` (161 dòng).
- Entity: event (1).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**hackathon** — `backend/src/modules/hackathon/`
- Controller: `hackathon.controller.ts` (56 dòng). Endpoints: GET, GET:id, POST register, POST teams/:teamId/submit, POST teams/:teamId/judge.
- Service: `hackathon.service.ts` (145 dòng).
- Entity: hackathon, hackathon-team (2).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**donate** — `backend/src/modules/donate/`
- Controller: `donate.controller.ts` (72 dòng). Endpoints: campaigns (GET/GET:id/GET:id/donors), POST campaigns, POST (donate), POST payment-url.
- Service: `donate.service.ts` (135 dòng), `vnpay.service.ts`.
- Entity: donation (Donation, DonationCampaign) (2).
- Spec: 0." oldString">
- Entity: donation (1) (campaign entity? donation.entity only listed; campaign likely in donate.entity? Actually entities/donation.entity.ts).
- Spec: 0.
- Trạng thái: ✅ Implemented (VNPay integration).

**volunteer** — `backend/src/modules/volunteer/`
- Controller: `volunteer.controller.ts` (29 dòng). Endpoints: activities (GET/POST).
- Service: `volunteer.service.ts` (58 dòng).
- Entity: volunteer, volunteer-hours (2).
- Spec: 0.
- Trạng thái: 🟡 Minimal.

**summer** — `backend/src/modules/summer/`
- Controller: `summer.controller.ts` (48 dòng). Endpoints: campaigns (GET/GET:id/POST), campaigns/:id/activities (POST), campaigns/:id/register (POST), registrations/:id/status (PATCH), campaigns/:id/daily-report (GET).
- Service: `summer.service.ts` (118 dòng).
- Entity: summer, summer-activity, summer-registration (3).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**gamification** — `backend/src/modules/gamification/`
- Controller: `gamification.controller.ts` (115 dòng). Endpoints: leaderboard (GET), my-badges (GET), my-progress (GET), progress/:userId (GET), grant-achievement (POST), grant-points (POST), submit-activity (POST).
- Service: `gamification.service.ts` (185 dòng).
- Entity: gamification, green-activity (2).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**share** — `backend/src/modules/share/`
- Controller: `share.controller.ts` (48 dòng). Endpoints: items (GET/POST), items/:id/request (POST), items/:id/return (POST), me/requests (GET).
- Service: `share.service.ts` (24 dòng) + `sanitize.service.ts` (DOMPurify).
- Entity: share, borrow-request (2).
- Spec: 0.
- Trạng thái: ⚠️ Service mỏng (24 dòng) — chủ yếu CRUD, sanitize tách riêng.

**storage** — `backend/src/modules/storage/`
- Controller: `storage.controller.ts` (65 dòng). Endpoints: upload (POST), my-files (GET), media/:objectName (GET), DELETE:id.
- Service: `storage.service.ts` (112 dòng).
- Entity: user-file (1).
- Spec: 0.
- Trạng thái: ✅ Implemented (filesystem local, không MinIO).

### 2.6 Nhóm Impact / Matching / Exchange (AI)

**impact-match** — `backend/src/modules/impact-match/`
- Controller: `impact-match.controller.ts` (93 dòng). Endpoints: sponsors (GET/GET:id/POST), needs (GET/GET:id/POST), rank (POST), rankings/cached (GET).
- Service: `impact-match.service.ts` (303 dòng).
- Entity: sponsor-need, sponsor-profile (3 incl index).
- Spec: impact-match.service.spec.ts (1).
- Trạng thái: ✅ Implemented (SQLite pre-filter + AI ranking).

**impact-measurement** — `backend/src/modules/impact-measurement/`
- Controller: `impact-measurement.controller.ts` (93 dòng). Endpoints: metrics (GET), measure (GET), auto-cached/:regionId (GET).
- Service: `impact-measurement.service.ts` (455 dòng).
- Entity: 0 (dùng MapPoint).
- Spec: impact-measurement.service.spec.ts (1).
- Trạng thái: ✅ Implemented (before/after diff, Wilson CI, LLM narrative).

**resource-exchange** — `backend/src/modules/resource-exchange/`
- Controller: `resource-exchange.controller.ts` (111 dòng). Endpoints: resources (GET/GET:id/POST), requests (GET/GET:id/POST), match (POST), matches (GET), cached-matches (GET), auto-health (GET).
- Service: `resource-exchange.service.ts` (455 dòng).
- Entity: resource, resource-request, resource-match (4 incl index).
- Spec: resource-exchange.service.spec.ts (1).
- Trạng thái: ✅ Implemented (pre-filter + AI ranking + transport schedule).

### 2.7 Nhóm Dữ liệu & Hạ tầng

**crawler** — `backend/src/modules/crawler/`
- Controller: `crawler.controller.ts` (51 dòng). Endpoints: status, stats, history, types (GET), trigger (POST).
- Service: `crawler.service.ts` (404 dòng).
- Entity: 0 (dùng MapPoint, LearningMaterial).
- Spec: 0.
- Trạng thái: ✅ Implemented (Overpass/OSM, cron daily). Dùng PostGIS.

**dashboard** — `backend/src/modules/dashboard/`
- Controller: `dashboard.controller.ts` (36 dòng). Endpoints: overview, stats, history, insight (GET).
- Service: `dashboard.service.ts` (197 dòng).
- Entity: 0.
- Spec: 0.
- Trạng thái: ✅ Implemented (aggregation queries).

**analytics** — `backend/src/modules/analytics/`
- Controller: `analytics.controller.ts` (31 dòng). Endpoints: track (POST), stats (GET), education (GET).
- Service: `analytics.service.ts` (64 dòng).
- Entity: user-event, education-stat (2).
- Spec: 0.
- Trạng thái: ✅ Implemented.

**bookmarks** — `backend/src/modules/bookmarks/`
- Controller: `bookmarks.controller.ts` (28 dòng). Endpoints: GET, POST.
- Service: `bookmarks.service.ts` (113 dòng).
- Entity: bookmark (1).
- Spec: 0.
- Trạng thái: ✅ Implemented (raw SQL cross-table).

**notifications** — `backend/src/modules/notifications/`
- Controller: `notifications.controller.ts` (82 dòng). Endpoints: GET, GET:userId, POST send, PUT:id/read.
- Service: `notifications.service.ts` (79 dòng) — persist DB qua `Repository<Notification>`.
- Entity: notification (1) (đã dùng).
- Spec: 0.
- Trạng thái: ✅ Implemented (persist DB, email qua MailerService).

**model3d** — `backend/src/modules/model3d/`
- Controller: không có. Service: không có. Entity: model-3d (1). Dto: có.
- Trạng thái: ❌ Incomplete (chỉ entity + dto).

**health** — `backend/src/modules/health/`
- Controller: `health.controller.ts` (23 dòng). Endpoint: health (GET).
- Service: không có.
- Trạng thái: 🟡 Minimal (controller only).

**blockchain** — `backend/src/modules/blockchain/` (đã gộp vào certificate module)
- Controller: `blockchain.controller.ts` (42 dòng). Endpoints: issue (POST), verify/:code (GET).
- Service: `blockchain.service.ts` (48 dòng) — simulation.
- Entity: 0.
- Trạng thái: ⚠️ Simulated, đã gộp vào certificate module (không còn module riêng).

**payment** — `backend/src/modules/payment/`
- Controller: `payment.controller.ts` (31 dòng). Endpoints: booking/:bookingId (POST), process/:transactionId (POST).
- Service: `payment.service.ts` (80 dòng) — random 90% success.
- Entity: 0 (dùng business/mentor entities).
- Trạng thái: ⚠️ Simulated (không gateway thật).

## 3. AI service (FastAPI) — tóm tắt

Thư mục `ai-service/`. 34 router mount trong `main.py`. Các endpoint chính:
- chat, chat-stream, agent, search, trends, analytics/stats
- knowledge/* (graph, query, suggest-partners, extract, seed, reviews)
- geo/vision-detect
- climate/risk, climate/alternatives
- language/* (simplify, translate, tts)
- speech/to-text
- talk2map, nl-search, data-hunter, data-quality
- forecast, predictive, route, survey (priorities/next)
- mentor, career, scholarship, learning-path, opportunity, resource, resource-exchange, impactmatch, impact/measure
- question-gaps, auto/* (health, regions, cached results)
- offline-tutor, library, suggestions, moderation, system/status

LLM chain: DeepSeek → Gemini → Cloudflare Workers AI → (Gemma disabled) → template. Embeddings: Cloudflare → Gemini → local SentenceTransformer. Vision: HF Inference → local owlv2. TTS: Google Cloud TTS → edge-tts → gTTS → browser fallback.

Auto-scheduler daemon: 7 tasks (chroma_seed, question_gaps, resource_exchange, impact_match, impact_measure ×5 regions, climate_risk ×5 regions, daily_insight), cache TTL 24h.

## 4. Test coverage

Backend spec (15 file):
- ai.service.spec.ts
- career.service.spec.ts
- community.service.spec.ts
- impact-match.service.spec.ts
- impact-measurement.service.spec.ts
- learning-community/learning-space-recommender.service.spec.ts
- map/map.service.spec.ts, routing.service.spec.ts, traffic-routing.service.spec.ts
- mentor.service.spec.ts
- opportunity/opportunity-matching.service.spec.ts
- resource-exchange/resource-exchange.service.spec.ts
- scholar/scholarship.service.spec.ts
- services/cloudflare-ai.service.spec.ts

AI service: 36 test file (pytest). Chạy local: `cd ai-service && python3 -m pytest tests -q`.

## 5. Kết luận trạng thái

- Hầu hết module BE đã implement đầy đủ controller + service + entity + Postgres query, tích hợp AI service.
- Các module còn minimal/incomplete: `health` (chỉ controller), `role` (chỉ CRUD cơ bản), `volunteer`, `share` (service mỏng). `model3d`/`feature`/`module` đã xóa.
- Các module mô phỏng (không tích hợp provider thật): `blockchain` (đã gộp vào `certificate`, gắn `demo: true`), `payment` (gắn `demo: true`). `notifications` đã sửa sang persist DB.
- Nhánh SQLite chết (`isSqlite`/`isPostgresNow`) đã xóa hoàn toàn; chỉ còn Postgres.
- Rủi ro deploy còn lại: `health` module không service (chỉ logger), drop bảng `features`/`modules`/`model_3d` cần migration mới (xem CLEANUP_REPORT.md §3).
- Tổng số endpoint BE: ~230+ route (theo controller decorators).

---
*Report generated from static code inspection. Runtime verification requires deploy to the host container.*
