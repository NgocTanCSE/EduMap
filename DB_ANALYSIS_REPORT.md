# EduMap — DB Analysis & Feature Status Report

> Generated from repository `/home/ngoctan/Downloads/EduMap` (branch `main`).
> Runtime target: Hugging Face Spaces free CPU tier only (`https://tancse2005-edumap.hf.space`).
> Local usage: code editing + Python unit tests only. No local npm/docker/dev servers.

## 1. Deployment model (remembered)

- Production runs only on HF Spaces Docker, free CPU basic (2 vCPU / 16 GB RAM, ephemeral disk, sleeps ~48 h).
- Local machine is code-edit + unit-test only. A local green run is never proof; verification is a request against the HF Space after deploy.
- Single container, public port 7680; internal services 3000/8000/5000; frontends reach them through the Next.js BFF, never directly.
- `/tmp` (ChromaDB, uploads, caches) is wiped on restart; features must degrade gracefully and re-seed on boot.
- All AI calls go through remote APIs (DeepSeek → Gemini → Cloudflare Workers AI) with template fallbacks; no GPU/bundled models required for core operation.
- `DB_TYPE=postgres` in production (Supabase); the bundled SQLite file is the migration/seed source and HF fallback. `DB_SYNC=false`.

## 2. Database analysis

### 2.1 Database file

- File: `frontend/public/edumap.db`
- Engine: SQLite 3
- Size: 1.8 MB
- Integrity check: `PRAGMA integrity_check` → `ok`
- Foreign key check: `PRAGMA foreign_key_check` → 0 violations
- Table count: 98 (including `sqlite_sequence`)
- Total rows across all tables: 4507
- Empty tables: 48
- Demo login accounts: 101 rows in `users` (roles distributed: donor 14, community_coord 13, admin 11, student 10, teacher 9, moderator 9, mentor 9, university_rep 7, school_rep 7, guest 7, employer 4, super_admin 1)

### 2.2 Seeded / populated tables (non-zero rows)

| Table | Rows | Notes |
|---|---:|---|
| locations | 3238 | Geographic locations (OSM/imported) |
| kg_edges | 564 | Knowledge graph edges |
| kg_nodes | 114 | Knowledge graph nodes |
| users | 101 | Demo login accounts (`@edumap.vn`) |
| education_stats | 60 | 4 metrics × 5 regions × 3 years |
| jobs | 59 | Crawled job listings |
| donations | 50 | Donation transactions |
| map_points | 46 | POIs (schools, libraries, labs, etc.) |
| mentor_availabilities | 20 | Mentor time slots |
| learning_materials | 16 | Learning resources |
| role_permissions | 13 | Role→permission mapping |
| roles | 12 | Role definitions |
| opportunities | 11 | Opportunities/events |
| scholarships | 11 | Scholarships with official URLs |
| internships | 10 | Internship positions |
| modules | 10 | Feature modules |
| permissions | 10 | Permission definitions |
| international_programs | 9 | Study-abroad/exchange programs |
| location_categories | 9 | Location category taxonomy |
| mentors | 9 | Verified mentors |
| career_paths | 8 | Career paths |
| comments | 8 | Community comments |
| features | 8 | Feature registry rows |
| map_categories | 8 | Map category taxonomy |
| donation_campaigns | 7 | Verified donation campaigns |
| posts | 7 | Community posts |
| events | 6 | Events |
| kg_extraction_review | 6 | Pending KG extractions |
| sponsor_profiles | 6 | ImpactMatch sponsor profiles |
| stem_labs | 6 | STEM labs |
| badges | 5 | Gamification badges |
| groups | 5 | Community groups |
| hackathons | 5 | Hackathons |
| learning_spots | 5 | Study spaces |
| sponsor_needs | 5 | ImpactMatch sponsor needs |
| summer_campaigns | 5 | Summer campaigns |
| flood_zones | 4 | Flood zone polygons |
| green_challenges | 4 | Green challenges |
| resource_requests | 4 | Resource exchange requests |
| resources | 4 | Resource exchange supplies |
| user_points | 3 | User gamification points |
| user_skills | 2 | User skills |
| applications | 1 | Generic application |
| certificate_templates | 1 | Certificate template |
| summer_registrations | 1 | Summer registration |
| user_careers | 1 | User career record |
| user_certificates | 1 | Issued certificate |
| user_files | 1 | Uploaded file |
| user_preferences | 1 | User preferences |

