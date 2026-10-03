# KẾ HOẠCH HOÀN THIỆN DỰ ÁN EDUMAP

## PHẢN ÁNH HIỆN TRẠNG DỰ ÁN (ĐỘ HOÀN THIỆN TỔNG THỂ: ~72%)

---

## 1. ĐÁNH GIÁ HIỆN TRẠNG CHI TIẾT

### 1.1 DATABASE (Độ hoàn thiện: ~85%)

**Đã có:**
- PostgreSQL 16 + PostGIS extension được cấu hình trong docker-compose.yml
- Schema SQL đầy đủ (~50 bảng) trong backend/src/database/schema.sql
- Các bảng chính: users, roles, permissions, map_points, learning_materials, events, opportunities, ai_conversations, ai_messages, badges, user_badges, user_points, groups, posts, comments, mentors, bookings, donation_campaigns, donations, volunteer_activities, certificates, surveys, survey_responses, notifications, green_challenges, green_activities, career_paths, wifi_locations, stem_labs, chat_messages, audit_logs, education_stats, user_learning_history, support_tickets, internships, shared_items, borrow_requests, location_categories, locations, scholarships, jobs, user_careers, user_skills, applications, business_profiles, products, business_services, international_programs, alumni_networks
- Migration files: 1779564533609-InitialProductionSchema.ts, 1790000000000-AddAdditionalTables.ts
- Seed scripts: seed-db.ts, seed.sql, seed_analytics.sql, seed_career_paths.sql, seed_gamification.sql, seed_scholarships.sql
- Crawled data seed: seed_crawled_data.sql, seed_crawled_data_new.sql (43 map_points + 80 learning_materials)
- Data source config: backend/src/config/data-source.ts

**Thiếu/Chưa hoàn thiện:**
- Một số migration có thể chưa được chạy hoặc chưa kiểm tra đầy đủ
- Chưa có script seed dữ liệu mẫu toàn diện cho tất cả modules (một số module thiếu seed data)
- Chưa kiểm tra index performance trên các bảng lớn
- optimize_indexes.sql có nhưng chưa chắc đã áp dụng

### 1.2 BACKEND - NESTJS API (Độ hoàn thiện: ~80%)

**Đã có:**
- 38 modules hoàn chỉnh với controller, service, DTO, entity
- API prefix /api
- Swagger documentation tại /api/docs
- JWT Authentication + Roles guard
- Security: Helmet, CORS, Throttler, CSRF
- Redis cache, Bull queue, Socket.io
- Mailer với Handlebars template
- Firebase integration
- Sentry error tracking
- 24/38 modules có unit tests (~63%)

**Modules có test (24):**
analytics, auth, business, career, certificate, community, donate, events, feature, green, hackathon, library, mentor, mobile-config, module, notifications, opportunity, role, share, stem, storage, survey, volunteer, wifi

**Modules thiếu test (14):**
admin, ai, audit-log, blockchain, crawler, dashboard, gamification, hs-connection, internship, intl, learning-community, map, payment, scholar, summer

**Thiếu/Chưa hoàn thiện:**
- 14 modules chưa có unit test (~37%)
- Một số module có thể cần integration test
- Chưa có E2E test tự động chạy (chỉ có spec files)
- Payment module thiếu service spec
- Chưa có error boundary handling chuẩn hóa

### 1.3 AI SERVICE - PYTHON FASTAPI (Độ hoàn thiện: ~75%)

**Đã có:**
- FastAPI app với 12 routers: analytics, career, chat, geo, learning_path, library, mentor, moderation, predictive, scholarship, search, suggestions
- 10 model files (analytics_models, career_models, chat_models, geo_models, learning_models, library_models, mentor_models, moderation_models, scholarship_models, search_models)
- 6 services: cache_service, clustering_service, db_service, llm_service, predictive_service, vector_store
- 4 test files: test_cache_service, test_db_service, test_llm_service, test_vector_store
- Gemini Pro integration
- ChromaDB vector store
- Redis cache

