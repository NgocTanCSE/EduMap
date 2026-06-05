# 8. Cấu Trúc Code

|#|Thư mục/File|Mục đích|Công nghệ|Ghi chú|
|---|---|---|---|---|
|1|📁 frontend/|NextJS web application|NextJS 14, React 18, TypeScript|App Router, SSR/SSG|
|2|  📁 src/app/|App Router pages & layouts|NextJS|File-based routing|
|3|    📁 (auth)/login/page.tsx|Trang đăng nhập|React, NextAuth|Server component|
|4|    📁 (auth)/register/page.tsx|Trang đăng ký|React|Multi-step form|
|5|    📁 (main)/page.tsx|Home page|React|Landing page|
|6|    📁 (main)/map/page.tsx|Trang bản đồ|Mapbox GL JS|Dynamic import (no SSR)|
|7|    📁 (main)/library/page.tsx|Kho học liệu|React|SSR + client filter|
|8|    📁 (main)/opportunities/page.tsx|Bản đồ cơ hội|Mapbox|Client-side rendering|
|9|    📁 (main)/community/page.tsx|Cộng đồng|React|Realtime WebSocket|
|10|    📁 (main)/ai-chat/page.tsx|AI Chat|React|Streaming response|
|11|    📁 (main)/green/page.tsx|Green Campus|React, Mapbox|Gamification integration|
|12|    📁 (main)/workshops/page.tsx|Workshops|React|Calendar integration|
|13|    📁 (main)/mentoring/page.tsx|Mentoring|React, WebRTC|Video call integration|
|14|    📁 (main)/donate/page.tsx|Quyên góp|React|Payment integration|
|15|    📁 (main)/career/page.tsx|Career Roadmap|React, D3.js|Interactive visualization|
|16|    📁 (admin)/dashboard/page.tsx|Admin Dashboard|React, Chart.js|Protected route|
|17|    📁 layout.tsx|Root layout|NextJS|Navbar, Footer, Providers|
|18|  📁 src/components/|Reusable components|React|Atomic design pattern|
|19|    📁 ui/|Base UI (Button, Input, Modal, Card)|React, CSS Modules|Design system|
|20|    📁 map/|Map components (MapView, Marker, Popup)|Mapbox GL JS|Lazy loaded|
|21|    📁 ai/|AI Chat components|React|Streaming support|
|22|    📁 gamification/|Badge, Leaderboard, Points|React|Animations|
|23|    📁 layout/|Navbar, Sidebar, Footer|React|Responsive|
|24|  📁 src/hooks/|Custom React hooks|TypeScript|useMap, useAuth, useAI, useRealtime|
|25|  📁 src/services/|API service layer|Axios/Fetch|apiClient, mapService, aiService|
|26|  📁 src/stores/|State management|Zustand|authStore, mapStore, uiStore|
|27|  📁 src/styles/|Global styles & design tokens|CSS Modules, CSS Variables|Dark mode, responsive|
|28|  📁 src/utils/|Utility functions|TypeScript|formatDate, validators, constants|
|29|  📁 src/types/|TypeScript type definitions|TypeScript|API types, model types|
|30|  📁 public/|Static assets|N/A|Images, icons, fonts|
|31| | | | |
|32|📁 backend/|NestJS API server|NestJS, TypeScript|Modular architecture|
|33|  📁 src/modules/auth/|Authentication module|NestJS, Passport, JWT|Guards, strategies|
|34|  📁 src/modules/users/|User management|NestJS, TypeORM|CRUD, profile, roles|
|35|  📁 src/modules/map/|Map & geolocation|NestJS, PostGIS|Geo queries, clustering|
|36|  📁 src/modules/library/|Learning materials|NestJS, Multer, S3|Upload, search, download|
|37|  📁 src/modules/events/|Events & workshops|NestJS|CRUD, registration, tickets|
|38|  📁 src/modules/community/|Community features|NestJS, WebSocket|Posts, comments, groups|
|39|  📁 src/modules/gamification/|Gamification system|NestJS, Redis|Badges, points, leaderboard|
|40|  📁 src/modules/mentoring/|Mentor system|NestJS, WebRTC|Matching, booking, video|
|41|  📁 src/modules/donations/|Donation system|NestJS|Campaigns, payments, reports|
|42|  📁 src/modules/surveys/|Survey system|NestJS|Create, respond, analyze|
|43|  📁 src/modules/notifications/|Notification system|NestJS, FCM, WebSocket|Push, email, in-app|
|44|  📁 src/modules/admin/|Admin panel API|NestJS|Dashboard, moderation|
|45|  📁 src/modules/green/|Green Campus|NestJS|Challenges, activities|
|46|  📁 src/modules/careers/|Career & roadmap|NestJS|Paths, quiz, recommendations|
|47|  📁 src/common/|Shared utilities|NestJS|Guards, pipes, filters, interceptors, decorators|
|48|  📁 src/config/|Configuration|NestJS|Database, auth, storage, AI, map configs|
|49|  📁 src/database/|Database setup|TypeORM, PostgreSQL|Migrations, seeds, entities|
|50| | | | |
|51|📁 ai-service/|AI microservice|Python, FastAPI|Separate service|
|52|  📁 app/routers/|API routes|FastAPI|chat, recommend, analyze, career|
|53|  📁 app/services/|Business logic|Python|LLM service, embedding, RAG|
|54|  📁 app/models/|ML models|PyTorch/TF|Recommendation, classification|
|55|  📁 app/core/|Core utilities|Python|Config, security, logging|
|56|  📁 app/vectordb/|Vector database|ChromaDB/Pinecone|Document embeddings|
|57| | | | |
|58|📁 mobile/|Flutter mobile app|Flutter, Dart|iOS + Android|
|59|  📁 lib/screens/|Screen widgets|Flutter|All app screens|
|60|  📁 lib/widgets/|Reusable widgets|Flutter|Custom components|
|61|  📁 lib/services/|API services|Dart|HTTP client, WebSocket|
|62|  📁 lib/providers/|State management|Riverpod|App state|
|63| | | | |
|64|📁 infrastructure/|DevOps & deployment|Docker, K8s|IaC|
|65|  📁 docker/|Dockerfiles|Docker|frontend, backend, ai, nginx|
|66|  📁 k8s/|Kubernetes manifests|K8s|Deployments, services, ingress|
|67|  📁 terraform/|Infrastructure as Code|Terraform|AWS/GCP resources|
|68|  📁 ci-cd/|CI/CD pipelines|GitHub Actions|Build, test, deploy|
|69|  📁 monitoring/|Monitoring setup|Prometheus, Grafana|Metrics, alerts, dashboards|
|70| | | | |
|71|📁 docs/|Documentation|Markdown|API docs, architecture, guides|
|72|📁 scripts/|Utility scripts|Bash, Python|Setup, seed, migrate, backup|
|73|📁 tests/|Test suites|Jest, Pytest, Cypress|Unit, integration, E2E|