### 2.3 Empty tables (48)

`admin_stats`, `alumni_networks`, `bookmarks`, `borrow_requests`, `business_profiles`, `business_services`, `business_transactions`, `certificates`, `educational_points`, `event_registrations`, `green_activities`, `green_challenge_activities`, `hackathon_teams`, `hs_answers`, `hs_questions`, `internship_applications`, `map_reviews`, `material_ratings`, `mentor_relationships`, `mentor_sessions`, `notifications`, `order_items`, `orders`, `organizations`, `password_reset_tokens`, `pins`, `products`, `reviews`, `scholarship_applications`, `shared_items`, `student_connections`, `summer_activities`, `support_tickets`, `survey_responses`, `surveys`, `traffic_segments`, `university_counseling`, `user_badges`, `user_events`, `user_learning_history`, `user_management`, `volunteer_activities`, `volunteer_hours`, `wifi_connections`, `wifi_locations`, `chat_histories`, `query_logs`, `resource_matches`.

### 2.4 Intentionally empty by data policy (AGENTS.md §6)

- `shared_items` — user-generated, honest empty state
- `surveys` — user-generated, honest empty state
- `green_activities` — user-generated, honest empty state
- `summer_activities` — user-generated, honest empty state

All other empty tables are user-generated transactional data (applications, registrations, sessions, orders, reviews, etc.) with no seed data; UI renders empty states.

### 2.5 Knowledge graph (DB-backed AI)

- `kg_nodes`: 114, `kg_edges`: 564, `kg_extraction_review`: 6 pending.
- Source tables feeding the graph: `map_points`, `scholarships`, `opportunities`, `career_paths`, `learning_materials`, `internships`, `international_programs`, plus denormalised provider/org columns (the `organizations` table is empty).

## 3. Verification results (local, allowed)

- `python3 -m compileall -q ai-service` → OK (no syntax errors)
- `cd ai-service && python3 -m pytest tests -q` → **525 passed**, 26 warnings
- AI service test files: 36 (`ai-service/tests/`)
- Backend spec files: 25 (`backend/**/*.spec.ts`)
- Frontend test files: 0

## 4. Feature-by-feature status

Status legend: `SEEDED` = has curated rows; `EMPTY-USER` = user-generated, empty by design/normal; `EMPTY-NOSEED` = no curated rows, feature depends on it; `AI-ONLY` = no dedicated table, AI/computed.

### 4.1 Core

| Feature | Route | Frontend page | Backend controller | DB tables (rows) | Status |
|---|---|---|---|---|---|
| Bản đồ (Map Hub) | `/map` | `frontend/app/map/page.tsx` | `backend/src/modules/map/map.controller.ts`, `routing.controller.ts` | map_points(46), locations(3238), location_categories(9), map_categories(8), flood_zones(4), traffic_segments(0), wifi_locations(0), wifi_connections(0), pins(0), green_challenges(4), green_activities(0) | SEEDED (POI + locations + flood zones + green challenges); wifi/pins/traffic empty |
| Bảng điều khiển | `/dashboard` | `frontend/app/dashboard/page.tsx` | `backend/src/modules/dashboard/dashboard.controller.ts` | users(101), user_points(3), user_skills(2), user_careers(1), user_certificates(1), user_preferences(1), user_files(1), bookmarks(0), chat_histories(0), query_logs(0), user_learning_history(0), user_events(0), user_badges(0) | SEEDED (demo users); transactional user data sparse/empty |
| Tất cả tính năng | `/features` | `frontend/app/features/page.tsx` | `backend/src/modules/feature/feature.controller.ts` | features(8), modules(10), role_permissions(13) | SEEDED |

### 4.2 Tìm kiếm & Trợ lý AI