**Thiếu/Chưa hoàn thiện:**
- Chỉ có 4 test files cho 6 services (thiếu test cho clustering_service, llm_service, predictive_service)
- Chưa có test cho routers
- Chưa có test cho models
- Vector DB seeding script (seed_vector_db.py) có nhưng chưa chắc đã chạy
- Một số routers có thể thiếu error handling

### 1.4 API LAYER - NEXT.JS API ROUTES (Độ hoàn thiện: ~70%)

**Đã có:**
- ~50 API route files trong frontend/app/api/
- Các route nhóm: admin, ai, analytics, auth, career, community, dashboard, donations, events, gamification, green, hackathons, internships, leaderboard, library, map, mentoring, notifications, roles, scholarships, stem, summer-campaigns, wifi
- Token forwarding từ Next.js sang Backend

**Thiếu/Chưa hoàn thiện:**
- Backend URL hardcoded là 'http://localhost:3001' trong nhiều route files - cần đọc từ environment variables
- Thiếu validation error handling trong một số routes
- Chưa có rate limiting ở tầng Next.js API routes
- Một số module backend không có API route tương ứng (vd: business/marketplace, hs-connection chi tiết, share detail, etc.)
- Không có API routes cho: business/products, business/services, business/orders, hs-connection/requests, share/[id], certificate/issue, payment/checkout, blockchain/verify

### 1.5 FRONTEND - NEXT.JS 14 (Độ hoàn thiện: ~75%)

**Đã có (~34 pages):**
- Trang chủ (page.tsx) - Hero + feature grid + StatsBoard
- Map (/map) - Leaflet map + PostGIS + AI analysis + pinning
- AI Chat (/ai-chat) - Chat interface + history
- Library (/library) - Resource search + AI summary modal
- Career (/career) - Dashboard + jobs + quiz + roadmap + profile + predictive
- Community (/community) - Posts feed + create post + pagination
- Mentor (/mentor) - Mentor list + AI matchmaking + booking
- Scholarships (/scholarships) - List + eligibility check + apply modal
- Internships (/internships) - List + detail page
- Events (/events) - Event cards + registration progress
- Hackathon (/hackathon) - List + detail page
- STEM (/stem) - Lab list + equipment booking
- WiFi (/wifi) - Location list + nearby search + speed test + report
- Green (/green) - Challenges + proof submission
- Volunteer (/volunteer) - Activity log + hours tracking
- Donate (/donate) - Campaign list + detail page
- Marketplace (/marketplace) - Books + products + services + cart
- Profile (/profile) - Overview + gamification + settings (stub)
- Notifications (/notifications) - List + mark as read + pagination
- Dashboard (/dashboard) - Overview stats + daily insight
- Analytics (/analytics/trends) - AI trends + charts
- Leaderboard (/leaderboard) - Rankings + podium
- Intl (/intl) - Programs + alumni network
- HS Connection (/hs-connection) - Friend requests + suggestions
- Auth pages (login, register, forgot-password)
- Admin pages (dashboard, users, roles, reports, analytics/heatmap)
- Certificate verify (/certificates/verify/[code])
- Survey detail (/surveys/[id])
- Summer (/summer)
- Moderator (/moderator)
- Storage (/storage)
- Mobile unit (/mobile-unit)
- Opportunities (/opportunities, /opportunities/[id])
- Career jobs (/career/jobs, /career/jobs/[id])
- Mentor detail (/mentor/[id])
- Mentor call (/mentor/call)
- Donate campaign detail (/donate/campaign/[id])
- Hackathon detail (/hackathon/[id])
- Events detail (/events/[id])
- Community post detail (/community/post/[id])

**31 service files** matching backend modules:
admin, analytics, auth, career, certificate, community, dashboard, donate, events, gamification, green, hackathon, hs-connection, internship, intl, library, mentor, mobile-unit, moderator, notification, opportunity, scholarship, search, share, socket, stem, storage, summer, survey, volunteer, wifi

**Thiếu/Chưa hoàn thiện:**
- Profile settings tab là stub ("Cài đặt tài khoản đang được phát triển")
- Một số trang có thể cần bổ sung loading/error states chi tiết hơn
- Cart page (marketplace/cart) cần kiểm tra kết nối API
- Analytics page dùng default data khi API fail (hardcoded fallback)
- Một số services gọi trực tiếp backend thay vì qua Next.js API routes

