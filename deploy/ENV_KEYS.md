# Inventori biến môi trường — EduMap (2026-11-12)

Mọi biến dưới đây là những biến code đang đọc. Những biến "không code nào đọc"
(`HF_TOKEN`, `ORS_API_KEY`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PROJECT_ID`,
`GOOGLE_AUTH_URI`, `GOOGLE_TOKEN_URI`, `GOOGLE_AUTH_PROVIDER_CERT_URL`) **không
nên đặt** — giữ lại chỉ gây nhầm lẫn.

Bảng gốc OTP Sync: `deploy/ENV_SYNC.md`, STAGE details.

---

## 1. Vercel — Frontend Next.js (`.env` của môi trường Vercel)

Biến `NEXT_PUBLIC_*` được nhúng vào bundle client lúc build, phải đặt trên
Vercel → **Redeploy** sau mỗi lần sửa.

| Key | Cần | Giá trị mẫu | Đọc ở |
|---|---|---|---|
| `BACKEND_URL` | **BẮT BUỘC** | `https://edumap-api.onrender.com` | `src/lib/api-config.ts` (BFF proxy) |
| `AI_SERVICE_URL` | **BẮT BUỘC** | `https://edumap-ai.onrender.com` | `app/api/ai/learning-path/*` |
| `JWT_SECRET` | **BẮT BUỘC** | (trùng `edumap-api`) | `src/lib/auth-utils.ts` |
| `ENABLE_DEV_LOGIN` | Tùy chọn | `false` | `app/api/auth/dev-login/route.ts` |
| `GOOGLE_CLIENT_ID` | Tùy chọn | `*.apps.googleusercontent.com` | `app/api/config/route.ts` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Tùy chọn | cùng | fallback client |
| `NEXT_PUBLIC_CARTO_API_KEY` | **BẮT BUỘC** (bản đồ) | CARTO free key | `src/lib/map-tiles.ts` |
| `NEXT_PUBLIC_USE_MOCK_API` | Tùy chọn | `false` (production) | `src/mock/install.ts` |
| `NEXT_PUBLIC_TOASTS_ENABLED` | Tùy chọn | `false` | `app/layout.tsx` + `src/lib/toast.ts` |
| `NEXT_PUBLIC_AI_API_URL` | Tùy chọn | `/api/ai` | `src/services/search.service.ts` |
| `NEXT_PUBLIC_API_URL` | Tùy chọn | `/api` | `src/lib/api-config.ts::getBackendUrl()` |
| `ADZUNA_APP_ID` | Tùy chọn | — | `app/api/career/jobs/route.ts` |
| `ADZUNA_APP_KEY` | Tùy chọn | — | `app/api/career/jobs/route.ts` |
| `TICKETMASTER_API_KEY` | Tùy chọn | — | `app/api/events/route.ts` |
| `NEXT_PUBLIC_SENTRY_DSN` | Tùy chọn | — | `next.config.js` |
| `NODE_ENV` | — | `production` | Next.js tự dùng |

> **Next.js server-side** đọc `BACKEND_URL`, `AI_SERVICE_URL`, `JWT_SECRET`,
> `ENABLE_DEV_LOGIN`, `GOOGLE_CLIENT_ID`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`,
> `TICKETMASTER_API_KEY` — cùng một lớp env, không cần biến riêng.

## 2. Render `edumap-api` — Rust/axum (cổng 3000)

Đọc ở `backend/src/config.rs` + các module.

| Key | Cần | Giá trị mẫu | Đọc ở |
|---|---|---|---|
| `BACKEND_PORT` | **BẮT BUỘC** | `3000` | `config.rs` |
| `JWT_SECRET` | **BẮT BUỘC** | trùng Vercel | `config.rs` (`JWT_SECRET`) |
| `JWT_EXPIRES_IN` | Tùy chọn | `7d` | `config.rs` |
| `ENABLE_DEV_LOGIN` | Tùy chọn | `true` | `modules/auth.rs` (dành cho dev) |
| `DEV_USER_EMAIL` | Tùy chọn | `dev@edumap.vn` | `modules/auth.rs` |
| `DB_TYPE` | **BẮT BUỘC** | `postgres` | `configure cfg` |
| `DB_SYNC` | **BẮT BUỘC** | `false` | `configure cfg` |
| `DB_HOST` | **BẮT BUỘC** | `aws-0-*.pooler.supabase.com` | `configure cfg` |
| `DB_PORT` | **BẮT BUỘC** | `6543` | `configure cfg` |
| `DB_USERNAME` | **BẮT BUỘC** | `postgres.<ref>` | `configure cfg` |
| `DB_PASSWORD` | **BẮT BUỘC** | mật khẩu Supabase | `configure cfg` |
| `DB_DATABASE` | **BẮT BUỘC** | `postgres` | `configure cfg` |
| `DATABASE_URL` | Hỗ trợ thay DB_* | DSN | `configure cfg` (ưu tiên hơn `DB_*`) |
| `AI_SERVICE_URL` | **BẮT BUỘC** | `http://edumap-ai:8000` (nội bộ Render) | `config.rs` |
| `AI_SERVICE_TIMEOUT` | Tùy chọn | `45` | `modules/ai.rs` |
| `ROUTING_SERVICE_URL` | **BẮT BUỘC** | `https://router.project-osrm.org` | `config.rs` |
| `STORAGE_DIR` | Tùy chọn | `/app/uploads` | `modules/storage.rs` |
| `NOTIFICATIONS_URL` | Tùy option | (nội bộ) | `modules/community.rs` |
| `SMTP_HOST` / `SMTP_PORT` | Tùy chọn | `smtp.gmail.com` / `587` | `config.rs` |
| `VNP_TMN_CODE` / `VNP_HASH_SECRET` / `VNP_RETURN_URL` / `VNP_URL` | Tùy chọn (VNPay) | — | `modules/donate.rs` |
| `BING_MAPS_API_KEY` | Tùy chọn | — | `modules/geo.rs` |

## 3. Render `edumap-ai` — FastAPI (cổng 8000)

Đọc ở `ai-service/` (config + cache TTL + scheduler + seed).

### DB (giống hệt `edumap-api`)
`DB_TYPE=postgres`, `DB_SYNC=false`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`,
`DB_PASSWORD`, `DB_DATABASE`.

### Text generation cascade (`llm_service.py`)
| Key | Cần | Default | Ghi chú |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | Tùy | — | Primary; không set → Gemini |
| `DEEPSEEK_BASE_URL` | Tùy | `https://api.deepseek.com` | |
| `DEEPSEEK_MODEL` | Tùy | `deepseek-chat,deepseek-reasoner` | |
| `DEEPSEEK_TIMEOUT_SECONDS` | Tùy | `20` | |
| `GEMINI_API_KEY` | Tùy | — | Fallback #1 |
| `GEMINI_MODEL` | Tùy | `gemini-3.8-flash,...` | |
| `GEMINI_TIMEOUT_SECONDS` | Tùy | `20` | |
| `CLOUDFLARE_API_TOKEN` | Tùy | — | Fallback #2 (text generation) |
| `CLOUDFLARE_ACCOUNT_ID` | Tùy | — | Fallback #2 (text generation) |
| `CLOUDFLARE_MODEL` | Tùy | `@cf/meta/llama-3.1-8b-instruct-fp8, ...` | |
| `CF_AI_GATEWAY_ID` | Tùy | — | Gateway (nếu không có → direct) |
| `CF_AI_GATEWAY_ENABLED` | Tùy | `false` | `true` khi dùng gateway |
| `AI_CF_BUDGET_SECONDS` | Tùy | `20` | Ngân sách CF (s) |

### Embeddings (chỉ Gemini — `vector_store.py`)
| Key | Cần | Default | Ghi chú |
|---|---|---|---|
| `GEMINI_EMBEDDING_MODEL` | Tùy | `gemini-embedding-001` | **nhà cung cấp duy nhất** |
| `EMBED_GLOBAL_TIMEOUT_SECONDS` | Tùy | `6` | Toàn bộ chuỗi |
| `EMBED_PROVIDER_TIMEOUT_SECONDS` | Tùy | `4` | Một lần cố gắng |
| `EMBED_CACHE_MAX` | Tùy | `1024` | Nhúng cache LRU |
| `EMBED_CACHE_TTL_SECONDS` | Tùy | `1800` | |

### Gaming / RAG | STT | TTS | Vision | Climate
| Key | Cần | Default | Ghi chú |
|---|---|---|---|
| `RAG_TIMEOUT_SECONDS` | Tùy | `8` | Hard limit chat-with-rag |
| `GEN_TIMEOUT_SECONDS` | Tùy | `8` | Sinh text |
| `STREAM_PROXY_DEADLINE_SECONDS` | Tùy | `10` | Stream (NestJS proxy) |
| `STREAM_FINAL_RESERVE_SECONDS` | Tùy | `1.5` | Stream |
| `STT_TIMEOUT_SECONDS` | Tùy | `25` | Speech-to-text |
| `GEO_VISION_MODEL` | Tùy | `google/owlv2-base-patch16-ensemble` | (không dùng — degraded) |
| `GEO_VISION_TIMEOUT_SECONDS` | Tùy | `25` | |
| `OWM_API_KEY` | Tùy | — | Weather (Climate Guardian) |
| `OWM_TIMEOUT_SECONDS` | Tùy | — | |
| `GOOGLE_TTS_API_KEY` | Tùy | — | TTS (edge-tts/gTTS) |
| `BING_MAPS_API_KEY` | Tùy | — | GeoVision tile source |
| `AI_FORCE_IPV4` | Tùy | `true` | Phải đúng với egress host |
| `CHROMA_DB_PATH` | Tùy | `/tmp/chroma_db` | Ephemeral, re-seed on boot |
| `CHROMA_INIT_TIMEOUT_SECONDS` | Tùy | `60` | |
| `CHROMA_RETRY_SECONDS` | Tùy | `30` | |

### Scheduler | Auto | Knowledge graph | Question gaps
| Key | Cần | Default | Ghi chú |
|---|---|---|---|
| `AUTO_SCHEDULER_ENABLED` | Tùy | `true` | `false` trên plan free 512 MB |
| `KNOWLEDGE_GRAPH_SYNC_INTERVAL` | Tùy | `3600` (s) | |
| `SEED_EMBED_GLOBAL_TIMEOUT_SECONDS` | Tùy | `25` | Seed kernel |
| `SEED_EMBED_PROVIDER_TIMEOUT_SECONDS` | Tùy | `12` | |
| `QUESTION_GAPS_MAX_QUERIES` | Tùy | `10000` | |
| `QUESTION_GAPS_N_CLUSTERS` | Tùy | `5` | |
| `RAM_THRESHOLD_GB` | Tùy | `1.5` (render-ai) | OOM guard |

### Offline tutor (edge AI tutor)
| Key | Cần | Default | Ghi chú |
|---|---|---|---|
| `OFFLINE_TUTOR_USE_LLM` | Tùy | `true` | `false` = template ngay |
| `OFFLINE_MAX_TOKENS` | Tùy | `256` | |
| `OFFLINE_TEMPERATURE` | Tùy | `0.7` | |
| `OFFLINE_TOP_P` | Tùy | `0.9` | |
| `OFFLINE_CACHE_TTL` | Tùy | `3600` | |
| `OFFLINE_CACHE_MAX` | Tùy | `128` | |

### SEO / Crawl / Other
| Key | Cần | Default | Ghi chú |
|---|---|---|---|
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Tùy | — | (`adzuna_country=vn`) |
| `ADZUNA_COUNTRY` | Tùy | `vn` | |
| `CRAWL_ON_START` | Tùy | `false` | |
| `CRAWL_INTERVAL_SECONDS` | Tùy | `86400` | |
| `EDUMAP_CRAWLER_BOOT_RUN` | Tùy | `1` | |
| `EDUMAP_BOOKS_LIVE` | Tùy | `0` | |
| `TWITTER_BEARER_TOKEN` | Tùy | — | |
| `TAVILY_API_KEY` | Tùy | — | Crawlers |
| `TAVILY_TIMEOUT_SECONDS` | Tùy | `25` | |
| `TAVILY_MAX_RESULTS` | Tùy | `8` | |
| `TAVILY_CIRCUIT_BREAKER_FAILURES` | Tùy | `5` | |
| `TAVILY_CIRCUIT_BREAKER_TTL` | Tùy | `300` | |
| `EDUMAP_FULL_REFRESH` | Tùy | `0` | |
| `IMPACT_POP_DENSITY` | Tùy | `350` | Impact measurement |
| `POSTGRES_PORT_EXTERNAL` | Tùy | `5433` | |
| `CACHE_ENABLED` | Tùy | `true` | Cache service |
| `RESPONSE_CACHE_MAX` | Tùy | `2048` | LLM response cache |
| `RESPONSE_CACHE_TTL_SECONDS` | Tùy | `86400` | 24h |
| `SQLITE_DATABASE_URL` | Tùy | — | sqlite fallback |

## 4. Docker Compose local — `.env.example`

Bản template (`docker-compose.yml` trường hợp, `.env` gitignored) bao gồm:
- Database: `DB_HOST=postgres`, `DB_PORT=5432`, `DB_USERNAME`, `DB_PASSWORD`,
  `DB_DATABASE`, `DB_TYPE=postgres`, `DB_SYNC=false`, `REDIS_HOST=redis`,
  `REDIS_PORT=6379`
- Auth: `JWT_SECRET`, `JWT_EXPIRES_IN`
- API gateway: `BACKEND_URL=http://backend:3000`, `BACKEND_PORT=3000`,
  `AI_SERVICE_URL=http://ai-service:8000`, `AI_SERVICE_TIMEOUT=45`,
  `ROUTING_SERVICE_URL=http://osrm:5000`
- Client: `NEXT_PUBLIC_API_URL=/api`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, ...
- AI: `DEEPSEEK_*`, `GEMINI_*`, `CLOUDFLARE_*`(text fallback), `TAVILY_*`...
- Operational: `STORAGE_DIR`, `NOTIFICATIONS_URL`, `NODE_ENV=development`

Giá trị mẫu có sẵn trong `.env.example` tại repo root; copy sang
`docker-compose.override.yml` (hoặc `/tmp/.env` trên host) khi chạy local.