| Feature | Route | Frontend page | Backend controller | DB tables (rows) | Status |
|---|---|---|---|---|---|
| Trợ lý AI | `/ai-chat` | `frontend/app/ai-chat/page.tsx` | `backend/src/modules/ai/ai.controller.ts` | chat_histories(0), query_logs(0) | EMPTY-USER (history accumulates at runtime) |
| AI Agent bản đồ | `/map?tool=ai-agent` | `frontend/app/map/page.tsx` (tool) | `backend/src/modules/ai/ai.controller.ts`, `map/map.controller.ts` | — (AI-ONLY) | AI-ONLY |
| Talk2Map | `/map` | `frontend/app/map/page.tsx` | `backend/src/modules/map/map.controller.ts` | — (AI-ONLY) | AI-ONLY |
| Tìm bằng giọng nói | `/map?tool=voice-search` | `frontend/app/voice-search/page.tsx` | `backend/src/modules/ai/ai.controller.ts` | — (AI-ONLY) | AI-ONLY |
| Language Bridge AI | `/language-bridge` | `frontend/app/language-bridge/page.tsx` | `backend/src/modules/ai/ai.controller.ts` | — (AI-ONLY) | AI-ONLY |
| Trợ lý ngoại tuyến | `/offline-tutor` | `frontend/app/offline-tutor/page.tsx` | `backend/src/modules/offline-tutor/offline-tutor.controller.ts` | user_learning_history(0) | SEEDED/AI-ONLY (model-dependent) |
| Đồ thị tri thức AI | `/knowledge-graph` | `frontend/app/knowledge-graph/page.tsx` | `backend/src/modules/ai/ai.controller.ts` | kg_nodes(114), kg_edges(564), kg_extraction_review(6) | SEEDED |

### 4.3 Học tập

| Feature | Route | Frontend page | Backend controller | DB tables (rows) | Status |
|---|---|---|---|---|---|
| Thư viện | `/library` | `frontend/app/library/page.tsx` | `backend/src/modules/library/library.controller.ts` | learning_materials(16), borrow_requests(0), material_ratings(0) | SEEDED (16 materials); borrow/ratings EMPTY-USER |
| Học bổng | `/scholarships` | `frontend/app/scholarships/page.tsx`, `[id]/page.tsx` | `backend/src/modules/scholar/scholarship.controller.ts` | scholarships(11), scholarship_applications(0) | SEEDED (11); applications EMPTY-USER |
| Du học & Trao đổi | `/intl` | `frontend/app/intl/page.tsx` | `backend/src/modules/intl/intl.controller.ts` | international_programs(9) | SEEDED |
| STEM Labs | `/stem` | `frontend/app/stem/page.tsx` | `backend/src/modules/stem/stem.controller.ts` | stem_labs(6) | SEEDED |
| Không gian học tập | `/learning-spaces` | `frontend/app/learning-spaces/page.tsx` | `backend/src/modules/learning-community/learning-community.controller.ts` | learning_spots(5) | SEEDED |

### 4.4 Hướng nghiệp

| Feature | Route | Frontend page | Backend controller | DB tables (rows) | Status |
|---|---|---|---|---|---|
| Nghề nghiệp | `/career` | `frontend/app/career/page.tsx` | `backend/src/modules/career/career.controller.ts` | career_paths(8), user_careers(1), user_skills(2) | SEEDED |
| Lộ trình nghề | `/career/roadmap` | `frontend/app/career/roadmap/page.tsx` | `backend/src/modules/career/career.controller.ts` | career_paths(8) | SEEDED |
| Việc làm | `/career/jobs` | `frontend/app/career/jobs/page.tsx`, `[id]/page.tsx` | `backend/src/modules/career/career.controller.ts` | jobs(59) | SEEDED |
| Dự báo nghề nghiệp | `/career/predictive` | `frontend/app/career/predictive/page.tsx` | `backend/src/modules/analytics/analytics.controller.ts` | education_stats(60) | SEEDED |
| Thực tập | `/internships` | `frontend/app/internships/page.tsx`, `[id]/page.tsx` | `backend/src/modules/internship/internship.controller.ts` | internships(10), internship_applications(0) | SEEDED (10); applications EMPTY-USER |
| Cơ hội | `/opportunities` | `frontend/app/opportunities/page.tsx`, `[id]/page.tsx` | `backend/src/modules/opportunity/opportunity.controller.ts` | opportunities(11) | SEEDED |
| Opportunity Radar | `/opportunities/radar` | `frontend/app/opportunities/radar/page.tsx` | `backend/src/modules/opportunity/opportunity.controller.ts`, `ai/ai.controller.ts` | opportunities(11) | SEEDED/AI-ONLY |
| Xu hướng thị trường | `/analytics/trends` | `frontend/app/analytics/trends/page.tsx` | `backend/src/modules/analytics/analytics.controller.ts` | education_stats(60), admin_stats(0) | SEEDED |