### 1.6 MOBILE APP - REACT NATIVE (Độ hoàn thiện: ~30%)

**Đã có:**
- 7 màn hình: Home, Login, Chat, Map, Profile, Internship, Scholarship
- AuthContext
- ApiService với token management
- Cấu trúc cơ bản

**Thiếu/Chưa hoàn thiện:**
- Chỉ có 7/34 trang (~20% trang FE web)
- Thiếu Library, Events, Donate, Leaderboard, WiFi, Green, Volunteer, STEM, Marketplace, Community, Career, Analytics, Notifications, HS-Connection, Intl, Moderator, Summer, Survey, Storage, Mobile-Config, Admin, Certificate, Opportunity, Share pages
- Chưa có navigation (React Navigation stack/tab)
- Chưa có push notification
- Chưa có offline mode caching
- Chưa có image picker/camera integration
- Chưa có splash screen, onboarding

### 1.7 UI/UX HIỆN TẠI

**Đã có:**
- Dark theme nhất quán với yellow/purple/blue accents
- Tailwind CSS responsive design
- Lucide icons
- Skeleton loading components
- Toast notifications (sonner)
- Map component với Leaflet + heatmap
- Modal system
- Form validation cơ bản
- Search + filter + pagination
- Error handling cơ bản

**Thiếu/Chưa hoàn thiện:**
- Chưa có Error Boundary components
- Form validation chưa đồng nhất (một số form thiếu validation)
- Chưa có skeleton cho tất cả loading states
- Một số trang thiếu empty state design
- Không có dark/light mode toggle
- Chưa có accessibility (a11y) attributes

### 1.8 LUỒNG CODE VÀ KẾT NỐI

**Luồng hiện tại:**
```
User -> Frontend (Next.js pages)
  -> Frontend Services (fetch API)
    -> Next.js API Routes (proxy, thêm token)
      -> Backend NestJS (/api/...)
        -> PostgreSQL (TypeORM)
        -> Redis (cache, queue)
        -> AI Service FastAPI (/api/ai/...)
          -> Gemini Pro API
          -> ChromaDB vector store
        -> MinIO (file storage)
        -> Firebase (notifications)
```

**Vấn đề về kết nối:**
- Frontend services đôi khi gọi trực tiếp `/api/...` (qua Next.js API routes), đôi khi gọi trực tiếp backend
- Hardcoded `http://localhost:3001` trong một số API routes
- WebSocket/Socket.io được cấu hình nhưng chưa chắc FE đã kết nối đầy đủ
- AI Service URL được config qua env, nhưng fallback là localhost:8000

---

## 2. KẾ HOẠCH PHÂN PHASE

### PHASE 1: BACKEND TESTS & API COMPLETENESS (Tuần 1-2)

**Mục tiêu:** Đạt ~90% test coverage backend, hoàn thiện API routes

#### Todo 1.1: Viết unit tests cho 14 modules backend thiếu
- admin.service.spec.ts
- ai.service.spec.ts
- audit-log.service.spec.ts
- blockchain.service.spec.ts
- crawler.service.spec.ts
- dashboard.service.spec.ts
- gamification.service.spec.ts
- hs-connection.service.spec.ts
- internship.service.spec.ts
- intl.service.spec.ts
- learning-community.service.spec.ts
- map.service.spec.ts
- payment.service.spec.ts
- scholar.service.spec.ts
- summer.service.spec.ts

#### Todo 1.2: Sửa hardcoded URLs trong Next.js API routes
- Kiểm tra tất cả files trong frontend/app/api/
- Thay thế hardcoded 'http://localhost:3001' bằng process.env.NEXT_PUBLIC_API_URL
- Thêm fallback đúng cho production

#### Todo 1.3: Tạo API routes còn thiếu
- /api/business/services/route.ts (hiện tại thiếu, marketplace/services dùng frontend service nhưng không có API route tương ứng)
- /api/business/products/route.ts
- /api/business/orders/route.ts
- /api/certificates/issue/route.ts
- /api/payment/checkout/route.ts
- /api/blockchain/verify/route.ts
- /api/share/[id]/route.ts
- /api/hs-connection/requests/route.ts

