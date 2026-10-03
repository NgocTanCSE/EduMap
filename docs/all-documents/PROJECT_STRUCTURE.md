# EduMap Project Structure

> **Updated:** October 2025 — Reorganized for Docker/Hugging Face Spaces deployment.

## Overview

EduMap is a comprehensive educational mapping platform for Đồng Nai province, Vietnam,
combining geographic data, AI, and community learning features. The project is deployed
on **Hugging Face Spaces** using a unified Docker container (single `Dockerfile`).

## Top-Level Structure

```
EduMap/
├── Dockerfile                    # Unified HF Spaces Docker (builds BE + FE + AI)
├── docker-compose.yml            # Full local dev stack (PostgreSQL, Redis, MinIO, nginx, OSRM)
├── docker-compose.hf.yml         # HF-style local preview (mirrors single-container setup)
├── .env / .env.example / .env.hf.example
├── .gitignore / .gitattributes / .huggingfaceignore
├── README.md                     # HF Spaces README (with frontmatter)
│
├── frontend/                     # Next.js 14 frontend application (production UI)
│   ├── test-app/                 # 🧪 Mock app for testing features locally (NOT in Docker)
│   │   ├── mock-handlers.ts      # Mock API route handlers
│   │   ├── mock-server.js        # Standalone mock server (port 9001)
│   │   ├── mock-middleware.ts    # Next.js middleware integration
│   │   ├── __tests__/            # Mock handler unit tests
│   │   ├── mock-data/            # Mock data fixtures (schools, auth, career, ai, etc.)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   ├── reporting/                # 📊 Reporting interface (admin dashboards, analytics)
│   │   ├── services/             # Admin, analytics, dashboard, gamification, notification APIs
│   │   ├── components/           # Reporting-specific UI components (future)
│   │   ├── types/                # Reporting-specific TypeScript types
│   │   ├── lib/                  # Reporting utilities (formatting, export, etc.)
│   │   ├── index.ts              # Barrel export
│   │   └── README.md
│   ├── app/                      # Next.js App Router (pages + BFF API routes)
│   │   ├── api/                  # BFF route handlers (proxy to NestJS backend)
│   │   ├── admin/                # Admin pages (reports, dashboard, users, roles)
│   │   ├── analytics/            # Analytics & trend pages
│   │   ├── dashboard/            # User dashboard
│   │   ├── leaderboard/          # Gamification leaderboard
│   │   ├── map/                  # Interactive map
│   │   ├── auth/                 # Login, register, forgot password
│   │   ├── career/               # Career paths, jobs, mentorship
│   │   ├── community/            # Community posts, discussions
│   │   ├── library/              # Learning materials
│   │   ├── mentor/               # Mentor booking
│   │   ├── scholarships/         # Scholarship search & application
│   │   ├── events/               # Events & hackathons
│   │   ├── donate/               # Donation campaigns
│   │   └── ... (all other feature pages)
│   ├── src/                      # Source code (components, services, lib, contexts)
│   │   ├── services/             # API service clients (auth, career, library, etc.)
│   │   │   └── admin/analytics/dashboard/... are SHIMS re-exporting from @/reporting/
│   │   ├── components/           # Shared components
│   │   ├── lib/                  # API config, fetch utilities, auth guards
│   │   ├── contexts/             # React contexts (Auth, etc.)
│   │   └── types/                # Shared TypeScript types
│   ├── lib/                      # Top-level utilities (i18n, theme, utils)
│   ├── components/               # Layout components (Footer, TopBar, MobileNav)
│   ├── public/                   # Static assets
│   ├── api/                      # Standalone API route (payment process)
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   └── .dockerignore
│
├── backend/                     # NestJS API server (BE) — top-level, split from backend-ai/
│   ├── .env → ../.env           # Symlink to root .env
│   ├── .dockerignore
│   ├── Dockerfile / Dockerfile.hf
│   ├── package.json, tsconfig.json
│   ├── backups/                  # (empty — manual DB backups)
│   └── src/
│       ├── app.module.ts         # Root module (imports all feature modules)
│       ├── main.ts               # Bootstrap (port 3001 in Docker, global /api prefix, Swagger)
│       ├── modules/              # Feature modules (auth, map, ai, career, etc.)
│       │   └── */                # Each: controller (API) + service (BE) + entity + DTO
│       ├── common/               # Shared guards, interceptors, pipes, filters
│       ├── config/               # Database, Redis, MinIO, multer config
│       ├── database/             # Schema, migrations, seed data
│       └── services/             # Google AI service integration
│   └── test/                     # E2E tests
│
├── ai-service/                  # Python AI service (FastAPI) — top-level, split from backend-ai/
│   ├── .dockerignore
│   ├── __init__.py
│   ├── main.py                   # FastAPI app + router registration
│   ├── routers/                  # API routers (chat, analytics, career, geo, etc.)
│   ├── services/                 # AI services (LLM, vector store, cache, DB)
│   ├── models/                   # Pydantic models
│   ├── seed_vector_db.py         # Vector DB seeding script
│   ├── requirements.txt
│   ├── Dockerfile
│   └── chroma_db/                # Runtime vector data (git-ignored, not in Docker)
│
├── api/                          # API layer (specifications & documentation)
│   ├── EduMap_API.postman_collection.json
│   ├── API_GUIDE.md
│   ├── README.md                 # API layer documentation
│   └── (NestJS API implementation is in backend/src/modules/)
│
├── crawlers/                     # Data collection crawlers (OpenStreetMap, Overpass API, etc.)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── entrypoint.sh
│   ├── crontab
│   ├── *.py                      # Individual crawlers + aggregator + quality check
│   └── generate_seed_data.py
│
├── mobile/                       # React Native mobile app (Expo) — separate deployment
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── src/services/api.ts       # Mobile API client
│   └── scripts/                  # Asset generation scripts
│
├── infrastructure/               # Docker, nginx, monitoring, k8s configs
│   ├── docker/                   # supervisord.conf (HF container process manager)
│   ├── nginx/                    # default.conf reverse proxy config
│   └── monitoring/               # Prometheus config
│
├── k8s/                          # Kubernetes deployment manifests (backend, frontend, ai-service)
│   ├── backend.yaml
│   ├── frontend.yaml
│   ├── ai-service.yaml
│   └── infrastructure.yaml
│
├── docs/                         # All documentation (.MD, .docx, .doc, .txt, .html)
│   └── all-documents/            # Consolidated docs folder (90 files from all over the repo)
│
├── scripts/                      # All utility scripts (consolidated from scripts/ + scratch/)
│   ├── *.py / *.sql              # DB setup, seeding, analytics, sheet generation
│   ├── *.sh                      # HF entrypoint, crawl pipeline, start scripts
│   ├── *.js                      # Data generation scripts
│   ├── *.bat                     # Windows batch scripts
│   ├── *.txt                     # Data/Excel reference files
│   ├── hf_entrypoint.sh          # HF Spaces container entrypoint (Postgres + Redis + supervisord)
│   ├── start_backend.sh          # Backend wrapper (pre-flight checks + node dist/main)
│   ├── start_backend_with_migrations.sh  # Alt starter (migrations + start:prod)
│   ├── execute_db_setup.py       # Post-deployment DB initialization
│   ├── run_crawl_pipeline.sh     # Crawl orchestration
│   ├── seed_*.py                 # Seed data generators
│   ├── generate_*.py             # Report/seed/data generators
│   ├── fix_*.py                  # Lint & import auto-fix scripts
│   └── *.js                     # Frontend data generation utilities
│
├── tests/                        # Project-level tests
├── crawled_data/                 # Crawl output data (git-ignored, large)
├── data_raw/                     # Raw data files (git-ignored, large)
├── osrm-data/                    # OSRM routing data (git-ignored, large)
└── seed_crawled_data.sql         # Seed SQL for database initialization
```