### 4.5 Cộng đồng

| Feature | Route | Frontend page | Backend controller | DB tables (rows) | Status |
|---|---|---|---|---|---|
| Cố vấn | `/mentor` | `frontend/app/mentor/page.tsx`, `[id]/page.tsx` | `backend/src/modules/mentor/mentor.controller.ts` | mentors(9), mentor_availabilities(20), mentor_sessions(0), mentor_relationships(0) | SEEDED (9 mentors, 20 slots); sessions/relationships EMPTY-USER |
| Cộng đồng | `/community` | `frontend/app/community/page.tsx`, `post/[id]/page.tsx` | `backend/src/modules/community/community.controller.ts` | posts(7), comments(8), groups(5), notifications(0) | SEEDED |
| Kết nối THPT | `/hs-connection` | `frontend/app/hs-connection/page.tsx` | `backend/src/modules/hs-connection/hs-connection.controller.ts` | hs_questions(0), hs_answers(0), student_connections(0), university_counseling(0) | EMPTY-NOSEED (all user-generated) |
| Sự kiện | `/events` | `frontend/app/events/page.tsx`, `[id]/page.tsx`, `create/page.tsx` | `backend/src/modules/events/events.controller.ts` | events(6), event_registrations(0) | SEEDED (6); registrations EMPTY-USER |
| Hackathon | `/hackathon` | `frontend/app/hackathon/page.tsx`, `[id]/page.tsx` | `backend/src/modules/hackathon/hackathon.controller.ts` | hackathons(5), hackathon_teams(0) | SEEDED (5); teams EMPTY-USER |
| Bảng xếp hạng | `/leaderboard` | `frontend/app/leaderboard/page.tsx` | `backend/src/modules/gamification/gamification.controller.ts` | badges(5), user_badges(0), user_points(3) | SEEDED (5 badges, 3 point rows) |
| Thử thách xanh | `/green` | `frontend/app/green/page.tsx` | `backend/src/modules/green/green.controller.ts` | green_challenges(4), green_activities(0), green_challenge_activities(0) | SEEDED (4 challenges); activities EMPTY-USER (intentional) |
| Mùa hè xanh | `/summer` | `frontend/app/summer/page.tsx` | `backend/src/modules/summer/summer.controller.ts` | summer_campaigns(5), summer_activities(0), summer_registrations(1) | SEEDED (5 campaigns); activities EMPTY-USER (intentional) |
| Trạm Wifi | `/wifi` | `frontend/app/wifi/page.tsx` | `backend/src/modules/wifi/wifi.controller.ts` | wifi_locations(0), wifi_connections(0) | EMPTY-NOSEED |
| Khảo sát | `/surveys` | `frontend/app/surveys/page.tsx`, `[id]/page.tsx` | `backend/src/modules/survey/survey.controller.ts` | surveys(0), survey_responses(0) | EMPTY-USER (intentional) |
| Tình nguyện | `/volunteer` | `frontend/app/volunteer/page.tsx` | `backend/src/modules/volunteer/volunteer.controller.ts` | volunteer_activities(0), volunteer_hours(0) | EMPTY-NOSEED |

### 4.6 Chợ & Đóng góp

| Feature | Route | Frontend page | Backend controller | DB tables (rows) | Status |
|---|---|---|---|---|---|
| Chợ trao đổi | `/marketplace` | `frontend/app/marketplace/page.tsx`, `products/page.tsx`, `services/page.tsx`, `cart/page.tsx` | `backend/src/modules/business/business.controller.ts`, `storage/storage.controller.ts` | products(0), services(0), cart_items(0), orders(0), order_items(0), reviews(0), business_profiles(0), business_services(0), business_transactions(0) | EMPTY-NOSEED |
| Quyên góp | `/donate` | `frontend/app/donate/page.tsx`, `campaign/[id]/page.tsx` | `backend/src/modules/donate/donate.controller.ts` | donation_campaigns(7), donations(50) | SEEDED |
| ImpactMatch | `/impact-match` | `frontend/app/impact-match/page.tsx` | `backend/src/modules/impact-match/impact-match.controller.ts` | sponsor_profiles(6), sponsor_needs(5), resource_matches(0) | SEEDED (6 profiles, 5 needs) |
| Resource Exchange AI | `/resource-exchange` | `frontend/app/resource-exchange/page.tsx` | `backend/src/modules/resource-exchange/resource-exchange.controller.ts` | resources(4), resource_requests(4), resource_matches(0) | SEEDED (4/4); matches EMPTY-USER |
| Đo lường Tác động AI | `/dashboard/impact` | `frontend/app/dashboard/impact/page.tsx` | `backend/src/modules/impact-measurement/impact-measurement.controller.ts` | map_points(46) (computed, no dedicated table) | AI-ONLY/SEEDED (uses map_points) |