### PHASE 2: FRONTEND COMPLETENESS & UI/UX (Tuần 3-4)

**Mục tiêu:** Hoàn thiện 100% trang FE, cải thiện UI/UX

#### Todo 2.1: Hoàn thiện trang Profile Settings (stub hiện tại)
- Chuyển tab "Cài đặt tài khoản" từ stub thành form thực tế
- Thêm update profile form (fullName, phone, bio, avatar)
- Thêm change password form
- Thêm 2FA toggle
- Thêm notification preferences
- Thêm email preferences
- Kết nối với backend auth/update-profile endpoint

#### Todo 2.2: Hoàn thiện cart page marketplace
- Kiểm tra kết nối API route /api/marketplace/cart
- Thêm quantity selector
- Thêm remove item
- Thêm checkout button
- Thêm order summary

#### Todo 2.3: Bổ sung Error Boundary
- Tạo error.tsx trong các layout quan trọng
- Tạo global-error.tsx
- Thêm error handling trong các trang

#### Todo 2.4: Cải thiện loading/error states
- Đảm bảo tất cả trang có loading skeleton
- Thêm error fallback UI cho tất cả data fetching
- Thêm retry button cho lỗi network

#### Todo 2.5: Kiểm tra và fix tất cả API connections
- Đảm bảo tất cả frontend services gọi đúng endpoints
- Kiểm tra headers Authorization được gửi đúng
- Thêm request/response interceptors nếu cần
- Fix các trang dùng data fallback khi API fail

### PHASE 3: MOBILE APP EXPANSION (Tuần 5-6)

**Mục tiêu:** Mobile app đạt ~70% trang web

#### Todo 3.1: Thiết kế navigation
- Cài đặt React Navigation (bottom tabs + stack)
- Tab bar: Home, Map, Community, Profile, AI Chat
- Stack navigator cho các trang chi tiết

#### Todo 3.2: Thêm màn hình còn thiếu (chọn lọc theo priority)
- Priority HIGH: Library, Events, Scholarships, WiFi, Leaderboard
- Priority MEDIUM: Career, STEM, Donate, Volunteer, Green, Notifications
- Priority LOW: Marketplace, Intl, HS-Connection, Moderator, Analytics

#### Todo 3.3: Hoàn thiện Auth flow
- Login/Register forms
- Token storage với SecureStore (thay vì localStorage)
- Auto refresh token
- Logout

#### Todo 3.4: Push notifications
- Expo Push Notifications
- Kết nối với backend notification service

#### Todo 3.5: Offline support
- AsyncStorage cache
- Offline action queue

### PHASE 4: DATA SEEDING & INTEGRATION (Tuần 7)

**Mục tiêu:** Đảm bảo database có dữ liệu mẫu đầy đủ

#### Todo 4.1: Seed data toàn diện
- Chạy tất cả seed scripts: seed-db.ts, seed.sql, seed_analytics.sql, seed_career_paths.sql, seed_gamification.sql, seed_scholarships.sql
- Chạy seed_crawled_data.sql (43 map_points + 80 learning_materials)
- Tạo thêm seed data cho các module thiếu: business, hs-connection, intl, learning-community, payment, blockchain

#### Todo 4.2: Verify data integrity
- Kiểm tra foreign key constraints
- Kiểm tra PostGIS coordinates hợp lệ
- Kiểm tra soft delete logic
- Kiểm tra full-text search indexes

#### Todo 4.3: Tạo script seed mẫu cho development
- seed_dev_data.py chạy nhanh khi docker-compose up
- Bao gồm users mẫu, roles, permissions, map_points, learning_materials

### PHASE 5: DEVOPS & DEPLOYMENT (Tuần 8)

**Mục tiêu:** CI/CD, monitoring, production readiness

#### Todo 5.1: CI/CD pipeline
- GitHub Actions workflow cho backend (lint, test, build)
- GitHub Actions workflow cho frontend (lint, build, test)
- GitHub Actions workflow cho AI service
- Auto deployment lên HF Spaces hoặc VPS