## Deployment Architecture (Hugging Face Spaces)

The project runs in a **single Docker container** on Hugging Face Spaces (port 7860).
Inside the container, `supervisord` manages all processes:

```
                        ┌─────────────────────────┐
                        │   Nginx (port 7860)      │
                        │  Reverse Proxy + Static  │
                        └────┬──────┬──────┬──────┘
                             │      │      │
                    /api →   │      │      │ ← / →  Frontend (3000)
                             ↓      ↓      ↓
                    Backend   AI    Frontend
                   (NestJS) (FastAPI) (Next.js)
                    (3001)   (8000)   (3000)
                     │        │        │
               PostgreSQL   ChromaDB
               Redis + MinIO
```

### Nginx Route Map
| Route | Target | Service |
|-------|--------|---------|
| `/api/socket.io` | `127.0.0.1:3001` | Backend WebSocket |
| `/api/*` | `127.0.0.1:3001` | Backend REST API |
| `/ai-service/*` | `127.0.0.1:8000` | AI Service (FastAPI) |
| `/` | `127.0.0.1:3000` | Frontend (Next.js) |

### Container Paths (inside Docker)
| Container Path | Source (repo) | Service |
|----------------|---------------|---------|
| `/app/backend/` | `backend/` | NestJS API |
| `/app/frontend/` | `frontend/` | Next.js |
| `/app/ai-service/` | `ai-service/` | Python AI |
| `/app/scripts/` | `scripts/` | Utility scripts |
| `/app/infrastructure/` | `infrastructure/` | Configs |

## Build Artifacts

The following are **not** committed to git (in `.gitignore`) and are **rebuilt inside Docker**:
- `node_modules/` — all Node.js dependencies
- `.next/` — Next.js build output
- `dist/` — TypeScript compilation output
- `.venv/` — Python virtual environment
- `__pycache__/` — Python bytecode
- `.expo/` — Expo cache
- `web-build/` — React Native web export
- `chroma_db/` — AI vector database (regenerated at runtime)

These are only needed for local development and are regenerated automatically
during the Docker build process. The `frontend/test-app/` mock app is also excluded
from the Docker build via `frontend/.dockerignore` since it is not part of the
production image.

## Recent Reorganization

- **backend-ai/ → backend/ + ai-service/**: The monolithic `backend-ai/` directory
  was split into top-level `backend/` (NestJS) and `ai-service/` (FastAPI) folders.
- **docs consolidation**: All `.md`, `.docx`, `.doc`, `.txt`, and `.html` files
  from across the repo were moved into `docs/all-documents/`.
- **scripts consolidation**: The `scripts/scratch/` and `scripts/backend/` subfolders
  were flattened into `scripts/`. The `scratch/` directory at the repo root was
  also consolidated.
- **Build artifacts**: `chroma_db/` added to `.gitignore` (runtime-generated vector DB).