### 4.7 Admin / governance

| Feature | Route | Frontend page | Backend controller | DB tables (rows) | Status |
|---|---|---|---|---|---|
| Admin dashboard | `/admin/dashboard` | `frontend/app/admin/dashboard/page.tsx` | `backend/src/modules/admin/admin.controller.ts` | admin_stats(0), users(101) | SEEDED (users); admin_stats EMPTY |
| Admin analytics heatmap | `/admin/analytics/heatmap` | `frontend/app/admin/analytics/heatmap/page.tsx` | `backend/src/modules/analytics/analytics.controller.ts` | education_stats(60) | SEEDED |
| Admin data quality | `/admin/data-quality` | `frontend/app/admin/data-quality/page.tsx` | `backend/src/modules/admin/admin.controller.ts` | — (AI-ONLY) | AI-ONLY |
| Admin question gaps | `/admin/question-gaps` | `frontend/app/admin/question-gaps/page.tsx` | `backend/src/modules/ai/ai.controller.ts` | query_logs(0) | EMPTY-USER (accumulates at runtime) |
| Admin reports | `/admin/reports` | `frontend/app/admin/reports/page.tsx` | `backend/src/modules/admin/admin.controller.ts` | — | AI-ONLY |
| Admin roles | `/admin/roles` | `frontend/app/admin/roles/page.tsx` | `backend/src/modules/role/role.controller.ts` | roles(12), permissions(10), role_permissions(13) | SEEDED |
| Admin users | `/admin/users` | `frontend/app/admin/users/page.tsx` | `backend/src/modules/admin/admin.controller.ts` | users(101) | SEEDED |

### 4.8 Other modules / pages present

| Module / page | Frontend page | Backend controller | DB tables (rows) | Status |
|---|---|---|---|---|
| Climate Guardian | `/climate-guardian` | `frontend/app/climate-guardian/page.tsx` | `backend/src/modules/map/map.controller.ts` (climate endpoints) | flood_zones(4), traffic_segments(0) | SEEDED (4 flood zones) |
| GeoVision AI | `/map/geo-vision` | `frontend/app/map/geo-vision/page.tsx` | `backend/src/modules/geo/geo-vision.controller.ts` | map_points(46) | AI-ONLY (vision model) |
| Data Hunter | `/map/data-hunter` | `frontend/app/map/data-hunter/page.tsx` | `backend/src/modules/map/map.controller.ts` | map_points(46), locations(3238) | SEEDED |
| Gap Predictor | `/map/gap-predictor` | `frontend/app/map/gap-predictor/page.tsx` | `backend/src/modules/map/map.controller.ts` | map_points(46) | AI-ONLY |
| Resource Optimizer | `/map/resource-optimizer` | `frontend/app/map/resource-optimizer/page.tsx` | `backend/src/modules/map/map.controller.ts` | map_points(46) | AI-ONLY |
| Survey Planner | `/map/survey-planner` | `frontend/app/map/survey-planner/page.tsx` | `backend/src/modules/map/map.controller.ts` | map_points(46) | AI-ONLY (computed) |
| Certificates verify | `/certificates/verify/[code]` | `frontend/app/certificates/verify/[code]/page.tsx` | `backend/src/modules/certificate/certificate.controller.ts` | certificate_templates(1), certificates(0), user_certificates(1) | SEEDED (1 template, 1 issued) |
| Blockchain | (no dedicated page in catalog) | — | `backend/src/modules/blockchain/blockchain.controller.ts` | — | AI-ONLY/infra |
| Payment | (no dedicated page in catalog) | — | `backend/src/modules/payment/payment.controller.ts` | orders(0), transactions(0) | EMPTY-NOSEED |
| Pin | (used by map) | — | `backend/src/modules/pin/pin.controller.ts` | pins(0) | EMPTY-USER |
| Share | (used by community) | — | `backend/src/modules/share/share.controller.ts` | shared_items(0) | EMPTY-USER (intentional) |
| Storage | (used by uploads) | — | `backend/src/modules/storage/storage.controller.ts` | user_files(1) | SEEDED (1 file) |
| Notifications | (used across app) | — | `backend/src/modules/notifications/notifications.controller.ts` | notifications(0) | EMPTY-USER |
| Audit log | (admin) | — | `backend/src/modules/audit-log/audit-log.controller.ts` | (no audit_log table in DB) | AI-ONLY/infra |
| Crawler | (admin/cron) | — | `backend/src/modules/crawler/crawler.controller.ts` | crawl-history not in table list? | infra |
| Health | — | — | `backend/src/modules/health/health.controller.ts` | — | infra |