#### Todo 5.2: Monitoring & Logging
- Prometheus + Grafana (đã có trong docker-compose)
- Sentry cấu hình đầy đủ cho FE + BE + AI
- Health check endpoints
- Log aggregation

#### Todo 5.3: Security hardening
- npm audit fix cho backend + frontend
- python security check cho AI service
- Database backup automation
- SSL/TLS termination
- Rate limiting kiểm tra lại

#### Todo 5.4: Docker optimization
- Multi-stage builds
- .dockerignore đầy đủ
- Image size optimization
- Health checks cho tất cả services

---

## 3. TỔNG HỢP TODO CHI TIẾT (KHÔNG TÓM TẮT)

### BACKEND - Unit Tests (14 files)
1. Tạo backend/src/modules/admin/admin.service.spec.ts - test AdminService (stats, user management, backup)
2. Tạo backend/src/modules/ai/ai.service.spec.ts - test AIService (chat, history, search, career predict, trends, moderation)
3. Tạo backend/src/modules/audit-log/audit-log.service.spec.ts - test AuditLogService (query, export, stats)
4. Tạo backend/src/modules/blockchain/blockchain.service.spec.ts - test BlockchainService (issue, verify certificate on chain)
5. Tạo backend/src/modules/crawler/crawler.service.spec.ts - test CrawlerService (trigger crawl, aggregator, status)
6. Tạo backend/src/modules/dashboard/dashboard.service.spec.ts - test DashboardService (overview, insight)
7. Tạo backend/src/modules/gamification/gamification.service.spec.ts - test GamificationService (grant points, badges, leaderboard, progress)
8. Tạo backend/src/modules/hs-connection/hs-connection.service.spec.ts - test HSConnectionService (network, requests, suggestions)
9. Tạo backend/src/modules/internship/internship.service.spec.ts - test InternshipService (CRUD, apply, search)
10. Tạo backend/src/modules/intl/intl.service.spec.ts - test IntlService (programs, alumni, register)
11. Tạo backend/src/modules/learning-community/learning-community.service.spec.ts - test LearningCommunityService (spots CRUD)
12. Tạo backend/src/modules/map/map.service.spec.ts - test MapService (POIs, categories, create, AI analysis)
13. Tạo backend/src/modules/payment/payment.service.spec.ts - test PaymentService (VNPay, transaction history)
14. Tạo backend/src/modules/scholar/scholarship.service.spec.ts - test ScholarshipService (CRUD, apply, eligibility)
15. Tạo backend/src/modules/summer/summer.service.spec.ts - test SummerService (campaigns, registration)

### BACKEND - Integration Tests (cần thêm)
16. Tạo backend/test/auth.e2e-spec.ts - test full auth flow (register -> login -> refresh -> logout)
17. Tạo backend/test/map.e2e-spec.ts - test map CRUD với PostGIS
18. Tạo backend/test/ai.e2e-spec.ts - test AI chat flow
19. Tạo backend/test/career.e2e-spec.ts - test career application flow

### NEXT.JS API ROUTES - Sửa URLs (bắt buộc)
20. Sửa frontend/app/api/map/locations/route.ts - thay localhost:3001 bằng env var
21. Sửa frontend/app/api/auth/login/route.ts - thay localhost:3001 bằng env var
22. Kiểm tra và sửa tất cả api routes khác có hardcoded URLs
23. Thêm validate header Authorization trước khi proxy

### NEXT.JS API ROUTES - Thiếu (cần tạo mới)
24. Tạo frontend/app/api/business/services/route.ts - proxy GET/POST /business/services
25. Tạo frontend/app/api/business/products/route.ts - proxy GET/POST /business/products
26. Tạo frontend/app/api/business/orders/route.ts - proxy GET/POST /business/orders
27. Tạo frontend/app/api/certificates/issue/route.ts - proxy POST /certificates/issue
28. Tạo frontend/app/api/payment/checkout/route.ts - proxy POST /payment/checkout
29. Tạo frontend/app/api/blockchain/verify/route.ts - proxy GET /blockchain/verify/:code
30. Tạo frontend/app/api/share/[id]/route.ts - proxy GET/PUT/DELETE /share/items/:id
31. Tạo frontend/app/api/hs-connection/requests/route.ts - proxy GET/POST /hs-connection/requests

### FRONTEND - Pages hoàn thiện
32. Chuyển frontend/app/profile/page.tsx tab settings từ stub -> form thật: update profile, change password, 2FA, notification prefs
33. Hoàn thiện marketplace/cart/page.tsx - kết nối API thực tế, quantity, remove, checkout
34. Hoàn thiện marketplace/services/page.tsx - service list + booking
35. Hoàn thiện marketplace/products/page.tsx - product list + add to cart
36. Kiểm tra career/quiz/page.tsx - đảm bảo submit quiz kết nối AI
37. Kiểm tra career/roadmap/page.tsx - đảm bảo load roadmap data
38. Kiểm tra career/profile/page.tsx - đảm bảo CRUD skills/careers
39. Kiểm tra mentor/[id]/page.tsx - mentor profile + booking
40. Kiểm tra mentor/call/page.tsx - WebRTC call page
41. Kiểm tra internships/[id]/page.tsx - internship detail + apply
42. Kiểm tra opportunities/[id]/page.tsx - opportunity detail
43. Kiểm tra certificates/verify/[code]/page.tsx - certificate verification
44. Kiểm tra surveys/[id]/page.tsx - survey detail + submit
45. Kiểm tra admin/analytics/heatmap/page.tsx - heatmap data loading
46. Kiểm tra donate/campaign/[id]/page.tsx - campaign detail + donate form
47. Kiểm tra hackathon/[id]/page.tsx - hackathon detail + team registration
48. Kiểm tra events/[id]/page.tsx - event detail + registration
49. Kiểm tra community/post/[id]/page.tsx - post detail + comments
50. Kiểm tra certificate/page.tsx - certificate list + issue

### FRONTEND - UI/UX improvements
51. Tạo frontend/src/components/ErrorBoundary.tsx - Global error boundary
52. Tạo frontend/src/components/ErrorFallback.tsx - Fallback UI cho errors
53. Tạo frontend/src/app/error.tsx - Next.js error page
54. Tạo frontend/src/app/global-error.tsx - Global error handler
55. Tạo frontend/src/app/loading.tsx - Global loading skeleton
56. Đảm bảo mọi trang có error handling + retry
57. Thêm form validation đồng nhất (react-hook-form + zod)
58. Thêm a11y attributes (aria labels, roles)
59. Thêm dark/light mode toggle (có thể để mặc định dark)