## 5. AI service (Python) inventory

- Directory: `ai-service/`
- Routers: 20+ (ai, auto, chat, climate, geo, health, impact_measure, knowledge, language, map_agent, offline, question_gaps, resource_exchange, speech, survey, system, talk2map, vector)
- Services: auto_scheduler, climate_guardian, deepseek_provider, impact_measure, knowledge_graph, language_bridge, llm_service, map_agent, memory_guard, offline_tutor, question_gap_analyzer, resource_optimizer, speech, survey_optimizer, vector_store, etc.
- Test suite: 36 files, 525 tests passing
- Compile: `python3 -m compileall -q ai-service` OK

## 6. Notable DB/code observations (factual)

- `organizations` table is empty (0 rows); knowledge graph falls back to denormalised provider/org columns in source tables.
- `wifi_locations` and `wifi_connections` are both empty (0 rows); Wifi feature has no seeded data.
- `volunteer_activities` and `volunteer_hours` are both empty (0 rows); volunteer feature has no seeded data.
- `marketplace`-related tables (`products`, `services`, `orders`, `order_items`, `cart_items`, `reviews`, `business_profiles`, `business_services`, `business_transactions`) are all empty (0 rows).
- `hs-connection`-related tables (`hs_questions`, `hs_answers`, `student_connections`, `university_counseling`) are all empty (0 rows).
- `admin_stats` is empty (0 rows) while `education_stats` has 60 rows.
- `notifications`, `bookmarks`, `pins`, `chat_histories`, `query_logs` are all empty (0 rows) — runtime/user-generated.
- `resource_matches` is empty (0 rows) while `resources` and `resource_requests` each have 4 rows.
- `mentor_sessions` and `mentor_relationships` are empty (0 rows) while `mentors`(9) and `mentor_availabilities`(20) are seeded.
- `event_registrations`, `hackathon_teams`, `internship_applications`, `scholarship_applications` are empty (0 rows) while their parent entities are seeded.
- `green_activities` and `green_challenge_activities` are empty by data policy (intentional).
- `summer_activities` is empty by data policy (intentional); `summer_registrations` has 1 row.
- `surveys` and `survey_responses` are empty by data policy (intentional).

## 7. Backend module inventory (42 modules)

`admin`, `ai`, `analytics`, `audit-log`, `auth`, `blockchain`, `bookmarks`, `business`, `career`, `certificate`, `community`, `crawler`, `dashboard`, `donate`, `events`, `feature`, `gamification`, `geo`, `green`, `hackathon`, `health`, `hs-connection`, `impact-match`, `impact-measurement`, `internship`, `intl`, `learning-community`, `library`, `map`, `mentor`, `model3d`, `module`, `notifications`, `offline-tutor`, `opportunity`, `payment`, `pin`, `resource-exchange`, `role`, `scholar`, `share`, `stem`, `storage`, `summer`, `survey`, `volunteer`, `wifi`.

## 8. Frontend page inventory (76 pages)

Listed under `frontend/app/**/page.tsx` — see section 4 for feature-to-page mapping. Additional non-feature pages: `frontend/app/page.tsx` (landing), `frontend/app/auth/*` (login/register/forgot), `frontend/app/profile/page.tsx`, `frontend/app/certificates/verify/[code]/page.tsx`, `frontend/app/admin/*`, `frontend/app/map/*` tools, `frontend/app/career/*`, `frontend/app/opportunities/*`, `frontend/app/analytics/*`.

---

*End of report. No code changes were made during this analysis; only read-only inspection and unit tests (py_compile, pytest) were run.*
PY