### FRONTEND - API connection audit
60. Audit backend/src/modules/payment - đảm bảo FE service kết nối đúng
61. Audit backend/src/modules/blockchain - đảm bảo FE service kết nối đúng
62. Audit backend/src/modules/certificate/issue - đảm bảo FE service kết nối đúng
63. Audit frontend/src/services/*.service.ts - kiểm tra URL paths khớp BE controllers
64. Thêm axios/fetch interceptor cho error handling đồng nhất

### MOBILE APP - Expansion
65. Cài đặt React Navigation trong mobile/
66. Tạo mobile/src/navigation/AppNavigator.tsx - Tab + Stack navigation
67. Tạo mobile/src/screens/LibraryScreen.tsx - thư viện tài liệu
68. Tạo mobile/src/screens/EventsScreen.tsx - sự kiện
69. Tạo mobile/src/screens/ScholarshipListScreen.tsx - học bổng
70. Tạo mobile/src/screens/WifiScreen.tsx - WiFi locations
71. Tạo mobile/src/screens/LeaderboardScreen.tsx - bảng xếp hạng
72. Tạo mobile/src/screens/CareerScreen.tsx - career dashboard
73. Tạo mobile/src/screens/StemScreen.tsx - STEM labs
74. Tạo mobile/src/screens/DonateScreen.tsx - quyên góp
75. Tạo mobile/src/screens/VolunteerScreen.tsx - tình nguyện
76. Tạo mobile/src/screens/GreenScreen.tsx - green challenges
77. Tạo mobile/src/screens/NotificationScreen.tsx - thông báo
78. Cải thiện mobile/src/context/AuthContext.tsx - thêm token refresh, logout
79. Thêm expo-secure-store cho token storage
80. Thêm expo-notifications cho push notifications

### AI SERVICE - Tests
81. Tạo ai-service/tests/test_clustering_service.py - test clustering
82. Tạo ai-service/tests/test_llm_service.py - test LLM wrapper
83. Tạo ai-service/tests/test_predictive_service.py - test predictions
84. Tạo ai-service/tests/test_routers.py - test API routers
85. Tạo ai-service/tests/test_models.py - test Pydantic models

### DATABASE - Seeding & Verification
86. Chạy backend/src/database/seed-db.ts + tất cả seed SQL
87. Chạy crawlers/generate_seed_data.py + seed_crawled_data.sql
88. Tạo scripts/seed_dev_data.py - seed toàn diện cho dev
89. Tạo scripts/verify_db_setup.py - kiểm tra dữ liệu
90. Tạo scripts/seed_business_data.py - seed business module
91. Tạo scripts/seed_intl_data.py - seed intl module
92. Tạo scripts/seed_hs_connection_data.py - seed HS connection
93. Tạo scripts/seed_payment_data.py - seed payment
94. Tạo scripts/seed_blockchain_data.py - seed blockchain

### DEVOPS - CI/CD
95. Tạo .github/workflows/backend.yml - lint, test, build backend
96. Tạo .github/workflows/frontend.yml - lint, build, test frontend
97. Tạo .github/workflows/ai-service.yml - lint, test AI service
98. Tạo .github/workflows/deploy.yml - auto deploy lên HF Spaces
99. Tạo .github/workflows/db-migration.yml - auto run migration

### DEVOPS - Monitoring
100. Cấu hình Prometheus scraping đúng endpoints
101. Cấu hình Grafana dashboard cho EduMap
102. Thêm health check endpoints cho tất cả services
103. Tạo infrastructure/monitoring/edumap-dashboard.json - Grafana dashboard
104. Cấu hình Sentry DSN đầy đủ (FE, BE, AI)

### DEVOPS - Security
105. Chạy npm audit fix trong backend/
106. Chạy npm audit fix trong frontend/
107. Chạy pip-audit trong ai-service/
108. Cấu hình CORS đúng domains trong backend
109. Thêm CSP headers
110. Verify các secret không bị commit (.env trong .gitignore)
111. Tạo scripts/security_audit.py - tự động audit security

### DEVOPS - Docker
112. Tạo backend/.dockerignore hoàn chỉnh
113. Tạo frontend/.dockerignore hoàn chỉnh
114. Tạo ai-service/.dockerignore hoàn chỉnh
115. Optimize Dockerfile (multi-stage, caching)
116. Thêm HEALTHCHECK vào docker-compose.yml
117. Tạo docker-compose.override.yml cho development

---

## 4. THỨ TỰ THỰC HIỆN (PRIORITY)

**Phase 1 (CRITICAL - Backend Tests + API):**
- Fix hardcoded URLs trong API routes (nguy hiểm cho production)
- Viết tests cho 14 modules thiếu
- Tạo API routes còn thiếu

**Phase 2 (HIGH - Frontend):**
- Hoàn thiện profile settings
- Fix marketplace cart
- Error boundaries
- API connection audit

**Phase 3 (MEDIUM - Mobile):**
- Navigation setup
- Thêm 10+ màn hình phổ biến

**Phase 4 (MEDIUM - Data):**
- Seed data toàn diện
- Verify data integrity

**Phase 5 (LOW - DevOps):**
- CI/CD, monitoring, security hardening

---

## 5. RỦI RO VÀ LƯU Ý

- Kernel database đã có 50 bảng, cần đảm bảo tất cả seed scripts tương thích
- Backend BE (NestJS) chạy port 3000, nhưng API routes hardcode localhost:3001 - CẦN SỬA NGAY
- AI Service URL phải đúng trong docker-compose network (ai-service:8000)
- Mobile app hiện chỉ dùng HTTP localhost, cần config cho production
- Chưa có test E2E tự động chạy được
- Một số FE pages có thể đang fetch data trực tiếp từ backend bypass qua Next.js API routes
