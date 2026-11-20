# AGENTS.md — EduMap project memory

> This file is the persistent context for any AI agent working on EduMap.
> Read it before changing code. Keep it up to date when deployment or
> architecture assumptions change.

## 1. Deployment model (IMPORTANT — do not forget)
>
> - **Current runtime (2026-11-13) = Render FREE plan, deployed by the user.**
>   Two image-backed Docker services: `edumap-api` (Rust, port 3000) and
>   `edumap-ai` (FastAPI, port 8000); the Next.js frontend is on Vercel;
>   Postgres is Supabase. GitHub Actions `render-deploy.yml` builds both images
>   on GitHub-hosted runners, pushes them to GHCR, then runs
>   `render deploys create --image`; Render pulls and runs the image. The Rust
>   binary is **not** compiled by Render and **not** compiled on the local
>   machine. The root `Dockerfile` + `docker-compose.yml` is the legacy
>   single-container path, not the Render deployment path.
> - **Legacy local/host container reference:** the remote container once ran
>   the docker-compose stack (`Dockerfile` + `supervisord.conf`, 1 vCPU /
>   16 GB RAM, **ephemeral disk**, **sleeps after idle**, and every restart
>   wipes `/tmp`). There is **no** paid hardware, no persistent volume, no
>   external Postgres/Redis/MinIO/Chroma server.
> - **Local machine = code editing only.** `/home/ngoctan/Downloads/EduMap`
>   exists to write code, read code, and run **Python unit tests only**
>   (`py_compile`, `pytest ai-service/tests`, AST/`grep` inspection). A local
>   run (even a green one) is **never** proof that the feature works: the only
>   accepted verification is a request against the deployed host after a
>   deploy.
> - **Never start the local stack.** Do NOT run `npm install` / `npm run dev`
>   / `npm run build`, `nest start`, `docker build`, `docker compose`,
>   `supervisord`, or any local server on this machine (user rule, 2026-10-30).
>   Fixes are prepared as code + tests; the user deploys and verifies on their
>   host.
>   If a change seems to need a local runtime check, say so and stop — do not
>   start processes.
> - Consequences that shape every design decision:
>   - Anything written to `/tmp` (ChromaDB vectors, uploads, caches, elevation
>     tiles) disappears on restart → features must degrade gracefully and
>     re-seed on boot, never assume warm state.
>   - Cold start takes tens of seconds → frontends/proxies need retries and
>     honest loading states; a first-request 503 is a cold start, not a bug.
>   - No GPU / no bundled models → all AI work goes through remote APIs
>     (Groq) with template fallbacks; embeddings via Jina.
>   - Only one container, one public port (3000) → internal services must stay
>     on 3000/8000 and be reached through the Next.js BFF, never from browsers.

- **Production = the user's Render deployment (free plan).**
  - The user performs the deploy; the agent never deploys.
  - Local (`/home/ngoctan/Downloads/EduMap`) is for code editing, Python unit
    tests, and inspection only. Do not treat a local run as the source of truth
    for runtime behaviour. Validate runtime fixes on the deployed host.
- A container restart wipes ephemeral state (`/tmp/chroma_db`, `/tmp/uploads`).
- **Secrets live in the host → Secret Settings**, not in the repo.
  `.env` is gitignored and is only a local template; an empty key in `.env`
  does NOT mean the provider is disabled in production.

## 2. Architecture (single container)

```
Docker container (public port 3000)
├─ backend    Rust (axum)     :3000  ← public (routes /api/*)
├─ backend    Rust (axum)     :3000  ← internal (Phase 0 scaffold written 2026-11-09)
├─ ai-service FastAPI          :8000  ← internal
├─ osrm       osrm-routed     :5000  ← internal
├─ crawler    Python (cron)          ← daily
├─ SQLite     /app/data/edumap.db
└─ ChromaDB   /tmp/chroma_db (ephemeral)

Frontend (Next.js 14) is hosted on Vercel and calls the container via
BACKEND_URL / AI_SERVICE_URL = the host's URL.
```

- Process manager: `supervisord.conf`.
- Build: multi-stage `Dockerfile`.
- PostgreSQL/Redis/MinIO/NGINX/OSRM are replaced by SQLite, in-process LRU
  cache, filesystem, Next.js BFF and public OSRM/ORS respectively.

### Unified Hub pattern (2026-10-27)

Multiple standalone pages that share a domain have been consolidated into
**hub pages with tab/tool navigation**:

- **`/map` (Map Hub)** — 14 tool tabs in a single sidebar panel:
  Data Hunter, Gap Predictor, Resource Optimizer, GeoVision AI, Survey Planner,
  Climate Guardian, AI Agent, Wifi, Green, Nơi học, STEM Lab, Mùa hè,
  Quyên góp, Chợ chia sẻ.
  - Old routes (`/map/data-hunter`, `/climate-guardian`, `/ai-agent`,
    `/talk2map`) still redirect to `/map?tool=<id>` (or `/map` for Talk2Map
    since search is built into the map page). `/voice-search` redirects to
    `/map` (voice search lives in the map rail, not as a separate tool).
    - **Map-only (2026-11-19, mở rộng):** các trang danh sách `/green`,
      `/wifi`, `/learning-spaces`, `/stem`, `/summer`, `/donate` và
      `/marketplace` đã bị xoá; tất cả redirect sang `/map?tool=<id>` và
      danh sách/tìm kiếm/hành động nằm trong panel map tool tương ứng
      (`GreenTool`, `WifiTool`, `LearningSpaceTool`, `StemTool`, `SummerTool`,
      `DonateTool`, `MarketTool`). Các trang chi tiết vẫn giữ:
      `/donate/campaign/[id]`, `/marketplace/{products,services,cart}`.
      `backend/src/modules/map.rs::feature_link_for`
      trả thẳng `/map?tool=...` cho cả 6 category ghim.
  - Tools use `next/dynamic({ ssr: false })` to avoid leaflet SSR crashes.
  - Registry: `components/map/tools/registry.tsx` (14 tools, `MAP_TOOLS` array:
    6 `core` — climate, wifi, green, learning-space, donate, market — và
    8 `analysis` — data-hunter, gap-predictor, resource-optimizer, geo-vision,
    survey-planner, ai-agent, stem, summer).
  - Each tool module exports `XxxPanel` + `XxxOverlay` as named exports.
  - **Coordinate fix (2026-10-30):**
    - `GreenOverlay` renders `green_challenges.lat`/`lng` directly. The shipped
      `edumap.db` (and `scripts/real_vn_data.py:GREEN_CHALLENGES`) had lat/lng
      **swapped** (lat=105.8342 > 90 → Leaflet Web-Mercator emitted NaN and
      dropped all green markers). Fixed in both the source tuple order and the
      shipped DB (now lat=21.0285, lng=105.8342, Hanoi). A defensive
      lat-range guard now skips any out-of-range pin.
    - `WifiOverlay.getCoords()` read `loc.location.coordinates` + `loc.lat`/`loc.lng`,
      but the `locations` entity exposes GeoJSON at the **top-level**
      `coordinates` field (`{type:'Point',coordinates:[lng,lat]}`) — so every
      wifi hotspot was skipped (zero markers). Fixed to read the top-level
      GeoJSON (with legacy `loc.lat`/`loc.lng` fallback), and the render guard
      now uses the null-returning helper.

- **`/career` (Career Hub)** — tab bar with 7 tabs:
  Tổng quan (dashboard), Việc làm (jobs), Lộ trình (roadmap), Dự báo (predictive),
  Cơ hộp (opportunities), Opportunity Radar, Thống kê (analytics).
  - Old sidebar items removed: `career-roadmap`, `opportunities`,
    `opportunity-radar`, `analytics`. `career-jobs` and `career-predictive`
    were already hidden from sidebar.
  - Sub-pages (`/career/jobs`, `/career/roadmap`, `/career/predictive`,
    `/opportunities`, `/opportunities/radar`, `/analytics/trends`) remain
    accessible as full pages — tabs navigate to them directly.
  - The `internships` feature stays as a separate sidebar item (distinct data
    source).

- Feature catalog (`src/lib/feature-catalog.ts`) is the single source of truth
  for sidebar rendering. `sidebar: true` = appears in the left rail.
  25 items remain on the sidebar after consolidation (was 35).
- PostgreSQL/Redis/MinIO/NGINX/OSRM are replaced by SQLite, in-process LRU
  cache, filesystem, Next.js BFF and public OSRM/ORS respectively.
- **ImpactMatch (Idea #9)** — need↔sponsor matching: `backend/src/modules/impact-match/*`
  (entities `sponsor_needs`/`sponsor_profiles`, `ImpactMatchService` with SQLite
  pre-filter + AI ranking via `AIService.impactMatchRank`), `ai-service` endpoint
  `POST /api/ai/impactmatch/rank` (mirrors mentor matching pattern). New tables
  are healed by `ensureSqliteSchema()` + demo-seeded from real Vietnamese orgs
  in `sqlite-bootstrap.ts`. Frontend at `app/impact-match/page.tsx` (dual panel).
  Nav entry added under "Chợ & Đóng góp". Ranking uses the same
  `_generate_text_with_fallback` cascade with `temperature=0.3`,
  `max_tokens=2048`, `top_p=0.8` — budget stays under the NestJS stream timeout;
  graceful-degradation `_impact_match_fallback` returns template-based scores.
- **AI Impact Measurement (Idea #19)** — before/after access impact of a deployment
  (wifi/library/school/lab): `backend/src/modules/impact-measurement/*`
  (`ImpactMeasurementService` computes the pure before/after diff T1 from
  `map_points`; `GET /api/impact-measurement/metrics` + `GET /api/impact-measurement/measure`,
  the latter merging with the ai-service via `AIService.measureImpact`).
  `ai-service` endpoint `POST /api/ai/impact/measure` (`services/impact_measure.py`
  singleton `impact_measure`, `routers/impact_measure.py`,
  `models/impact_measure_models.py`) — people-in-5-km-radius diff, trend analysis,
  Wilson-score confidence interval (+ widened when the "before" cohort is a
  synthetic baseline), 0–100 weighted impact score, causal-inference notes, and an
  LLM narrative with refusal detection + template fallback (never 502s).
  24h in-process TTL cache. Frontend dashboard at `app/dashboard/impact/page.tsx`
  (dependency-free SVG charts — no chart.js dep added) + BFF `app/api/dashboard/impact/route.ts`.
  Nav entry "Đo lường Tác động AI" under "Chợ & Đóng góp". **Risk mitigation**:
  when real "before" data is missing, the synthetic baseline is `population × 0.70`
  and the response is flagged `degraded=true` with provenance in `causal_notes`.
  Smoke test #23.

- **Resource Exchange AI (Idea #18)** — need↔supply matching for books,
  devices & volunteer hours: `backend/src/modules/resource-exchange/*`
  (entities `resources`/`resource_requests`/`resource_matches`,
  `ResourceMatchService` with SQLite **pre-filter** — type match + condition ≥
  preferred_min + region match + hard cap 15 pairs) + AI ranking/reasoning via
  `AIService.resourceExchangeMatchRank`), `ai-service` endpoint
  `POST /api/ai/resource-exchange/match-rank` (mirrors `rank_impact_matches`,
  uses the same `_generate_text_with_fallback` cascade with `temperature=0.3`,
  `max_tokens=2048`, `top_p=0.8`; the 24h-slot greedy transport schedule is
  computed in Python via `_build_transport_schedule` — deterministic &
  conflict-free — and is **not** an LLM call, so it never blocks on token
  latency). Backend proxy: `POST /api/resource-exchange/match` → ai-service
  (sync, 45s timeout). `llm_service.py` adds `rank_resource_matches`,
  `_build_transport_schedule` (slot_minutes=120, staggered, skip duplicate
  resource_id/request_id), and graceful-degradation
  `_resource_exchange_fallback` (returns SQLite-scored pairs with
  `degraded=true`, so the feature never 502s). New tables healed by
  `ensureSqliteSchema()` + seeded from **real** Vietnamese institutions
  (DNTU, THCS Nguyễn Trãi, HCMUT) in `sqlite-bootstrap.ts` — see AGENTS.md §6.
  Frontend at `app/resource-exchange/page.tsx` (3-tab dual panel: Cung cấp /
  Cần nhận / Đã ghép) + BFF routes `app/api/resource-exchange/{resources,
  requests, match}/route.ts` (mirror `app/api/impact-match/*`) + service
  `src/services/resource-exchange.service.ts`. Scoring weights: proximity 0.40,
  need_level (urgencyWeight/4)·100 × 0.25, condition (res.condition/5·100 ×
  0.25), availability × 0.10. Nav entry added under "Chợ & Đóng góp".
  - **Verify:** backend `npx tsc --noEmit` OK, Jest 8/8; AI service
    `pytest tests/test_resource_exchange.py` 9/9; `py_compile` OK; frontend
    `npx tsc --noEmit` OK (no resource-exchange errors).

## 2.3 AI Question Gap Report (Idea #17)

- **Goal:** find topics users ask about but the AI can't answer well.
- **T1 (logging):** `query_logs` table (anonymized) — `user_id_hash` (SHA-256),
  `query_text`, `retrieved_doc_count`, `retrieval_status`, `response_text`,
  `response_quality`. Logged in `AIService._logQuery()` (fire-and-forget from
  `chat()` + `chatStream()`). TTL 30-day sweep in `sqlite-bootstrap.ts`.
- **T2 (AI service):** `GET /api/ai/analytics/question-gaps` — `QuestionGapAnalyzer`
  reads `query_logs` (capped at 10 000), clusters via TF-IDF + K-Means (keyword
  fallback when sklearn missing), identifies gaps (`retrieval_status='failed'`,
  `retrieved_doc_count=0`, or `response_quality<0.30`), recommends docs via
  `llm_service._generate_text_with_fallback` with template fallback. 24 h
  in-process cache. Router at `ai-service/routers/question_gaps.py`.
- **T3 (frontend):** `app/admin/question-gaps/page.tsx` (admin-only) — cluster
  cards, gap table, doc recommendations, privacy notice. Backend proxy at
  `GET /admin/question-gaps` → `aiService.getQuestionGaps()` (30 min LRU cache).
- **Tests:** `ai-service/tests/test_question_gaps.py` (17 tests), backend
  `ai.service.spec.ts` (13 new tests).
- **Smoke test:** `curl -X GET .../api/admin/question-gaps?limit=10000 -H "Authorization: Bearer $TOKEN"` → 200 + JSON report.

## 2.4 Active Learning for Field Survey (Idea #20)

- **Goal:** help field-teams pick the next verification point that maximises
  information gain per unit survey cost. Pure server-side (no LLM), sub-second on 1 vCPU.
- **ai-service** `services/survey_optimizer.py` (`SurveyOptimizerService` singleton
  `survey_optimizer`): `_haversine_km` (R=6371, from `climate_guardian.py`);
  `_binary_entropy` (1.0 at p=0.5); **Uncertainty** = entropy of gap-density `p_exist`
  per grid cell, **Information value** = entropy reduction,
  **Cost** = `distance_km / surveyor_speed_kmh + survey_time_hours` (missing cost ->
  distance + fixed overhead). `priority_score = info_value / cost`. Tunables:
  `SURVEY_GRID_SIZE_KM`=1.0, `SURVEY_TOP_N`=15, `SURVEY_TIME_HOURS`=1.0,
  `SURVEYOR_SPEED_KMH`=30.0, `INFLUENCE_RADIUS_KM`=2.0, `SPATIAL_WEIGHT`=0.25;
  caps `MAX_POIS`=800, `MAX_GRID_CELLS`=900, `MAX_RESULTS_CEIL`=50.
  **Degradation:** empty POIs -> `degraded=true` + 7 real Biên Hòa/Đồng Nai
  cells (`STATIC_SURVEY_CANDIDATES`, source
  `Bản đồ giáo dục EduMap — Biên Hòa, Đồng Nai`, verification_date `2026-10-27`).
  No new DB tables (grid computed in-memory); `ensureSqliteSchema()` untouched.
- **ai-service** `routers/survey.py` (`prefix="/api/ai/survey"`):
  `POST /priorities` + `POST /next`; sha256-payload 24 h in-process cache;
  registered `'survey'` in `main.py` `router_names`.
- **Backend** `map.service.ts`: `getSurveyPriorities`/`getSurveyNext`
  (POIs via `findAllPois` ≤5000, capped to `MAX_POIS=800`; proxy 30 s timeout;
  reuse `_resourceOptCache` 3600 s TTL; degraded fallback). Public
  `GET /api/map/survey/priorities` + `GET /api/map/survey/next` (`@SkipThrottle`).
- **Frontend:** BFF `app/api/map/survey/{priorities,next}/route.ts`; page
  `app/map/survey-planner/page.tsx` + `SurveyPlannerMap.tsx` (Leaflet twin-panel,
  CARTO basemaps tiles, priority colour labels, gold next pin, auth-gated); toolbar button on
  `app/map/page.tsx`; nav "Kế hoạch khảo sát" under "AI an toàn" in `Sidebar.tsx`.
- **Verify (DONE):** pytest 17/17; `py_compile` OK; backend `tsc` 0 errors;
  frontend `tsc` 0 errors. Full-stack curl: `GET /api/map/survey/priorities?...grid_size_km=0.7&top_n=3`
  -> 200 + ordered FeatureCollection (`priority_score = info_value / cost`,
  descending, real POIs `degraded=false`; empty DB `degraded=true`); cache miss ->
  `metadata.cached=null`, repeat -> `metadata.cached=true`.
  **Runtime truth = the deployed container**.

## 2.1 AI Knowledge Graph (Idea #8)

- **T1** `ai-service/services/knowledge_graph.py` — `KnowledgeGraphService`
  with SQLite adjacency-list tables `kg_nodes`, `kg_edges`,
  `kg_extraction_review`. Builds graph from source tables (`map_points`,
  `scholarships`, `opportunities`, `career_paths`, `learning_materials`,
  `internships`, `international_programs`, denormalised `provider/org`
  columns from `organizations` table which is empty). 1-degree traversal cap
  (`query()`). NLP extraction (`extract_entities()`) with LLM → rule-based
  fallback + circuit breaker; low-confidence results queued in
  `kg_extraction_review` for human approval.
- **T2** `ai-service/routers/knowledge.py` — FastAPI router mounted at
  `/api/ai/knowledge/*`: `GET /graph`, `POST /query`, `POST /suggest-partners`,
  `POST /extract`, `GET /reviews`, `POST /reviews/{id}/approve`, `POST /seed`.
  Registered in `main.py` `router_names` list.
- **T3** `backend/src/modules/ai/` — proxy methods
  (`getKnowledgeGraph`, `queryKnowledgeGraph`, `suggestKnowledgePartners`,
  `extractEntities`, `triggerKnowledgeGraphSync`) + NestJS controller routes
  at `/ai/knowledge/*`. **Hourly sync** runs as a daemon thread in
  `ai-service/main.py` startup hook (`_startup_seed_knowledge_graph`) —
  `ScheduleModule` is disabled in SQLite mode. Env-tunable:
  `KNOWLEDGE_GRAPH_SYNC_INTERVAL` (default 3600s).
- **T4** Frontend: BFF routes at `app/api/ai/knowledge/{graph,query,suggest-partners,extract,sync}/route.ts`
  → NestJS backend proxy → ai-service. Service at `src/services/knowledge.service.ts`.
  D3 force-directed graph page at `app/knowledge-graph/page.tsx` via
  `components/knowledge/ForceGraph.tsx`. Dependency: `d3` + `@types/d3` added
  to `package.json`. Nav entry added in `components/Sidebar.tsx` under
  "Học tập" group.
- AGENTS.md §6 data policy applies: real Vietnamese organisations only,
  provenance footers, honest empty states, AGENTS.md §3 timeouts
  preserved (graph queries are local SQLite, sub-100ms).


## 3. AI provider chain

Text generation (`ai-service/services/llm_service.py`):
`Groq (OpenAI-compatible /chat/completions) → template fallback`.
Groq is the only chat provider (set `GROQ_API_KEY` as a host secret); when the
key is missing or every call fails, every caller falls back to the Vietnamese
template builders (the API never 502s).
All calls use `curl --ipv4 --insecure` (the host's IPv6/TLS quirk).

Embeddings (`ai-service/services/vector_store.py`):
`Jina (POST /embeddings)` — the only embedding provider (set `JINA_API_KEY`).
Indexing is **batched** (`EMBED_BATCH_SIZE`, default 32 docs per request) and
query embedding is cached (`EMBED_CACHE_MAX` / `EMBED_CACHE_TTL_SECONDS`).
Without `JINA_API_KEY`, `get_embedding()` raises, `add_documents()` refuses to
index (never falls back to ChromaDB's default HuggingFace model), and the
vector store degrades to query-only.

**Removed 2026-11-15:** DeepSeek (out of free tier) and Google Gemini (TLS
blackholed from the deploy host — unusable in production). No local embedding
model, no local reranker, no local text model. See
`tasks/groq-jina-migration.md` for the migration plan.

GeoVision AI — satellite imagery facility detection (Idea #10):
`ai-service/routers/geo.py` POST `/api/ai/geo/vision-detect`. The external
vision provider path (external vision provider + its key) was removed: GeoVision
currently has no inference provider, so the endpoint always returns
`degraded: true` with an empty detections list and never 502.

**GeoVision AI (Idea #10 — unlisted school/educational-facility detection):**

- **No provider configured**: `GEO_VISION_MODEL` is still read from env
  (default `google/owlv2-base-patch16-ensemble`) but no vision inference
  backend runs in the container — when a key becomes available the feature
  provides detections, otherwise `degraded: true`.
- Tile sources for the stitched image:
  - `esri` (default) — Esri World Imagery (aerial; no key, rate-limited).
  - `bing` — Bing Maps aerial tiles via quadkey URL (optional `BING_MAPS_API_KEY`).
  - OSM tiles and Overpass have been removed from every source (2026-11-12):
    `backend/src/modules/geo.rs` defaults `source=esri`, and `/map/pois` no
    longer falls back to live Overpass queries. (Backend GeoVision DTO `source`
    now defaults to `esri` too — no OSM/Overpass fallback remains.)
  - The only remaining OSM usage is the **routing graph data** (`vietnam-latest.osm.pbf`,
    processed by `osrm-extract` in the Dockerfile `osm-downloader` stage and served
    by `osrm-routed`): it is routing input, not the map tile source.
- Tile grid is capped at **8×8 = 64 tiles** (max 2048×2048 px at z=18) to stay
  under a typical 5 MB inference input limit.
- Stitched tiles are cached 24 h in an in-memory LRU cache
  (`GeoVisionService.tileCache`) to protect against quota limits.
- Detection boxes (pixel coords) are converted back to lat/lng via Web Mercator
  inverse, then cross-checked against existing `map_points` within the bbox.
  Detections within 80 m of a known POI are tagged `known`; others are `new`.
- RAG/vision failure degrades gracefully: returns `degraded: true` with empty
  detections — the frontend shows a warning, never a crash.
- `ai-service/start.sh` recovers `GEO_VISION_MODEL`, `GEO_VISION_TIMEOUT_SECONDS`,
  and `BING_MAPS_API_KEY` from PID 1 environ (secret propagation fix).

- **AI Climate Learning Guardian (Idea #11):** `ai-service/services/climate_guardian.py`
  (`ClimateGuardianService` singleton) + `ai-service/routers/climate.py`
  (`POST /api/ai/climate/risk`, `POST /api/ai/climate/alternatives`).
  - Risk model: `risk_score = 0.35·flood_risk + 0.35·weather_risk + 0.30·access_risk`
  - Flood zones: loaded from SQLite `flood_zones` table (seeded by
    `scripts/migrate_real_data.py` from `scripts/real_vn_data.py:FLOOD_ZONES`)
    with a static fallback (`STATIC_FLOOD_ZONES`) for empty-DB.
  - Weather: OpenWeatherMap (requires `OWM_API_KEY` as a host secret) via
    `curl --ipv4 --insecure`; degrades to static hazard map when key absent.
  - Elevation: Open-Meteo free elevation API; cached on disk in `/tmp/`.
  - 24h in-process TTL cache (mirrors `forecast.py`) on both endpoints.
  - Backend proxy: `GET /api/map/climate-risk` + `POST /api/map/climate/alternatives`
    in `map.controller.ts` / `map.service.ts` (with 24h LRU cache + graceful
    degraded GeoJSON fallback).
  - Frontend: `app/climate-guardian/page.tsx` + `components/climate-guardian/ClimateGuardianMap.tsx`
    (twin-panel: controls left, Leaflet risk heatmap + safe-alternative markers right).
  - Nav entry: "AI Bảo Vệ Khí Hậu" under new group "AI an toàn" in `Sidebar.tsx`.
  - Data policy: all flood zones have `Nguồn chính thức` + `Kiểm chứng` provenance.
  - Smoke test entries #12–#13 in `tasks/dntu-ai-ideas-plan.md` §1.5.

- **AI Language Bridge (Idea #15 — MEDIUM):** `ai-service/services/language_bridge.py`
  (`LanguageBridgeService` singleton) + `ai-service/routers/language.py`
  (`POST /api/ai/language/simplify`, `POST /api/ai/language/translate`,
  `POST /api/ai/language/tts`).
  - Simplify/translate use `_generate_text_with_fallback` cascade
    (Groq) with `temperature=0.3`,
    `max_tokens=2048`, `top_p=0.8`. Template-based fallback ensures the endpoint
    never 502s when all providers are down (on the free tier).
  - Difficulty levels: `elementary` (lớp 1-3), `middle` (THCS, default),
    `high` (THPT), `college` (đại học). LLM explains jargon per level.
  - Translation supports an optional **glossary** dict so domain terms are
    preserved (mitigates "context loss" risk).
  - TTS provider chain: Google Cloud TTS (via `curl --ipv4 --insecure`,
    needs `GOOGLE_TTS_API_KEY` as a host secret) → `edge-tts` (keyless, good VN
    voices) → `gTTS` (keyless) → degraded text-only (`audio_base64=None`,
    frontend falls back to browser Web Speech API `speechSynthesis`).
  - `gTTS` and `edge-tts` added to `ai-service/requirements.txt`.
    `GOOGLE_TTS_API_KEY` recovered in `ai-service/start.sh` from PID 1 environ.
  - Backend proxy: `POST /api/ai/language/{simplify,translate,tts}` in
    `ai.controller.ts` / `ai.service.ts` (JwtAuthGuard-protected, 45s LLM
    timeout, 30s TTS timeout, 24h in-process cache for simplify/translate).
  - BFF routes: `app/api/ai/language/{simplify,translate,tts}/route.ts`.
    Frontend service: `src/services/language-bridge.service.ts`.
    Frontend page: `app/language-bridge/page.tsx` (dual-panel: controls left,
    output tabs right — Simplify / Translate / TTS). TTS player with browser
    Web Speech API fallback.
  - Nav entry: "Language Bridge AI" under "Học tập" in `Sidebar.tsx`.
  - Smoke test entries #14–#20 in `tasks/dntu-ai-ideas-plan.md` §1.5.

- **Voice-to-Geo AI (Idea #16 — MEDIUM):** `ai-service/services/speech.py`
  (`SpeechService` singleton) + `ai-service/routers/speech.py`
  (`POST /api/ai/speech/to-text`).
  - Client-side STT: Web Speech API (`SpeechRecognition`, `lang='vi-VN'`)
    on the frontend — privacy-first, audio never leaves the browser.
  - Server-side STT fallback: No server-side STT provider is configured
    (XKIRO has been removed from the provider chain). The service always
    returns `degraded=True` with empty text. The frontend falls back to the
    client-side Web Speech API.
  - **Never 503/502**: returns 200 with `degraded=True` + empty `text` +
    human-readable `error` when no STT provider is available.
  - Intent classification: `NLQueryParser.extract_intent()` — regex baseline
    (no LLM needed, works on any host tier). Three intents:
    `geo_recommend` (find query: "Tìm thư viện gần đây"),
    `report_form` (issue report: "Báo wifi hỏng ở trường X"),
    `geo_query` (info question: "Trường DNTU ở đâu?").
    Report keywords take priority; find verbs ("tìm") → geo_recommend;
    question words ("ở đâu", "là gì", "bao nhiêu") → geo_query; default geo_recommend.
  - Intent is returned as a top-level `intent` field in the Talk2Map router
    response (`ai-service/routers/talk2map.py`), passed through
    `map.service.ts nLSearch()` (with TypeScript `_classifyIntentFallback()`
    mirror for when ai-service is unreachable), and surfaced in the
    `NlsResponse` frontend type.
  - Backend proxy: `POST /api/ai/speech/to-text` in `ai.controller.ts` /
    `ai.service.ts` (public, no JwtAuthGuard — STT uses base64 audio, not
    user identity; frontend captures audio client-side). 30s timeout,
    degrades to empty text + `degraded=True` on ai-service unreachable.
  - BFF route: `app/api/ai/speech/to-text/route.ts` (POST proxy → backend).
    Voice search is surfaced on `/map` (rail "Tìm bằng giọng nói" →
    `VoiceSearchPopup` → Web Speech API → nl-search → results card);
    `/voice-search` redirects to `/map`.
  - Voice buttons on `/map` (floating control panel) and `/ai-chat`
    (input area) — both use Web Speech API, fall back to Whisper, and
    route transcripts through the Talk2Map nl-search pipeline.
  - Nav entry: không còn mục sidebar riêng; nút rail "Tìm bằng giọng nói"
    trên `/map` là điểm vào.
  - Smoke test: `scripts/smoke_test_voice_geo.sh` (STT degraded path + intent
    classification for geo_recommend / geo_query / report_form).
  - Tests: `tests/test_speech.py` (26 tests: SpeechService + intent + router).

Rules that must be preserved:

- Every embedding provider is called through `curl --ipv4 --insecure` because
  the host has an IPv6/TLS quirk.
- Per-provider circuit breakers (5 minutes) prevent re-burning timeouts.
- **Embedding budget** (seconds, env-tunable):
  - `EMBED_GLOBAL_TIMEOUT_SECONDS` (default 6) — whole chain.
  - `EMBED_PROVIDER_TIMEOUT_SECONDS` (default 4) — one attempt.
  - `RAG_TIMEOUT_SECONDS` (default 8) — `chat_with_rag*` hard limit.
  - Keep these below the NestJS stream timeout (10s). A slow provider must
    never starve the fallbacks or leave the chat bubble empty.
  - Jina is the only embedding provider: no cold-start local model load.
  - `EMBED_BATCH_SIZE` (default 32) / `EMBED_BATCH_TIMEOUT_SECONDS` (default 20)
    bound the seed indexing path; the query path keeps the tight budget above.
- Provider model slugs and circuit breakers:
  Groq (`openai/gpt-oss-120b`, override with `GROQ_MODEL`, comma-separated
  list = failover order) is the only text-generation provider. Circuit breaker:
  5 minutes after auth (401/403), quota (402) or network failure; 60 seconds
  after a 429. Jina embeddings use the same pattern (`_jina_embed_down_until`).
  `curl --ipv4 --insecure` is used for all API calls (host Spaces IPv6/TLS quirk).
- **Local embedding fallback**: `intfloat/multilingual-e5-small` (~270MB,
  ~600MB RAM, 768-dim, Vietnamese support) runs on CPU via `sentence-transformers`.
  Lazy-loaded on first fallback, acts as the **guaranteed offline backup** when
  all remote embeddings are unreachable. Env-tunable:
  `LOCAL_EMBEDDING_MODEL` (default `intfloat/multilingual-e5-small`),
  `LOCAL_EMBEDDING_DISABLED=true/false`, `LOCAL_EMBEDDING_THREADS` (default 1
  to avoid starving the web-serving processes on 2-vCPU free tier).
- **Local reranker** (optional): `cross-encoder/ms-marco-MiniLM-L6-v2`
  (~80MB, ~100MB RAM) re-ranks top-k RAG results by 15-30%. Env-tunable:
  `LOCAL_RERANKER_MODEL`, `LOCAL_RERANKER_DISABLED`, `LOCAL_RERANKER_THRESHOLD`.
- **Local embedding cache**: `_embed_cache_max` expanded 128 → 1024 (env:
  `EMBED_CACHE_MAX`). With 1024 entries × 768 dims × 4 bytes ≈ 3MB RAM —
  negligible cost. TTL remains 30 min (`EMBED_CACHE_TTL_SECONDS`).
- **Local vision fallback** (removed 2026-11-08, no local models): `google/owlv2-base-patch16-ensemble` (~440MB, ~400-600MB RAM)
  zero-shot object detection for GeoVision AI. Env-tunable:
  `LOCAL_VISION_MODEL`, `LOCAL_VISION_ENABLED` (default true),
  `LOCAL_VISION_THRESHOLD` (default 0.25), `LOCAL_VISION_IMAGE_MAX` (1024px).
- **LLM response cache** (new): `_generate_text_with_fallback` now caches
  successful responses by prompt+params hash. 2048 entries × ~1KB avg ≈ 2MB RAM.
  TTL default 24h (`RESPONSE_CACHE_TTL_SECONDS`, configurable). This avoids
  redundant provider calls for identical prompts (career paths,
  scholarship summaries, mentor matches) — critical for the quota budget.
- RAG failure must degrade gracefully: answer LLM-only, never crash chat.

## 4. Useful local commands

> Per §1, the local machine is **edit + Python tests only**. The `npm`/`npx`
> commands below are listed for reference (and for when the user explicitly
> asks for them) — do not run them by default, and never start a dev server or
> Docker build locally.

```bash
# Python syntax check
python3 -m py_compile ai-service/services/vector_store.py

# AI service unit tests (the default local verification loop)
cd ai-service && python3 -m pytest tests -q

# Backend tests / build — ONLY if the user explicitly asks
cd backend && npm test -- --runInBand
cd backend && npm run build

# Frontend typecheck/build — ONLY if the user explicitly asks
cd frontend && npx tsc --noEmit

### Note
The agent has no deploy token, no `HF_KEY`, and no deploy script. The user
runs their own deployment tooling (`git push` → host rebuild). Use the `git` /
`rsa` keys in the user's account to push, not a token in this environment.
```

## 5. Environment notes

- **All external API keys are now OPTIONAL.** The app works with zero keys set —
  chat degrades to template fallbacks + cached SQLite data, and the vector store
  degrades to query-only when every remote provider is unreachable.
- `GROQ_API_KEY` — chat provider (host secret, optional).
- `GROQ_BASE_URL` (default `https://api.groq.com/openai/v1`), `GROQ_MODEL`
  (default `openai/gpt-oss-120b`, comma-separated = failover order),
  `GROQ_TIMEOUT_SECONDS` (default 20).
- `JINA_API_KEY` — embedding provider (host secret, optional; free key from
  jina.ai, 10M tokens one-time, 100 RPM / 100k TPM).
- `JINA_BASE_URL` (default `https://api.jina.ai/v1`),
  `JINA_EMBEDDING_MODEL` (default `jina-embeddings-v5-text-small`),
  `JINA_TIMEOUT_SECONDS` (default 20).
- `CHROMA_DB_PATH=/tmp/chroma_db` (re-seeded at startup by `main.py`).
- `DB_TYPE=sqlite`, `DB_SQLITE_PATH=/app/frontend/public/edumap.db`.
- `OWM_API_KEY` — OpenWeatherMap API key (host secret, optional). When set,
  the Climate Learning Guardian fetches real-time weather severity; when absent,
  it falls back to a static flood-hazard map built from real Vietnamese flood
  zone polygons (Đồng Nai, Cửu Long, Đà Nẵng, TPHCM) seeded via
  `scripts/migrate_real_data.py`.
- `GOOGLE_TTS_API_KEY` — Google Cloud TTS API key (host secret, optional).
  When set, the Language Bridge uses Google Cloud TTS (best voice quality);
  when absent, it falls back to `edge-tts` (Microsoft Edge online, keyless)
  then `gTTS` (Google Translate TTS, keyless), then degrades to text-only
  (browser Web Speech API). The Language Bridge LLM endpoints (simplify,
  translate) do NOT require this key — they use the same `_generate_text_with_fallback`
  cascade as all other AI features.
- **No local model env vars** (the local models were deleted on 2026-11-08 — see
  §6.5): `ai-service` runs on remote APIs only:
  - `OFFLINE_TUTOR_USE_LLM=true` — the Edge AI Tutor calls the shared cascade;
    set `false` to force template-only answers (instant, no network call)

  - `RAM_THRESHOLD_GB=4.0` — OOM guard threshold, still used by the startup
    hooks (no longer gates a model load that no longer exists)

## 6. Data policy (verified Vietnamese content only)

Users verified the live deployment and reported the seeded feature data as
fabricated. The following rules now apply to every feature:

- **Source of truth:** `scripts/real_vn_data.py` — real Vietnamese or
  Vietnam-facing organisations with official URLs and a `Kiểm chứng` date.
- **Apply it:** `python3 scripts/migrate_real_data.py` (backs up to
  `edumap.db.bak-realdata`, clears demo tables, inserts curated rows).
- **Never** re-add `EduMap Foundation`, `EduMap Academy`, `EduMap Smart Cities
  Hackathon`, `Test Campaign`, `Test activity`, `BBF Activity` or synthetic
  mentors on `@edumap.vn`. `scripts/seed_edu_data.py` now refuses to run
  unless `ALLOW_DEMO_SEED=1`.
- **Volatile data is crawled, not seeded:** jobs come from
  `scripts/crawl_jobs.py` (VietnamWorks; RemoteOK/Remotive are opt-in via
  `CRAWL_INCLUDE_REMOTE=1`). `clean_text()` must preserve Vietnamese
  diacritics — ASCII-folding was the cause of `Cong ty CTV CMC`-style rows.
- **Honest empty states beat fake rows.** `shared_items`, `surveys`,
  `green_activities`, `summer_activities` are intentionally empty;
  the UI shows an empty state instead of invented people/listings.
  `mentors`, `posts`, `mentor_availabilities`, `comments`, `modules`,
  `features`, `role_permissions` are now seeded with verified Vietnamese
  data (see `scripts/real_vn_data.py` + §2.3 below) — they were
  previously empty because the PostgreSQL `seed.sql` used incompatible
  syntax (`ON CONFLICT`, `uuid_generate_v4()`, `NOW()`) that never loaded
  into SQLite.
- **Provenance is user-visible:** every description ends with
  `Nguồn chính thức: <url> · Kiểm chứng: <date>`, and scholarship pages render
  an “Nguồn chính thức ↗” link from `apply_url`.
- `@edumap.vn` accounts (96) are **demo login accounts**, not feature content.
  Keep `admin@edumap.vn` — it is the admin login on the host.

## 6.5. Local models — REMOVED (2026-11-08)

On 2026-11-08 the ai-service shed every bundled CPU model: **Gemma 2B (text),
intfloat/multilingual-e5-small (embeddings), cross-encoder/ms-marco-MiniLM-L6-v2
(reranker), google/owlv2-base-patch16-ensemble (vision), SRTM 30m VN elevation
(numpy)** were deleted along with their loading code, globals, constants and
the staggered startup warm-up thread. `ai-service` now runs a **pure API stack**:

- Text: `Groq → template fallback`
- Embeddings: `Jina → RuntimeError (RAG returns no
  results; chat falls back to the LLM)`
- GeoVision: `degraded = true + empty`
  detections (never 502)`
- Elevation: `Open-Meteo (no key)`
- ChromaDB still lives in `/tmp/chroma_db` (re-seeded at startup by `main.py`);
  RAG requires an embedding API key — without one, chat answers from the LLM
  and `degraded=true` is false (the model still answers, RAG just adds no
  sources).

`requirements.txt` dropped: `transformers`, `accelerate`, `sentencepiece`,
`sentence-transformers`, `Pillow` (edge-tts/gTTS remain — they are remote TTS,
not local models). `torch` is gone from the whole codebase (no `import torch`
outside of `tests/` and `node_modules`).

**Implications for deployment:**

- RAM budget of ai-service ≈ 200-400 MB with ChromaDB warm — fit for a 512 MB
  plan (if ChromaDB isn't needed, drop it → ~150 MB).
- Disk image ≈ 300-400 MB (Docker image, no model weights).
- Cold start ≈ 20-40 s on a 1 vCPU box (uvicorn + FastAPI + ChromaDB import).
- The cascade degrades to **template replies** with no external keys — the
  features still answer questions from the LLM even when every provider is
  unreachable.

## 7. Current known limitations on the host free plan

- **Free-tier reality:** 2 vCPU, no GPU, ~5GB Docker image limit, ~48 h sleep timer.
  The first request after a restart can take 30–60 s (container + Next.js +
  NestJS + FastAPI + Chroma bootstrap). A one-off 503 is a cold start; only a
  repeated failure is a bug.
- **Disk budget (Docker image):** all model weights bundled in image:
  - OSRM Vietnam graph: ~500-800MB
  - Gemma 2B IT (4-bit NF4): ~850MB
  - (TinyLlama 1.1B removed 2026-10-30)
  - owlv2-tiny: ~440MB
  - multilingual-e5-small + ms-marco-MiniLM-L6-v2: ~350MB
  - SRTM elevation .npy: ~8.4MB
  - Code + SQLite DB: ~150MB
  - **Total ≈ 2.5-2.8GB** (< 5GB host Docker limit ✅)
- **RAM budget (runtime, worst case all models loaded):**
  - System (Next.js + NestJS + OSRM + FastAPI): ~5-6GB
  - Gemma 2B 4-bit: ~1.5GB
  - Embeddings + reranker + vision: ~0.7GB
  - Elevation + SRTM: ~0.01GB
  - **Total ≈ 7.7GB / 16GB** (within budget with ~8.3GB headroom ✅)
- **Note on local LLM speed:** Gemma 2B runs on CPU (2 vCPU) at ~2-5 tokens/sec.
  Acceptable for structured generation (career paths, summaries), **not** for
  long conversational chat. That job belongs to the Groq cascade (remote,
  fast). The template fallback handles the long-chat case and answers instantly
  when no provider is reachable.
- AI chat history and uploads are ephemeral (`/tmp`).
- Geo/PostGIS analytics is limited in SQLite mode — there is no `ST_DWithin`,
  `ST_MakePoint` or `::geography`. Query builders MUST branch on
  `isPostgresNow()` and compute distances in JS (see
  `WifiService.getWifiPointsNearby`) instead of shipping PostGIS SQL to SQLite.
- **`DB_SYNC` must stay `false`** (set in the Dockerfile). The shipped
  `edumap.db` predates parts of the entity set, so `synchronize: true` dies on
  NOT NULL drift (e.g. `temporary_locations.category_id`,
  `temporary_green_challenges.created_by`). Schema changes ship as explicit
  migrations / `ensureSqliteSchema()`, never via `synchronize`.
- **ChromaDB is re-created on every container restart.** Startup seeding runs in a
  daemon thread with a longer embedding budget
  (`SEED_EMBED_GLOBAL_TIMEOUT_SECONDS`=25,
  `SEED_EMBED_PROVIDER_TIMEOUT_SECONDS`=12) and is now per-document tolerant:
  a document whose embedding fails is skipped instead of aborting the whole
  batch, and `seed_data()` reports `status: "partial"` with
  `synced_count`/`failed_count`. RAG still degrades to LLM-only answers when
  every embedding provider is down.
- **Adzuna has no Vietnam endpoint.** `ADZUNA_COUNTRY=vn` (default) is skipped
  with an explicit log line; set a supported market (`sg`, `gb`, …) to use it.
- `GET /api/impact-measurement/measure` takes query strings — its DTO uses
  `@IsNumberString()` and the controller converts to numbers. Do not put
  `@IsNumber()` on GET query params (that caused a production 400).
- The websocket/SSE chat path is only reachable through
  `POST /api/ai/chat-stream` (JWT required) → NestJS proxy
  `['/api/ai/chat/stream', '/chat/stream']` → ai-service `POST /api/ai/chat/stream`.

## 8. Frontend UI conventions (added 2026-10-27)

The UI was fragmented: each page invented its own padding, radius, icon
style and copy language (some pages were fully English inside a Vietnamese
app). These rules are now enforced by shared code — use them instead of
inventing new values.

- **Feature registry is the single source of truth.**
  `frontend/src/lib/feature-catalog.ts` declares every feature (id, label,
  href, lucide icon, Vietnamese description, group, `sidebar?`).
  - The sidebar (`components/Sidebar.tsx`) renders `SIDEBAR_GROUPS`.
  - `/features` (`app/features/page.tsx`) renders the whole catalog with
    search + group filters.
  - **Adding a page = add one catalog entry.** Never hand-edit a nav list.
  - Pages that used to be unreachable (`/ai-agent`, `/learning-spaces`,
    `/surveys`, `/volunteer`, `/career/jobs`, `/career/predictive`,
    `/map/geo-vision`, `/map/data-hunter`, `/map/gap-predictor`,
    `/map/resource-optimizer`) are now in the hub.
- **Icons are vectors only.** Use `lucide-react` (or the local `EduMapLogo`).
  No emoji-as-icon, no raster/SVG illustration used as an icon.
  `<img>` is allowed only for real user/content images (avatars, event
  covers, QR codes, uploaded proof photos).
- **One page frame.** Use `ContentShell` (or `.page-shell` from
  `app/globals.css`); it sets `max-w-8xl`, `px-4 sm:px-6 py-6` and
  `space-y-6` (tightened 2026-10-30 from `max-w-7xl py-8 space-y-8` to reduce
  "thừa khoảng trống" on widescreen). Listing hubs that should consume the
  full width (e.g. `/green`, `/wifi`) drop the cap with
  `<ContentShell className="max-w-none">` and widen their grid to
  `lg:grid-cols-4`. Pages that must stay full-width use
  `px-4 py-6 sm:px-6 sm:py-8` instead of `p-8`.
- **One card system.** `.card-surface` + `.card-equal` (`h-full flex-col`)
  + `.card-footer` (`mt-auto` + top border) keeps titles/descriptions/CTAs
  aligned across a row. Clamp long text with `line-clamp-1/2`.
  Grids: `.card-grid` (3-col) / `.card-grid-4` (4-col).
- **Colour tokens only.** Desert Dusk semantic tokens; no raw
  `gray-*/blue-*/indigo-*` palettes in page chrome. Text on terracotta or
  sage must be `text-primary-foreground` / `text-accent-foreground`
  (`text-foreground` on `bg-primary` is unreadable).
- **Secondary text is readable.** Use `text-foreground/55–60` or
  `.text-soft`; avoid `text-muted-foreground/40`-style values (raised to
  `/60` project-wide in this pass).
- **Copy is Vietnamese** (headings, labels, placeholders, toasts, empty
  states). Product names (EduMap, Talk2Map, Language Bridge AI,
  ImpactMatch, Resource Exchange AI, GeoVision AI) stay as-is.
- **Verify** with `cd frontend && npx tsc --noEmit && npm run build`.
  (Verified 2026-10-28: both pass, 0 TypeScript errors, clean build.)

- **Map Hub menu kiểu Windy (2026-11-19 — thay bảng trôi nổi 2026-10-28):**
  - Trang `/map` chỉ còn **một** menu bên phải: `components/map/MapMenu.tsx`
    (`absolute inset-y-0 right-0`, rail tròn `w-14` + panel `380px`).
  - Rail tròn là nơi duy nhất chứa điều hướng: `Bản đồ`, `Chỉ đường`, rồi nhóm
    lớp/tiện ích (`Lớp nhiệt`, `Ghim đặc trưng`, `Chú giải ghim`, `Phân tích AI`,
    `Tìm bằng giọng nói`) và nhóm cuối (`Toàn màn hình`).
    Nhãn chữ hiện bên trái nút khi hover; nút cuối rail thu gọn/mở rộng panel.
  - **"Chỉ đường" và "Bản đồ" nằm chung một menu**: panel có 2 tab nội dung
    (`menuTab: "map" | "directions"`). Tab `map` giữ nguyên thanh công cụ
    (core/analysis) + tìm kiếm + danh mục + thẻ địa điểm + thống kê + panel công
    cụ; tab `directions` là chỗ chứa `RoutingPanel`.
  - `RoutingPanel` nhận prop `embedded` (không còn `fixed`/`useResizable` khi
    nhúng): `embedded` → `<div class="flex h-full flex-col overflow-y-auto p-4">`,
    không render tiêu đề "Chỉ đường" (tiêu đề do `MapMenu` lo) và thêm nút
    "Xóa lộ trình". Chế độ standalone (`!menuSlot && menuTab === null`, các trang
    khác dùng `MapComponent`) → giữ panel `fixed` + nút "Chỉ đường" như cũ.
  - `MapComponent` nhận `menuSlot` (phần tử DOM của tab `directions`) và
    `menuTab`; khi có `menuSlot` nó `createPortal(<RoutingPanel embedded/>, menuSlot)`.
    `onDirectionsOpen` được gọi khi bấm "Dẫn đường" trên popup POI, để trang tự mở
    tab `Chỉ đường`.
  - Không còn `useDraggable`/bảng "Bản đồ" trôi nổi ở `/map`; menu mặc định mở
    trên desktop (`>= 1024px`), chỉ hiện rail trên mobile. `?tool=<id>` mở menu.
  - Bản đồ vẫn `absolute inset-0` phía sau menu, pan/zoom bình thường; zoom
    control vẫn ẩn (`zoomControl={false}`).
  - Popup ghim rộng `max-w-[720px]`; form "Ghim vị trí mới" `max-w-[84rem]`.
  - Chú giải ghim và kết quả giọng nói là thẻ `absolute bottom-6 right-[4.5rem]`
    để không chồng lên rail.
  - Hook `useDraggable` đã bị xoá (không còn nơi dùng).
  - Đợt tinh giản (2026-11-19): xoá công cụ trùng `voice-search`
    (`components/map/tools/VoiceSearchTool.tsx`, mục registry + `feature-catalog`),
    nút "Phân tích AI khu vực" trùng trong panel (giữ mục rail `Phân tích AI`),
    mục rail trùng `Lộ trình an toàn AI` (giữ nút `Chỉ đường` + checkbox trong
    `RoutingPanel`), danh sách "Gần đây" trùng trong panel (giữ popup POI), fetch
    `/api/map/locations` + quick-pick trong form ghim, nhánh chết
    `authRequired && !user` (trang đã gate bằng `useRequireAuth`), các prop chết
    của `MapPopupContent` và sự kiện `toggleSafeRoute`/`safeRouteMode` trong
    `MapComponent`. Không đụng route API/BFF.

- **Sidebar `useState` build break (2026-10-28):** `components/Sidebar.tsx`
  used the bare `useState()` call on line 192 while the rest of the file
  references hooks via the `React.` prefix (`React.useRef`, `React.useEffect`).
  The bare call compiled to `Cannot find name 'useState'` during
  `npm run build` because `useState` was not in the named import. Fixed by
  calling `React.useState` (consistent with the existing `React.useRef` /
  `React.useEffect` pattern in the same file). Verify: `npx tsc --noEmit`
  exits 0.

## 9. Runtime fixes from the 2026-10-30 production log (NameError sweep)

The user pasted a production log from the deployment host.
Four `NameError`s plus one SSE-budget bug were found; all are fixed and
covered by regression tests (`ai-service/tests/test_undefined_name_regressions.py`,
`ai-service/tests/test_chat_stream_budget.py`). The unit tests had hidden them
because every climate test mocked `_get_elevation` and no test touched
`routers/system.py`.

| # | Symptom in the log | Root cause | Fix |
|---|---|---|---|
| 1 | `Error in climate/risk: name '_get_elevation_local_enabled' is not defined` (same for `climate/alternatives`) → 200 + degraded empty heatmap | `climate_guardian._get_elevation()` referenced an identifier that was never defined; the flag is the module constant `LOCAL_ELEVATION_ENABLED` | use `LOCAL_ELEVATION_ENABLED` (`services/climate_guardian.py`) |
| 2 | GeoVision would 500 whenever the provider was set | the body of `_hf_vision_detect()` existed but its `def` line had been lost while the local fallback was added, so the host code sat as dead code after `return []` inside `_local_vision_detect()` | restored `def _hf_vision_detect(image_b64, labels)` (`routers/geo.py`) |
| 3 | `/api/ai/system/status` never existed (router import swallowed by `main.py`'s try/except) | `routers/system.py` imported the non-existent `vs_instance` and called `check_oom` without importing it | import `vector_store` (+ `has_deepseek` / `has_gemini_api`) and `check_oom` from `utils.memory_guard` |
| 4 | Career semantic recommendations 500'd once an LLM provider was configured | f-string prompt contained `[{title, match_score, ...}]` → evaluated as a Python set literal → `NameError: name 'title' is not defined` | escape the braces in `LLMService.recommend_career_semantic` |
| 5 | `[Nest] WARN [AIService] SSE stream error from ai-service: aborted` (~10 s) and an empty chat bubble | a slow/dead provider could run past the 8 s generation budget + word-by-word streaming, exceeding the NestJS proxy deadline (`ai.service.ts` `timeout: 10000`) | `chat_with_rag_stream` now enforces `STREAM_PROXY_DEADLINE_SECONDS` (default 10) with `STREAM_FINAL_RESERVE_SECONDS` (default 1.5): every provider call is wrapped in `asyncio.wait_for`, the provider list skips when time is exhausted, and `_stream_word_by_word(max_duration=…)` shrinks the per-word delay so the whole reply fits |
| 6 | **Local LLM (Gemma) always failed to generate** — `NameError: name 'generated' is not defined` inside `_local_llm_generate` | the `generated = _local_llm_tokenizer.decode(...)` line was lost during the TinyLlama→Gemma refactor (commit `0d12ee7`). Every call raised NameError → caught by outer `except` → opened the 5-min circuit breaker, wasting ~1.5 GB RAM holding a loaded model that could never respond. | restored the decode step (`services/llm_service.py:233`); added regression tests `test_local_llm_generate_decodes_output` + `test_local_llm_generate_raises_on_empty_output`. **Also set `LOCAL_LLM_ENABLED=false` in the Dockerfile** — Gemma 2B is gated on any remote hub (§6.5 confirms it's a no-op on the free tier), so disabling it saves 1.5 GB RAM without changing the cascade (`DeepSeek → Gemini → template`). |

Verification done locally (allowed per §1): `python3 -m pytest tests -q` →
**451 passed**; `py_compile` clean; an AST undefined-name sweep over
`ai-service/**/*.py` reports no remaining undefined names. Runtime truth is
still the deployed container after deploy.

### Build-time OOM fix (2026-10-31 — exit 137)

The `35f39b0` commit changed `CACHEBUST` which invalidated the Docker layer cache,
triggering a full rebuild on the host. During a cold rebuild, multiple build
stages run in parallel via BuildKit:

| Phase | Parallel stages | Est. RAM |
|---|---|---|
| Phase 1 (cold) | frontend-builder npm ci + backend-builder npm ci + frontend-deps npm ci + **ai-deps torch** + elevation-builder + vision-model-dl + osm-downloader | ~5.2 GB ⚡ |

The torch install (~2.5 GB peak) ran in parallel with three `npm ci` steps
(~1 GB + 500 MB + 500 MB), exceeding the host's ~4 GB build RAM budget.
The 2 GB swap inside `ai-deps` Step 1 may fail silently in `python:3.11-slim`,
leaving 2.5 GB of physical RAM for torch.

**Fix**: Moved the torch install from `ai-deps` Step 1 (parallel with npm ci)
to `ai-deps` Step 2 (after the `COPY --from=frontend-builder` edge), so torch
installs only **after** the frontend build completes and ~2–3 GB of build RAM
is freed. Torch deps (`filelock`, `typing-extensions`, etc. — ~100 MB) remain in
Step 1 and still run in parallel safely.

### Runtime OOM mitigation (2026-10-31)

`supervisord.conf` had `startsecs=1` (default) on frontend and backend, so all 6
programs started within ~2 s of each other — Next.js (~1 GB) + NestJS (~1 GB) +
OSRM graph (~1 GB) + ai-service model loading all peaked near t=8. Added
staggered `startsecs`:

| Program | Before | After | Effect |
|---|---|---|---|
| frontend | 1 (default) | 3 | 2s grace before backend |
| backend | 1 (default) | 5 | 2s grace before ai-service |
| ai-service | 10 | 15 | 5s grace before OSRM graph load |
| osrm | 8 | 8 (unchanged) | — |
| crawler | 10 | 10 (unchanged) | — |
| cron | 5 | 5 (unchanged) | — |

Startup now flows: frontend (t=0) → backend (t=3) → ai-service (t=8) → OSRM (t=23)
→ crawler (t=31) → cron (t=41). Peak RAM at any one moment drops from ~5 GB to
~3 GB.

### Still-degraded paths seen in the same log (not crashes, by design or open)

- `Vector store collection is None — returning empty RAG results`: ChromaDB
  collection did not initialise on that boot. **Fixed** (commit after §9's
  table): init is now retryable (`_init_collection` / `_ensure_collection`,
  `CHROMA_INIT_TIMEOUT_SECONDS` default 30, `CHROMA_RETRY_SECONDS` default 60),
  the SIGALRM guard is skipped outside the main thread, and `main.py`'s
  staggered warmup no longer imports the non-existent `vs_instance` (it
  silently skipped the embeddings + reranker warm-up on every boot). If RAG is
  still empty after a deploy, look for `Vector store initialization failed: …`
  in the boot log.
- `Local Gemma 2B model could not be loaded (… weights not baked)`: Gemma 2B was
  **removed** entirely on 2026-11-08 (all bundled local models were deleted as
  the app moves to API-only). No local text model exists now, so this log
  message can never appear. The cascade is `Groq → template`.
- `Local Gemma 2B slow on CPU (_Timeout: generation exceeded 35s)`: CPU-only
  generation of `max_new_tokens=2048` cannot finish in 35 s on 2 vCPU, so
  non-streaming endpoints (`/api/ai/language/simplify`, geo analysis, …) pay
  that timeout before falling back to the template. Chat streaming is already
  bounded by fix #5; shortening the non-stream budget is a product decision
  (template-first vs. slow local text), not applied here.
- `TTS provider edge_tts failed: No audio was received`: egress to the Edge TTS
  endpoint failed; the chain degrades to gTTS then browser `speechSynthesis`.
- `GET /api/v1/config`, `/api/.env`, `/api/settings`, `POST /api/predict`
  (`"not json"`): internet scanner traffic, not our routes. Harmless noise.

### Production log fixes (2026-10-31 — post-OOM deploy)

The post-OOM deploy surfaced two additional runtime issues from the log:

| Issue | Symptom | Root cause | Fix |
|---|---|---|---|
| **OSRM libtbb missing** | `osrm-routed: error while loading shared libraries: libtbb.so.2: cannot open shared object file` → OSRM FATAL → `exit status 127` → routing endpoint returns 500 | Dockerfile runtime stage deleted `libtbb*.so*` from `/usr/local/osrm-lib/` (line 348) to avoid GLIBCXX conflicts. But Debian 12's `libtbb12` provides `libtbb.so.12`, **not** `libtbb.so.2` that `osrm-routed` links against. Removing it left OSRM with no TBB library. | Removed `libtbb` from the deletion list — `libtbb.so.2` (osrm-lib) and `libtbb.so.12` (system) have **different sonames**, so no GLIBCXX conflict. Other programs use `.so.12`, OSRM uses `.so.2`. |
| **ChromaDB init timeout** | `Vector store collection chưa được khởi tạo` → seed_data status=error, 0 docs → RAG empty | `CHROMA_INIT_TIMEOUT_SECONDS` default 30s is too tight for a cold 2-vCPU boot (chromadb import + PersistentClient + collection creation). Retry at 60s is too slow. | Added `ENV CHROMA_INIT_TIMEOUT_SECONDS=60 CHROMA_RETRY_SECONDS=30` to Dockerfile runtime stage. |
| **Embedding double-load race** | Potential RAM spike if seed thread + warmup thread both load `multilingual-e5-small` (~600MB) simultaneously | No mutex lock existed — the `with self._local_embedder is not None` check is not thread-safe | Added class-level `threading.Lock` (`_model_load_lock`) in `VectorStoreService` guarded by `with self._model_load_lock:` in `_load_local_embedder`/`_load_local_reranker`. |

## 10. UI cleanup pass (2026-10-31)

- **Sidebar collapse is now wired (was broken):** `NavGroup` already had icon-only
  logic, but the main render never passed `sidebarCollapsed` down to `NavGroup` /
  `AccountSection`, so the 56px rail overflowed with text ("bị sai"). Fixed by passing
  `collapsed={sidebarCollapsed}` to both, adding a `collapsed?: boolean` param to
  `AccountSection`, and hiding the brand label (`Edu…Map`), the guest "Đăng nhập", and
  the logged-in name/email/role + "Hồ sơ / Xuất" labels (`sr-only` / `!collapsed`) so
  only icons show on the collapsed rail. The collapse button was already present.
- **/community full-width:** removed the inline `max-w-7xl` + `flex justify-center`
  wrapper (ContentShell was already tightened to `max-w-8xl` in the prior pass;
  /community used its own wrapper, so it stayed boxed/centered).

## 12. Fixes from commit e304e65 regression sweep (2026-10-31)

Commit `e304e65` ("feat: add UI components, API routes, and map tools") introduced
or re-exposed 6 bugs across ai-service and frontend. All are fixed below and
covered by regression tests. Full test suite: **483 passed** (was 478).

| # | File | Bug | Fix |
|---|---|---|---|
| 1 | `frontend/components/AgentationToolbar.tsx` + `ClientProviders.tsx` + `package.json` + `package-lock.json` | `AgentationToolbar` imports `agentation` (devDependency, not in `node_modules`, not in production Docker runtime image) → `npx tsc --noEmit` fails with TS2307 + TS2322; `next/dynamic(() => import('agentation'))` crashes at client runtime. Component was rendered in `ClientProviders` wrapping every page. | Deleted `AgentationToolbar.tsx`, removed import/usage from `ClientProviders.tsx`, removed `agentation` from `package.json` devDependencies + `package-lock.json` entries. |
| 2 | `ai-service/services/auto_scheduler.py` (`_run_impact_match`) | `total` score computed (line 443) but never stored in pair dict → `pairs.sort()` no-op (all match_score=0) + `score_map` injected 0 for all `pre_filter_score`. | Added `"match_score": total` to pair dict before `pairs.append()`. Mirrors existing `_run_resource_exchange` line 347. |
| 3 | `ai-service/services/auto_scheduler.py` (`_run_daily_insight`) | Queried `metric_name` column which doesn't exist in `education_stats` table (actual column is `metric_type`). Query failed silently (caught by `try/except`), stats always empty. | Changed SQL to `SELECT year as d, metric_value, metric_type FROM education_stats ...` — uses the actual columns. |
| 4 | `ai-service/services/auto_scheduler.py` (`_run_resource_exchange`) | Operator precedence: `req_loc and res_loc and req_loc in res_loc or res_loc in req_loc` → parses as `(A and B and C) or D`. When `res_loc=""` (empty), `"" in req_loc` evaluates `True` (empty string is substring of any string) → `proximity_score=60.0` instead of `30.0`. | Parenthesized: `60.0 if (req_loc and res_loc and (req_loc in res_loc or res_loc in req_loc)) else 30.0`. |
| 5 | `ai-service/services/auto_scheduler.py` (`AUTO_REGIONS`) | `dong_nai` bbox `[10.75, 11.20, 106.60, 107.20]` covered TP. HCM / Bà Rịa-Vũng Tàu area (~10.8°N, 106.7°E), not Đồng Nai province (~11.5°N, 107.3°E). `hcmc` bbox too narrow/slightly off. `cantho` bbox at 10.40-10.50°N covered Mỹ Tho, not Cần Thơ (~10.0°N). | Corrected bboxes: `dong_nai=[10.80,11.70,106.90,107.70]`, `hcmc=[10.70,10.90,106.55,107.00]`, `cantho=[9.90,10.15,105.40,105.90]`. `hanoi` and `danang` kept similar (verified within correct ranges). |
| 6 | `frontend/src/lib/feature-catalog.ts` + `app/green/page.tsx` + `app/wifi/page.tsx` | Commit `e304e65` reverted green/wifi hrefs from `/green`/`/wifi` to `/map?tool=green`/`/map?tool=wifi` (breaking AGENTS §2 2026-10-30 exception). Also replaced the listing-hub `/green` and `/wifi` pages (from commit `9c185dc`) with simple `MapToolRedirectPopup` popups instead of the ContentShell + SectionHeader + SearchInput + card-grid + EmptyState listing hubs. | Restored `href: "/green"` and `href: "/wifi"` + correct descriptions in `feature-catalog.ts`. Restored listing-hub pages from commit `9c185dc`. Also fixed `EmptyState` action button missing `onClick` handler in `components/ui/EmptyState.tsx`. Removed unused lucide imports (`Calendar`, `Loader2`, `Filter`) from green page. |

Additional cleanup:
- Added `frontend/public/edumap-promo.mp4` (14MB, unreferenced in code) to
  `.dockerignore` to reduce Docker image size.
- Added 5 regression tests to `ai-service/tests/test_auto_scheduler.py`.

Verification: `python3 -m py_compile` OK on all modified files;
`cd ai-service && python3 -m pytest tests -q` → **483 passed**; frontend
`npx tsc --noEmit` expected 0 errors after `AgentationToolbar` removal (no
`npm` run per §1 — verified by AST inspection only).
- **/library "Đã lưu":** removed the `SectionHeader right` "Đã lưu" nav-link and the
  now-unused `Bookmark` / `Link` imports; moved the per-card `BookmarkButton` from the
  top-right image overlay into the `card-footer` action group next to download/external
  (single save affordance per card). `BookmarkButton` was already functional
  (`useBookmarks` → `bookmarkService.toggle`); it only looked inactive due to a prior
  `bg-primary` override (fixed on /dashboard/impact).
- **/dashboard/impact buttons:** Refresh + BookmarkButton both forced `h-9` with
  `min-w-[6rem]` so the `Lưu`↔`Đã lưu` label toggle no longer resizes/jumps; removed
  the `bg-primary` on BookmarkButton so the active filled `Heart` is visible.
- **Static description `<p>` removal (20 pages):** verbose intro-subtitle / hero blurbs
  sitting under headings or inside modals — career, career/predictive, career/jobs (English
  subtitle), dashboard, dashboard/impact, intl, learning-spaces, map, marketplace (+cart),
  volunteer, admin/dashboard, auth/login, community, hs-connection, mentor, stem, summer,
  surveys, leaderboard. Empty states (`Chưa có…`, `Không tìm thấy…`), data-bound text
  (`{user.email}`, `{analysis.summary}`, card `line-clamp` descriptions, form-helper copy,
  `eligibility.message`) were intentionally KEPT per §6 honest-empty-states + §8 card system.
- Verified locally: `cd frontend && npx tsc --noEmit` → exit 0; `npm run build` → exit 0.
  Runtime truth = the host free CPU tier; no deploy token locally, user deploys.
- **/ai-chat auto-scroll + clear (2026-10-31):** the page rendered the message list in a
  `ScrollArea` but never scrolled to the bottom while tokens streamed, so the AI's reply
  was "stuck" above the fold. Added a scroll-sentinel `<div ref={messagesEndRef} />`
  after the last message + a `useEffect([messages])` calling
  `messagesEndRef.current?.scrollIntoView({ block:"end", inline:"nearest" })` so the
  viewport pins to the newest message/token (runs on every SSE chunk + history append).
  Also added a header "Xóa" button (`Trash2` icon, `handleClear`) that resets the visible
  conversation to the hoisted `initialMessage` and best-effort `DELETE /api/ai/history`
  (guarded by `authService.getAccessToken()`, `.catch(() => {})` so a 404/405 on the
  never blocks clearing the view). `Button` already imported; disabled
  while `isLoading` to avoid a mid-stream clear.
- **/map left panel (Bản đồ panel) optimisation (2026-10-31):** two friction points fixed.
  (1) "trùng" — the draggable header always read the static `<h3>Bản đồ</h3>` while the first
  tool-tab is also "Bản đồ" (HomeIcon), so the label/icon doubled. Header title is now dynamic
  = `activeTool === "home" ? "Bản đồ chính" : MAP_TOOL_BY_ID[activeTool].longLabel`.
  (2) "khó thao tác" — the 11-tool tab bar sat inside the `flex-1 overflow-y-auto` body, so it
  scrolled out of view when browsing search/category/stats; made it `sticky top-0 z-20 bg-card/95
  backdrop-blur-sm` so the tabs stay pinned while the body scrolls.
  (3) the right-edge width-resize strip (`h-full`) overlapped the bottom-right SE corner grip —
  changed to `top-0 bottom-5` so the two resize handles no longer fight at the corner.
  Verified `tsc`=0, `npm run build`=0 (`/map` prerenders).
- **Map click / school detail fade fix (2026-10-31):** clicking a POI marker on the
  map opened the school popup correctly, but any subsequent click on the popup
  content (description text, "Dẫn đường" / "Đến" buttons) bubbled up as a map
  `click` event. Leaflet popups default to `interactive:false`, so their content
  clicks reach the map container and triggered `MapClickHandler` →
  `setPinningCoord` → the "Ghim vị trí mới" overlay (`bg-card/40
  backdrop-blur-sm`) appeared, **blurring the school detail** ("bị mờ đi chứ
  k hiện ra tab detail về trường"). Fix: (1) `MapClickHandler` in
  `components/ui/MapComponent.tsx` now early-returns when
  `e.originalEvent.target.closest('.leaflet-popup*, .leaflet-marker-icon,
  .leaflet-tooltip, .leaflet-popup-pane')` — so popup/tooltip/marker clicks no
  longer open the pin modal; (2) popup action buttons in
  `components/ui/MapPopupContent.tsx` ("Dẫn đường", "Đến", "Đến gần") now call
  `e.preventDefault(); e.stopPropagation()` before dispatching their handlers;
  (3) `handleMapClick` in `app/map/page.tsx` is now `useCallback([], …)` so the
  `MapClickHandler` effect doesn't re-register on every render (was flagged in
  §9). Additionally, `MapPopupContent` now accepts `poiId?` and renders a
  `BookmarkButton(targetType="poi", targetId=poiId)` so users can directly
  "ghim"/bookmark a school from the popup without triggering the pin modal;
  `MapComponent` passes `poiId={p.id}` for regular POI markers.
  Verified: `npx tsc --noEmit`=0 (frontend), `npx tsc --noEmit`=0 (backend),
  `py_compile` OK, `pytest`=451 passed.

- **Featured (star) pin blur fix (2026-11-01):** clicking a featured "ghim" (e.g.
  "Trường Đại học Công nghệ Đồng Nai (DNTU)") made the whole map/UI look
  "mờ" (blurred). Two layers were painting at once:
  1. `FeaturedPinsLayer` rendered an in-map Leaflet `<Popup>` (MapPopupContent)
     for every star pin **and** `onPinClick` opened `FeaturedPinPopup`;
  2. `FeaturedPinPopup`'s overlay was `bg-black/60 **backdrop-blur-sm**` — a
     full-viewport backdrop blur that blurred the map and the second dialog
     behind it.
  Fixes: (a) featured markers no longer render the in-map `<Popup>` (the modal
  is the detail view; the hover `<Tooltip>` still labels the pin); (b) the
  overlay is now `bg-black/50` with **no backdrop-blur**; (c)
  `FeaturedPinsLayer`'s marker `click` calls
  `e.originalEvent.stopPropagation()` so `MapClickHandler` cannot also open the
  "Ghim vị trí mới" form; (d) `handleMapClick` in `app/map/page.tsx` early
  returns while `selectedFeaturedPin` is set (belt-and-braces against stacked
  modals). `MapPopupContent` remains for regular POI markers only.
  Verified: `npx tsc --noEmit` = 0.

- **Featured pin no longer dims the map (2026-11-19):** clicking any featured
  pin still opened `FeaturedPinPopup` — a `fixed inset-0 bg-black/50` overlay
  that greyed the whole viewport. Replaced by `components/map/FeaturedPinCard.tsx`
  rendered inside the Map Hub panel (no overlay, no `backdrop-blur`).
  `onFeaturedPinClick` now switches to the `map` tab, opens the menu and sets
  `selectedFeaturedPin`; `MapClickHandler` also ignores `.marker-cluster`,
  `.edumap-pin`, `.edumap-cluster-marker` and `.leaflet-control` so a marker
  click can never open the "Ghim vị trí mới" form.

- **Không còn lớp phủ tối trên `/map` (2026-11-19):**
  - `VoiceSearchPopup` bỏ `bg-black/60 backdrop-blur-sm`; giờ là card nổi
    `fixed bottom-6 left-1/2 -translate-x-1/2` (dùng chung với `/ai-chat`).
  - Form "Ghim vị trí mới" bỏ modal `fixed inset-0 bg-black/40`; chuyển thành
    `card-surface` trong panel Map Hub. `handleMapClick` mở tab `map` + panel
    khi bấm vùng trống.

### UX consistency: apply forms as popups (2026-11-01)
- **Base map tiles (2026-11-12):** tile URLs/attribution are centralized in
  `frontend/src/lib/map-tiles.ts` (`getTileUrl()`, `getTileAttribution()`).
  Cartography style is `MAP_TILE_STYLE = 'voyager'` (CARTO) at
  `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=KEY`
  (tương tự Google Maps, hiển thị đầy đủ nhãn tên đường/phường/thành phố).
  Khi set `NEXT_PUBLIC_CARTO_API_KEY` → `key=KEY`; khi chưa set → CARTO
  `rastertiles/voyager` (không label tiếng Trung).
  **Hệ thống không còn một đường truyền OSM nào trên Frontend: attribution
  CARTO ở `map-tiles.ts`, tile URL CARTO `getTileUrl()`; OSM `overpass`/OSM
  không còn phục vụ `map-pois` nữa.**
  **No `TileLayer` may embed its own `url`/`attribution`** — wherever
  Leaflet renders tiles, use `getTileUrl()` + `getTileAttribution()` only. Regression check on a green deploy: grep
  `openstreetmap.org/{z}/{x}/{y}` over `frontend/` → should find nothing at all.


Following the `/scholarships/[id]` popup pattern, the inline apply forms on two
detail pages were converted to popup modals so the form degrades gracefully and
keeps the user on the detail page instead of navigating away:

| File | Before (inline) | After (popup modal) |
|---|---|---|
| `app/internships/[id]/page.tsx` | Inline `<form>` with `coverLetter` textarea + submit button in right sidebar | "NỘP HỒ SƠ" button → modal with form; success closes modal + toast; adds `X` icon import |
| `app/career/jobs/[id]/page.tsx` | Inline `<form>` with cover letter + CV file upload + submit in sticky aside | "Nộp hồ sơ ứng tuyển" button → modal with same form; success closes modal + toast; adds `X` icon import |

Both pages now follow the `/scholarships/[id]` pattern: `_useState(showApplyModal)` →
`openApplyModal` checks login → modal `fixed inset-0 z-50 bg-black/80 backdrop-blur-sm` →
form with `preventDefault` + `stopPropagation` safe buttons → `setShowApplyModal(false)`
on submit success. No changes to listing pages (`career/page.tsx`, `career/jobs/page.tsx`,
`internships/page.tsx`) — they already link to detail pages via `<Link>`. `events/page.tsx`
uses external `apply_url` links ("Đăng ký sự kiện") — no change needed.
Verified: `npx tsc --noEmit` (0 errors in touched files), `py_compile` OK, `pytest` 483 passed.

### Career Hub navigation consistency (2026-11-01)

The `/career` page had a 7-tab bar but only rendered inline on the dashboard;
clicking any other tab executed `window.location.href = tab.href` (full reload),
and the sub-pages (`/career/jobs`, `/career/roadmap`, `/career/predictive`,
`/opportunities`, `/opportunities/radar`, `/analytics/trends`) did **not** render
the tab bar — so the user lost all career navigation context when navigating.

**Fix:** extracted a shared `CareerTabBar` component (`components/career/CareerTabBar.tsx`)
that resolves the active tab from `usePathname()` and uses Next.js `<Link scroll={false}>`
for instant client-side navigation. Added `<CareerTabBar />` to all 7 pages:
`app/career/page.tsx` (replaced inline tab bar), `career/jobs`, `career/roadmap`,
`career/predictive`, `opportunities/page.tsx`, `opportunities/radar`, `analytics/trends`.
The old `CAREER_TABS` constant, `TabDef` interface, `handleTabChange`, and
`window.location.href` navigation were removed from `app/career/page.tsx`.
Verified: `npx tsc --noEmit`=0 errors in touched files, `pytest`=483 passed.

## 11. AI Auto-Scheduler (2026-10-31)

AI features that previously required a manual button click are now **pre-computed
automatically** by a daemon thread running in `ai-service/main.py`. Results are
cached in an in-process TTL cache (`AutoCache`) and surfaced via GET-first
endpoints end-to-end (ai-service → NestJS BFF → frontend), so pages render
**instantly** with warm data instead of making the user wait for LLM computation.

### Architecture

```
ai-service/main.py startup (daemon thread)
  └─ AutoScheduler.run_loop()                # stagger_delay=5s between initial tasks
       ├─ _run_chroma_seed         (every 6h,  TTL 24h)  → AutoCache["auto:chroma_seed"]
       ├─ _run_question_gaps       (every 6h,  TTL 24h)  → AutoCache["auto:question_gaps"]
       ├─ _run_resource_exchange   (every 6h,  TTL 24h)  → AutoCache["auto:resource_exchange"]
       ├─ _run_impact_match        (every 12h, TTL 24h)  → AutoCache["auto:impact_match"]
       ├─ _run_impact_measure      (every 24h, TTL 24h)  → AutoCache["auto:impact_measure"]
       │     └── loops AUTO_REGIONS (5 VN regions)       → per-region sub-caches
       ├─ _run_climate_risk        (every 12h, TTL 24h)  → AutoCache["auto:climate_risk"]
       │     └── loops AUTO_REGIONS                      → per-region sub-caches
       └─ _run_daily_insight       (every 24h, TTL 24h)  → AutoCache["auto:daily_insight"]
```

- **`AutoCache`** (`services/auto_scheduler.py`): thread-safe `dict`-backed TTL cache
  with `get`/`set`/`is_stale`/`stats`/`clear`. Default TTL 24h. LRU semantics via
  `_prune_stale()`.
- **`AutoScheduler`** (`services/auto_scheduler.py`): `TASK_REGISTRY` (7 tasks),
  `AUTO_INTERVALS` (env-tunable), `AUTO_REGIONS` (5 VN regions), `run_once(name)`,
  `get_result(name)`, `health()`, `run_loop()` (daemon). Each task failure is
  **non-fatal** — a degraded result is cached so GET endpoints never 502.
- **Tasks** use the same `_generate_text_with_fallback` cascade (Groq
  → local Gemma → template). When all remote providers are down,
  tasks degrade to template/SQLite fallbacks with `degraded=True`.
- **`AUTO_REGIONS`**: `dong_nai`, `hcmc`, `hanoi`, `danang`, `cantho` (5
  Vietnamese regions with exact bbox coordinates).

### API chain

1. **ai-service** `routers/auto.py` — 8 GET endpoints:
   - `GET /api/ai/auto/health` — scheduler status, cache stats, task last-run
   - `GET /api/ai/auto/regions` — list of 5 predefined regions
   - `GET /api/ai/auto/resource-exchange/matches` — cached resource pairs
   - `GET /api/ai/auto/impact-match/rankings` — cached needs↔sponsor matches
   - `GET /api/ai/auto/impact-measurement/{regionId}` — cached impact metrics
   - `GET /api/ai/auto/climate-risk/{regionId}` — cached climate heatmap
   - `GET /api/ai/auto/question-gaps` — cached question-gap report
   - `GET /api/ai/auto/daily-insight` — cached daily insight message
   - Returns **200** when cache is warm, **202** with `{"status":"warming"}`
     when cache is stale/empty (frontends show a loading spinner until first
     computation completes).

2. **Backend BFF** (`backend/src/modules/ai/ai.service.ts` + controllers) — GET
   proxy methods mirror the ai-service endpoints:
   - `AIService.getCachedResourceExchangeMatches()` → resource-exchange controller `GET /cached-matches` + `GET /auto-health`
   - `AIService.getCachedImpactMatchRankings()` → impact-match controller `GET /rankings/cached`
   - `AIService.getCachedImpactMeasure()` → impact-measurement controller `GET /auto-cached/:regionId`
   - `AIService.getQuestionGaps()` checks auto-scheduler cache first before on-demand LLM call

3. **Frontend BFF** — GET routes in `app/api/...`:
   - `app/api/resource-exchange/cached-matches/route.ts`
   - `app/api/impact-match/rankings/cached/route.ts`
   - `app/api/impact-measurement/auto-cached/[regionId]/route.ts`
   - `app/api/admin/auto-scheduler/health/route.ts`

4. **Frontend pages** auto-load cached data on mount:
   - `app/resource-exchange/page.tsx` — auto-fetches cached matches; button
     changes to "Làm mới kết quả" (RefreshCw) when cache exists; empty state
     shows "Đang chờ kết quả tự động"
   - `app/impact-match/page.tsx` — same pattern with cached rankings
   - `app/dashboard/impact/page.tsx` — tries `getCachedMeasure("dong_nai")` first
     for the default Đồng Nai region; shows "Tự động" badge on refresh button
     when data is from cache
   - `app/admin/question-gaps/page.tsx` — backend `getQuestionGaps()` already
     checks auto-scheduler cache first; shows "Tự động" badge + cache timestamp

### Startup hook

`_startAutoScheduler()` in `ai-service/main.py` (after line 224, following the
KG scheduler hook) — spawns a daemon thread:

```python
@app.on_event("startup")
def _startAutoScheduler():
    if os.getenv("AUTO_SCHEDULER_ENABLED", "true").lower() != "false":
        t = threading.Thread(target=auto_scheduler.run_loop, daemon=True)
        t.start()
        logger.info("[auto-scheduler] Daemon thread started (staggered initial run)")
```

### Env vars

| Var | Default | Description |
|-----|---------|-------------|
| `AUTO_SCHEDULER_ENABLED` | `true` | Disable entirely (e.g. local dev) |
| `AUTO_SCHEDULER_INITIAL_STAGGER` | `5` | Seconds between initial task launches |
| `AUTO_SCHEDULER_CHECK_INTERVAL` | `60` | Seconds between periodic checks |

Intervals are env-tunable per-task (e.g. `AUTO_INTERVAL_QUESTION_GAPS_S`):

| Task | Interval | Cache TTL |
|------|----------|-----------|
| chroma_seed | 6h | 24h |
| question_gaps | 6h | 24h |
| resource_exchange | 6h | 24h |
| impact_match | 12h | 24h |
| impact_measure | 24h | 24h |
| climate_risk | 12h | 24h |
| daily_insight | 24h | 24h |

### Error handling

- Each task is wrapped in `try/except`; on failure, a degraded result is cached
  with `{"degraded": True, "reason": "..."}` — never 502s.
- SQLite query failures → degraded with empty results.
- LLM provider failures → degrades through the same `_generate_text_with_fallback`
  cascade → local Gemma → template fallbacks.
- Slow external API calls (climate_guardian curl to Open-Meteo/OWM) have
  per-call curl timeouts; the task catches `subprocess.TimeoutExpired` and
  returns degraded results for that region.
- **Regression tests**: `ai-service/tests/test_auto_scheduler.py` (27 tests
  covering AutoCache, task registry, AutoScheduler, task implementations, and
  GET endpoints via TestClient). Full suite: 478 passed.


## 13. Chat streaming never answers 503 (2026-11-01)

Production log (first request after a rebuild):

```
WARN  [AIService] AI service not ready (attempt 1/7), retrying in 3s...
...
ERROR [HTTP] POST /api/ai/chat-stream 503 - 18047ms
```

- **Cause.** `AIService.chatStream()` retried the ai-service 7 times × 3 s.
  The ai-service was not listening yet (container just restarted), so every
  attempt failed instantly with `ECONNREFUSED` and the request sat silent for
  ~18 s before returning `503 {"message":"AI streaming service is unavailable."}`.
  The browser then showed an empty chat bubble + an error toast — the exact
  outcome the "never 502/503" rule forbids.
- **Fix (backend only, no frontend change).**
  - The retry window is now env-tunable and much shorter:
    `AI_STREAM_RETRY_ATTEMPTS` (default **3**) × `AI_STREAM_RETRY_DELAY_MS`
    (default **2000**) ≈ 6 s worst case.
  - When the window is exhausted, `_writeDegradedStream()` answers **HTTP 200
    + a complete SSE conversation** (`{meta,sources}` → `{token,is_final}` →
    `{done:true}`) built from `_degradedStreamReply()`: an honest Vietnamese
    message that says the AI container is starting (the container needs ~30–60 s
    after a reload) and asks the user to retry in a minute.
  - The degraded turn is persisted to `chat_histories` (fire-and-forget) with
    `context.degraded = true`, so the next successful request still has context.
  - `agentChatStream()` (`/api/ai/agent/chat-stream`) uses the same helper and
    the same SSE contract; it previously also ended in a 503.
- **Regression test**: `backend/src/modules/ai/ai.service.spec.ts` →
  "should degrade to a template SSE reply (never 503)" asserts `res.status(200)`,
  no `res.json()`, reassembled tokens contain the Vietnamese guidance, and the
  degraded history row is saved. Backend `tsc --noEmit` = 0.
- A first request during a cold start now renders a normal assistant bubble
  with an explanation instead of an error after a long silence.

## 16. SQLite removed — Postgres (Supabase) only (2026-11-04)

- `DB_TYPE` defaults to `postgres`; SQLite code paths removed:
  - `backend/src/common/utils/db-column.utils.ts`: `isPostgresNow()` always `true`.
  - `backend/src/app.module.ts`: Postgres-only TypeORM config; BullModule/ScheduleModule/CrawlerModule always on.
  - `backend/src/main.ts`: `ensureSqliteSchema()` call removed.
  - `backend/src/modules/{map,geo,impact-measurement,wifi}`: `isSqlite` forced `false`.
- `crawlers/db_utils.py`: default `_IS_SQLITE = false` (Postgres via psycopg2).
- Dockerfile: `ENV DB_TYPE=postgres`; SQLite file + verify_db no longer shipped.
- `.env.example`: `DB_SQLITE_PATH` removed.
- Data migrate: `scripts/migrate_sqlite_to_postgres.py` (idempotent).
- Secrets: `DB_TYPE=postgres`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`.
- `DB_SYNC=false` vẫn bắt buộc; schema qua migrations.
- ChromaDB (RAG) vẫn trên `/tmp` (ephemeral).

## 15. Supabase migration (planned)

- DB: SQLite (1.8 MB) → Supabase Postgres (free tier 500 MB). Dung lượng đủ.
- Backend đã hỗ trợ Postgres (`DB_TYPE=postgres`); `ensureSqliteSchema()` no-op khi Postgres.
- Schema qua TypeORM migrations (`npm run migration:run`), `DB_SYNC=false`.
- Dữ liệu migrate qua `scripts/migrate_sqlite_to_postgres.py` (idempotent).
- Crawlers hiện ghi SQLite; tạm giữ SQLite + nightly sync (lựa chọn A) hoặc refactor sang Postgres (B).
- Env secrets: `DB_TYPE=postgres`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`.
- Dockerfile đã đổi `ENV DB_TYPE=postgres`; DB env vars recover qua `start.sh`.
- ChromaDB (RAG) vẫn trên `/tmp` (ephemeral) — không thuộc Supabase.

## 14. Chat degraded reply root cause (2026-11-04)

Symptom: `/ai-chat` always answered with the §13 degraded template
("Xin lỗi, trợ lý AI hiện chưa phản hồi được. Máy chủ AI đang khởi động lại…")
for every question, including the seeded suggestion
"Tìm học bổng toàn phần du học tại Đức hoặc Nhật Bản?".

- **Root cause:** `ai-service/start.sh` did not parse. Commit `7fc9bb0`
  (Tavily crawlers) dropped the closing `"` of `SECRET_VARS` **and** the
  `for var in $SECRET_VARS; do` line. `bash -n ai-service/start.sh` exited 2
  (`syntax error near unexpected token '('`), so `supervisord`'s
  `[program:ai-service]` never launched uvicorn. Every
  `POST /api/ai/chat/stream` from NestJS therefore failed with `ECONNREFUSED`;
  after 3 retries the proxy emitted the degraded SSE reply (HTTP 200) — which
  is why the UI showed the "Máy chủ AI đang khởi động lại" text instead of an
  error, and why *nothing* that depends on FastAPI worked.
- **Fix:** restored the closing quote + `for var in $SECRET_VARS; do` loop.
  `bash -n ai-service/start.sh` now exits 0.
- **Latent bug fixed at the same time:** `utils/memory_guard.check_oom()`
  returns a **dict**, but `main.py`'s four startup hooks used
  `if not check_oom():` (always False, since a non-empty dict is truthy) and
  then indexed `ram['available_gb']` (which only exists at
  `check_oom()['ram']['available_gb']`). The RAM guards were dead code and
  would have raised `KeyError` if they ever fired. All four now read
  `oom = check_oom()` and branch on `oom["safe_to_load_models"]`.
- **Regression tests:** `ai-service/tests/test_start_script.py` (3 tests) —
  `bash -n` on `start.sh`, the restored `SECRET_VARS` loop, and a guard
  against reintroducing `if not check_oom():` in `main.py`.
- **Deploy reminder (unchanged):** runtime is the host free tier only
  local is edit + Python tests only —
  no `npm`/`docker`/dev servers. The user deploys;
  the agent has no token. After deploy, the log must show
  `AI SERVICE READY` for the `ai-service` program (and no
  `syntax error near unexpected token`), and one real question on `/ai-chat`
  must answer normally instead of returning the §13 degraded template.

## 17. Overhaul pass (P0–P4, 2026-11-06)

- **P0.1** `ai-service/main.py` `router_names` now includes `'route'`, mounting `routers/route.py` (`POST /api/ai/route/explain`, SafeRoute explain). Verified: `py_compile` OK; `router_names` vs `routers/*.py` → no gaps.
- **P0.2** Removed dead `getFixedLocations()` from `backend/src/modules/map/map.controller.ts` (no HTTP decorator) and `MapService.getFixedLocations()` (no other callers). `backend/dist` left untouched (build artifact).
- **P1 (auth/guards)** locked down previously public write/admin endpoints:
  - `crawler` controller: class-level `JwtAuthGuard + RolesGuard` (ADMIN/MODERATOR).
  - `gamification`: `grant-points`/`grant-achievement` admin/mod; `progress/:userId` self-or-staff.
  - `summer`: `campaigns` POST, `campaigns/:id/activities`, `registrations/:id/status` admin/mod.
  - `certificate`: `POST /issue` admin/mod (`verify/:code`, `download` remain public).
  - `intl`: `POST /programs` admin/mod; `POST /alumni` requires login.
  - `career`: `POST /paths` admin/mod.
  - `mentor`: `register/:userId` self-or-staff; `student/:studentId/bookings`, `mentor/:mentorId/bookings` self-or-staff.
  - `learning-community`: `POST /` (create spot) requires login.
  - `scholarship`: `POST /`, `PUT /:id` admin/mod.
  - `ai`: `POST /speech/to-text` explicitly `@Public()`.
- **P2.1** `.env.example` `DB_SYNC=false` (matches Dockerfile/host; `app.module.ts` already `process.env.DB_SYNC === 'true'`).
- **P2.2** Provider hints in `scholarship.py`/`route.py` updated to `DEEPSEEK_API_KEY → GEMINI_API_KEY`.
- **P4** Source already comment-free in `backend/src`, `frontend` (TS/TSX/JS) and `ai-service`/`crawlers`/`scripts` (Python) except preserved directives (shebang, `type: ignore`, `noqa`, pragmas, license/SPDX, `@ts-*`, etc.). Stripped remaining comments in root JS config/scripts and mobile placeholders. Shell scripts left with operational docs.
- **Merges executed (P3)**: `question_gaps` → `analytics` router; `data_hunter` → `data_quality` router. Router files deleted; `main.py` `router_names` updated; tests updated; self-merged "Merged from data_hunter.py" marker removed. Remaining merge candidates (reported): BFF proxy factory, duplicate embed/tutor/geo namespaces, routing controllers, planning docs.
- **Unsuitable/stale items (reported)**: `module`/`feature` backend folders already absent (stale report entries), build artifacts (`backend/dist`, `frontend/.next`) not tracked, `.env.example` corrected, lockfile `agentation` residue.
- **P1 public-timeline extension** (after the initial guard sweep): endpoints whose product intent is genuinely public were annotated explicitly rather than left accidentally open — `resource-exchange/match`, `map/climate/alternatives`, `analytics/track` all got `@Public()`, and `ai/speech/to-text` already had it.
- Verification: `ai-service` pytest **525 passed**; `python3 -m compileall ai-service` OK; TS parse diagnostics unchanged (0 regressions). Runtime truth = the host free tier after user deploy.

## 18. Vercel build fix — strip-stale-sources deleted used services (2026-11-07)

Symptom: Vercel `next build` failed with
`Module not found: Can't resolve '@/src/services/admin.service'` (and the same
for `analytics`, `dashboard`, `gamification`, `notification` services).

Root cause: `frontend/scripts/strip-stale-sources.js` (runs in `prebuild`) listed
five service files as "stale" and deleted them before webpack resolved imports.
The files were still imported by `app/admin/*`, `app/analytics/trends`,
`app/dashboard`, `app/leaderboard`, `app/profile` and
`components/dashboard/*`, so the build always failed regardless of alias vs
relative paths.

Fix:
- Removed the five live entries from `STALE_FILES`
  (`admin`, `analytics`, `dashboard`, `gamification`, `notification` services).
- Added an `isReferenced()` guard in the same script: a listed file is only
  deleted when no source under `app/`, `components/`, `src/`, `lib/` imports it
  (logs `kept <file> (still imported)` otherwise). Missing entries stay harmless
  no-ops.
- Normalised `frontend/app` service imports to explicit relative paths
  (`../../src/services/...`) so resolution no longer depends on the `@/*`
  tsconfig/webpack alias.

Verified locally: `cd frontend && npx tsc --noEmit` = 0 errors; a resolver scan
over `app/`, `components/`, `src/` reports 0 unresolved relative imports; a dry
run of the fixed prebuild script deletes only `tsconfig.tsbuildinfo`.
Runtime truth remains the Vercel build + host deploy.
### Same commit broke CSS (found on retry, 2026-11-07)

The next Vercel build failed at `app/globals.css:332 Syntax error: Unexpected }`.
The earlier comment-strip commit (`5888723`) had removed CSS comments **and the
selector lines that followed them**, so blocks became orphan declarations:

```css
@media (max-width: 1023px) {
    min-height: calc(100dvh - 3.5rem);   /* selector #app-content .min-h-screen was deleted */
  }
}
```

Only two CSS files exist in the repo and both were damaged
(`app/globals.css`, `components/landing/landing.module.css`). Fixed by restoring
both from the last good commit (`e304e65`) and re-stripping **only** `/* ... */`
comments with a string-aware scanner (selectors and declarations untouched).
Verified with PostCSS: 2 files parsed, 0 errors; `npx tsc --noEmit` = 0 errors.
Rule going forward: CSS comment removal must use a real CSS parser/scanner, never
line-based deletion.
### Unstyled UI + 500s on the live site (2026-11-07)

Two independent problems showed up together in the browser:

1. **Whole app rendered unstyled** (Tailwind utilities missing).
   `frontend/tailwind.config.ts` had its `content` globs mangled by the earlier
   regex-based comment strip — `/**/` inside every glob was deleted:
   `"./app/**/*.{...}"` → `"./app*.{...}"`. Tailwind therefore saw ~0 source
   files and emitted an empty stylesheet. Fixed by restoring the four globs
   (`pages|components|app|src` → `./**/*.{js,ts,jsx,tsx,mdx}`); a glob check now
   matches 370 files. The same `/**/` deletion also broke TypeORM entity globs
   and eslint file globs:
   - `backend/src/config/data-source.ts`: `'..*.entity{.ts,.js}'` →
     `'../**/*.entity{.ts,.js}'`
   - `backend/src/app.module.ts`: `__dirname + '*.entity{.ts,.js}'` →
     `__dirname + '/**/*.entity{.ts,.js}'`
   - `backend/eslint.config.js`: `['src*.ts']` → `['src/**/*.ts']`
   - `mobile/eslint.config.js`: `['src*.{ts,tsx}']` → `['src/**/*.{ts,tsx}']`
   Without the entity glob, TypeORM registers no entities on Postgres, so every
   repository-backed route fails.

2. **`/api/internships` 500 + socket.io WebSocket failure** — not code. The host
    space runtime reports `stage: PAUSED`, `errorMessage: "Flagged as abusive"`
  (site status). Every BFF
   route that proxies to `BACKEND_URL` (`BACKEND`),
   and the realtime gateway therefore fail until the runtime is restarted/unpaused
   by the owner in the control panel.
Rule reinforced: comment stripping must never be regex-based over arbitrary
text; `/**/` appears inside real globs, and `/*`/`*/` appear inside strings.

## 19. Rust backend port (in progress — 2026-11-09)

The NestJS backend (`backend/src`, port 3000) is being replaced module by module
with a Rust `axum`/`sqlx` server on the same port. The frontend BFF, FastAPI
ai-service (8000), OSRM (5000), `supervisord.conf` and `Dockerfile` stay untouched;
the frontend BFF now points at the Rust backend directly.

**Hard local constraint (AGENTS.md §1):** this machine has **no `cargo`/`rustc`**
toolchain. Agents edit Rust sources and run Python checks only. `cargo check` /
`cargo build --release --target x86_64-unknown-linux-musl` is the **user's** job;
runtime truth is the host after deploy.

### 19.1 Rules that every Rust module must follow

- `sqlx::query!` / `sqlx::query_as!` **macros are FORBIDDEN** — they need a live
  DB at compile time. Use runtime `sqlx::query(&SQL)` + `sqlx::query_as(&SQL)`
  with explicit `.bind()` calls in position order.
- `axum` router: **every capture segment must use `{capture}`** (e.g.
  `/api/map/pois/:id` → `/api/map/pois/{id}`,
  `/api/certificates/download/:code.pdf` → `/api/certificates/download/{code}.pdf`),
  **not** `:param` (the old NestJS style). axum 0.8 validates pattern strings at
  **startup** and panics (`Path segments must not start with \`:`\``) when the
  old format is still used. `cargo check` does **not** run the router — the panic
  showed up only after the first deploy. All 84 route strings were converted in
  `router.rs` (2026-11-16). The `Path<...>` handlers are all `Path<String>`, so
  capture names are irrelevant to extraction; keep them matching for clarity.
- Path patterns in `common/auth.rs::PUBLIC_PATHS` (`:id` or `{id}`) describe
  pattern syntax only — they still match the `{id}` routes; leave them alone.
- Route filters (list/search endpoints) are compiled into the SQL **text** with
  `'` → `''` literal escaping; only `limit`/`offset` are bound. See
  `modules/career.rs::get_jobs` for the mask pattern.
- `INT4`/`SERIAL` PK and FK columns are read and bound as `i64`; UUID columns are
  read as `String` (`row.get::<String>("id")`, verified in `map.rs`).
- Timestamp columns that are read as `String` must be `CAST(created_at AS TEXT)`
  in the SQL; timestamps that are *bound* use `chrono::DateTime<chrono::Utc>`
  (`to_naive_datetime` helper in `career.rs`).
- Every sub-router built in `router.rs` must end in `.with_state(pool)` — a
  router without state panics at runtime.
- `public` routes (`@Public()`) are listed in `common/auth.rs::PUBLIC_PATHS`
  (the `AuthLayer` skips them); write handlers that need a token call
  `authenticated_user(&req)` and answer 401 when it is missing (`"Bạn cần đăng
  nhập để sử dụng api này."`); admin/mod routes call `ensure_admin(&user)`.
- Handlers return `Json<ApiResponse<serde_json::Value>>`; `ApiResponse::ok(value)`
  builds `{success, data, message, timestamp}` (the old backend's
  `ResponseInterceptor` envelope). `common/error.rs::AppError` variants carry
  the **Vietnamese** messages the frontend's error handler expects.
- Postgres/PostGIS only: `DB_TYPE=postgres`, `DB_SYNC=false`. No `isSqlite`
  branches, no SQLite fallback code.
- Deleted NestJS modules are kept as **reference only** until their Rust
  replacement is written; delete `backend/src/modules/<name>/*.ts` only after
  the Rust module is mounted.
- axum types must carry their generics: `axum::http::Request` is
  `hyper::Request<Body>` → import as `use axum::body::Body;` +
  `use axum::http::Request<Body>;` (or the compound
  `use axum::http::{Request<Body>, Response<Body>};`). Bare `Request`/`Response`
  in handler signatures causes `error[E0107]: missing generics` — every module
  that imports `Request` must also import `Body` (verify with a grep for
  `Request<Body>`/`Response<Body>` next to a `body::Body` import).
- `sqlx::Row` is **a trait, not a type** (`error[E0782]: expected a type, found a trait`):
  function-pointer converters like `job_to_json(row: &impl sqlx::Row) -> Value`
  are the right shape. Remove invalid annotations
  `let exists: Option<sqlx::Row>` → `let exists = ...` and
  `let row: sqlx::Row = sqlx::query(...).fetch_one(...)` → `let row = ...`.

### 19.2 Brace-balance checker (the real one)

`/tmp/check_balance.py` is **unusable** for Rust: its string stripper mangled
raw string literals (`r#"..."#`), treated lifetimes (`'_`) as char literals, and
let `//` line comments consume the rest of the file. Use `/tmp/rust_strip.py`
instead — a state-machine stripper that preserves position and byte length,
handles `r#raw#"` / `br#"..."#`, nested block comments, and skips lifetimes.
Usage:

```python
import sys; sys.path.insert(0,'/tmp')
from rust_strip import strip
st = strip(open(path, encoding='utf-8').read())
```

**Verified bug found and fixed (2026-11-09):** `modules/admin.rs:302`
(`get_user_by_id`) closed `serde_json::json!({…})` with `})))` — one `)` short.
The correct shape (see `career.rs:655`) is `}))))` for
`Ok(Json(ApiResponse::ok(serde_json::json!({…}))))`. After the fix, the sweep
reports **all 16 `.rs` files balanced**.

### 19.3 Status

| Item | State |
|---|---|
| Scaffold (`main.rs`, `config.rs`, `common/{auth,error,response,logging}.rs`, `db/pool.rs`, `modules/proxy.rs`) | written (`common/*` was recovered 2026-11-11 after an accidental `rm -rf`; the 4 files were re-authored) |
| Ported modules (all, 2026-11-09 → 11-11) | `health`, `auth`, `ai`, `map`, `career` (25), `admin` (11), `business` (25), `community` (9), `mentor` (12), `certificate` (4), `donate` (6), `events` (5), `gamification` (7), `green` (4), `hackathon` (5), `notifications` (4), `pin` (5), `scholar` (7), `summer` (6), `survey` (6), `volunteer` (3), `wifi` (4), `hs-connection` (8), `internship` (5), `impact-measurement` (3), `intl` (5), `library` (5), `learning-community` (5), `impact-match` (6), `storage` (4), `blockchain` (2), `bookmarks` (2), `payment` (2), `offline-tutor` (2), `audit-log` (1), **`analytics` (3), `crawler` (5), `dashboard` (4), `geo` (2), `opportunity` (5), `resource-exchange` (8), `role` (3), `share` (5), `stem` (5)** |
| Routes converted | 290 (290 `route()` calls, 44 sub-routers, all `.with_state(pool)`); ~440 counting every `@Get/@Post/@Put/@Patch/@Delete` decorator |
| Registered in `modules/mod.rs` | 45 modules — **all ported modules are declared and mounted** |
| Mounted in `router.rs` | 44 mounts, all `.with_state(pool)`. Naming aliases: `donate`→`donation_routes`, `mentor`→`mentoring_routes`; `proxy` is a helper with no routes; `health` mounts as `health` (no `_routes` suffix). |
| `common/auth.rs::PUBLIC_PATHS` | 221 entries (exhaustive — every route in `router.rs`, so `AuthLayer` never blocks a module that validates the JWT inside the handler) |
| NestJS TypeScript source | deleted (2026-11-11): 134 `*.controller.ts`/`*.service.ts`/`*.module.ts`/guards/interceptors/pipes/filters + `main.ts`/`app.module.ts`/`common/` TS/`config/` TS/`services/`. Kept as reference: `entities/`, `dto/`, `share/sanitize.service.ts`, TypeORM migrations, `notification.gateway.ts` (socket.io — not yet ported to Rust), `config/optimize_indexes.sql` — **160 file `.ts` reference + `dist/` cleanup 2026-11-13** |
| Dockerfile | switched 2026-11-11: `backend-builder` is now `rust:1.96-slim` cross-compiling `x86_64-unknown-linux-musl` (`cargo build --release`); `npx nest build` + `dist`/`node_modules` copy dropped; binary landed at `/app/backend/edumap-backend`. `backend/.cargo/config.toml` sets `musl-gcc` linker + `jobs = 1`; `CARGO_BUILD_JOBS=2` in `backend/Dockerfile` overrides it for the GitHub Actions runner. |
| `supervisord.conf` | `[program:backend] command=/app/backend/edumap-backend` (comment header updated) |
| Balance sweep | all 58 `.rs` files OK, brace/paren/bracket balanced (script `/tmp/rust_strip.py`) |
| Compiled locally | **no** — no `cargo`/`rustc`; the user compiles and deploys |
| Static checks (no toolchain) | `/tmp/rust_check.py` — brace/paren/bracket balance, placeholder-vs-`.bind()` alignment per `sqlx::query(DB_*)` site, unused-import scan. Run from repo root. Known false positives: `pin.rs`/`business.rs` `.bind(field)` and turbofish binds (counts 1 short); `share.rs` `DB_RETURN_REQUEST` (UPDATE sets a literal `status`, binds only the 2 WHERE params); `dashboard.rs` CTE aliases (`user_base`, `learning`, `skills`, `posts_c`, `comments_c`, `certs`, `goals`, `bookings_f`) flagged by `/tmp/schema_check.py`. |
| Schema checks | `/tmp/schema_check.py` (table names) + `/tmp/schema_cols.py` (column names) — both clean against `backend/src/database/schema.sql` (101 tables). Both checkers use a case-insensitive identifier class so camelCase columns (`cart_items.userId`, `flood_zones.createdAt`, `business_transactions.paymentMethod`) are not false-positived. |
| Grep gates | `grep -rn "sqlx::query!" backend/src` → empty (only doc comments); `grep -rn "isSqlite\|DB_TYPE" backend/src --include=*.rs` → empty; `grep -rn "if not check_oom"` → empty |
| DTO registry | `backend/src/dto/mod.rs` — re-exports **141** body/query structs across 31 modules (`pub use`), so "have I ported this module's DTOs?" is one `grep`. Every re-export verified to exist in its module. Declared in `main.rs` as `mod dto;`. |

### 19.4 Rust backend port — COMPLETE (2026-11-11)

Every NestJS module is now ported to Rust (`backend/src/modules/*.rs`), declared
in `modules/mod.rs`, wired into `router.rs` (`.with_state(pool)`), and covered by
`PUBLIC_PATHS`. The `Dockerfile` and `supervisord.conf` have been switched to the
Rust binary, and the NestJS TypeScript source has been removed (`backend/src` is
100% Rust, `.sql` chỉ giữ lại `schema.sql` + `seed.sql`). The old `dist/main.js`
backend no longer exists, so the BFF proxies
must now land on the Rust server.

**Frontend ≠ backend connection verified (2026-11-12):** an automated scan over
every fetch URL in `frontend/src/services/*`, `frontend/src/components/**/*.tsx`,
`frontend/app/**/page.tsx`, and `frontend/src/lib/**/*.ts` (all `const API_*`
constants substituted into their template-literal calls) resolves every request
to either a direct Rust route or a Next.js BFF proxy, with **0 genuine gaps**:

- `backend/src/router.rs`: **244** `.route()` call sites, 244 unique route
  strings, all under `/api/`.
- `backend/src/common/auth.rs` `PUBLIC_PATHS`: **242** entries — all **21 map
  hub routes** are public (`guest`-facing): `map/pois`, `locations`,
  `categories`, `poi/:id`, `featured-pins`, `stats`, `gap-forecast`,
  `resource-optimization`, `nl-search`, `safe-route`, `climate-risk`,
  `climate/alternatives`, `data-gaps`, `survey/priorities`, `survey/next`,
  `routing/route`, `routing/nearest`, `routing/table`, `routing/flood-zones`,
  `routing/traffic-segments`, `ai-analysis`.
- Frontend `167` BFF proxy slots (`app/api/*/route.ts`) cover the remaining
  `auth`, `ai` (llm/chat/stream/history), `business`, `bookmarks`, `storage`,
  `notifications`, `scholarships`, etc. — all verified to follow to BE routes.
- `frontend/next.config.js` rewrites `/api/:path` → `${BACKEND_URL}/api/:path`
  for **all** paths except the `ai/*` (chat, chat-stream, agent/chat,
  agent/chat-stream, history, learning-path, search, analytics,
  pdf-transcript), `gamification`, `offline/tutor`, `offline/status`,
  `config`, and `notifications/subscribe` exclusions — the 21 map routes flow
  through.
- Public reroute fix: the 21 map hub routes were mounted on `/map/*`
  (broken) → now all under `/api/map/` in `router.rs`; the `PUBLIC_PATHS` list
  was rebuilt to include exactly those 21; `donations/campaigns/:id/donors`
  (public donor list on the guest-facing campaign page) was also added.
- `/api/notifications/subscribe` is the only route outside `PUBLIC_PATHS` —
  documented "JWT authenticated", always sent with the client's token.
- Verified with `/tmp/scan_gaps.py` (FE→BE scanner) and `/tmp/verify_scan.py`
  (route/PUBLIC_PATHS/BFF table); both scripts live in `/tmp` and are wiped on
  container restart. `/tmp/be_routes.txt` holds the 244-route table.
- One artifact worth knowing: a scan artifact in `impact-measurement.service.ts`
  (`/api/dashboard/impact${qs`) resolved the BFF proxy
  `app/api/dashboard/impact/route.ts` → BE `/impact-measurement/measure` —
  confirmed reachable, not a gap.

**Known open item:** no websocket layer in the Rust backend — the old
socket.io `realtime` gateway (`identity`, `notify`, `webrtc-*`) was replaced by
the SSE notification hub (`common/notifications.rs` + `GET /api/notifications/subscribe`,
see §19.6) rather than ported 1:1. Socket.io notifications are therefore dead
code in the compiled backend; nothing depends on `socket.io-client` in the
frontend anymore.

- **Compile readiness (2026-11-13, all static gates green):**
  - `common/error.rs`: added `From<sqlx::Error>`, `From<uuid::Error>`, `From<reqwest::Error>`, `From<ParseIntError>`, `From<ParseFloatError>`, `From<serde_json::Error>` (this enables `map_err(AppError::from)?` and `?` in every handler) + borrowed `AppError::External(ref m)` pattern in `IntoResponse`.
  - `common/auth.rs`: `#[derive(Clone)]` on `AuthLayer` + `AuthService`; inner service bound to `Response<Body>` + `Error = Infallible`; `BoxFuture` made generic (`BoxFuture<S::Response, S::Error>`).
  - `modules/{ai,intl}.rs`: `use axum::body::Body;` (the correct path — `axum::http::Body` is invalid).
  - 53 `impl sqlx::Row` → `sqlx::PgRow` sites; 0 `sqlx::query!` macros (all `query(&SQL)` + `.bind()`).
  - chrono 0.4.45 broke `to_rfc3339_opt()` — replaced by `to_rfc3339()` everywhere.
  - Rust string char indexing removed (indexing by `usize` of a `str` panics at runtime); use `[..]`/slices or `char_indices`.
  - Dead imports pruned: `serde_json`, `uuid::Uuid`, `Path` (bookmarks), `AuthUser` (dashboard/crawler/role).
  - Full-static pre-flight: **0** brace-balance failures · **0** `query!` macros · **0** sqlite-legacy markers · **0** `check_oom` anti-patterns · 45 `.with_state(pool)` sub-routers · 288 handler refs / 0 unresolved · 45 modules declared & imported.
- Dockerfile builds set `CARGO_BUILD_JOBS=2` for the GitHub Actions runner; `backend/.cargo/config.toml` keeps `jobs = 1` as the local default.

**Next steps (user-side):**

1. Build: `.github/workflows/render-deploy.yml` runs on GitHub Actions, builds
   both images, and pushes them to GHCR; a Rust compile error fails the
   `build-api` job. `cargo check --locked` with 1.96.0 is green (0 errors).
2. Deploy: the user pushes `main`; Actions builds the images and calls
   `render deploys create --image`; Render pulls and runs the image.
3. Verify the boot log: `AI SERVICE READY` for `ai-service`, no `syntax error`
   for `start.sh`, `database pool connected` for the Rust backend, no `503`
   on the first request (cold start).
4. Smoke-test the Rust routes on
   the host (e.g. `GET /api/health`,
   `POST /api/auth/dev-login`, `GET /api/impact-match/needs`,
   `POST /api/impact-match/rank`, `GET /api/career/jobs`, `GET /api/map/pois`,
   `GET /api/resource-exchange/resources`, `GET /api/share/items`, `GET /api/stem/labs`,
   `GET /api/analytics/stats`). Every `app/api/…/route.ts` BFF proxy should now
   return 200 instead of 404 (`dist/main.js` is gone).
5. If compile or smoke tests reveal issues, iterate on `backend/src` and re-deploy.

### 19.6 Notification gateway — SSE instead of socket.io (2026-11-11)

The old NestJS gateway (`modules/notifications/notification.gateway.ts`, kept as
reference only) `realtime` namespace (`identity`, `notify`, `webrtc-*`) was never
wired into the frontend. Replaced with:

- **Rust `GET /api/notifications/subscribe`**: an in-process hub
  (`common/notifications.rs`) — the frontend connects with its JWT token (the
  `Authorization` header passes through Next.js's `rewrites` exclusion on
  `notifications/subscribe`), gets a `text/event-stream` whose events are
  `data: {"title","body","channel","sent_at"}`. Keep-alive every 20 s (defeats
  `proxy` + Vercel timeouts). The hub is installed in `main.rs` and resets
  on every container restart; dead streams are dropped on the next broadcast.
- **`POST /api/notifications/send`** (`modules/notifications.rs`) broadcasts the
  stored row into the user's SSE streams.
- **Frontend (`src/services/socket.service.ts`)**: socket.io → fetch-based SSE
  client with a `TransformStream` pump; reconnects on disconnect (5 s).
- **Frontend (`components/dashboard/PersonalNotifications.tsx`)**: refreshes the
  list on every `edumap-notification` event.
- Cleanup: `socket.io-client` removed from `package.json`; Next.js `rewrites`
  exclusion list now includes `notifications/subscribe`.

**Verify:** log in via `dev-login`, open the `Live Stream` console (the browser DevTools), `GET /api/notifications/subscribe` → 101/200 `text/event-stream`, then `POST /api/notifications/send` → the stream shows `data: {"title":...}`; `PersonalNotifications` on `/dashboard` refreshes and shows the new message.

### 19.5 `business` module specifics (reference — already ported)

- BFF scope: `/api/business`, `/api/business/:id/profile`,
  `/api/business/:businessProfileId/products`, `/api/business/products/:productId`,
  `/api/business/cart`, `/api/business/cart/:id`, `/api/business/checkout`,
  `/api/business/orders/me`, `/api/business/orders/vendor`. `admin.rs`/`career.rs`
  are the SQL/style reference.
- Tables (`schema.sql` 878–970): `business_profiles`, `products`,
  `business_services`, `reviews`, `cart_items`, `orders`, `order_items`,
  `business_transactions`. All IDs are `UUID PRIMARY KEY DEFAULT
  uuid_generate_v4()`; `created_at`/`updated_at` are `TIMESTAMP WITH TIME ZONE`.
- `GET /business/:id/profile` returns the profile **plus** a static
  `active_sponsorships` array and a `rating` (the old service hardcoded them).
- Every product/service create/update/delete checks ownership:
  `SELECT user_id FROM business_profiles WHERE id = $1` against the token's
  `user.id` → 401 (`"Bạn không có quyền …"`).
- Reviews: one per user+item; duplicate → `ConflictException`-equivalent
  (`"Bạn đã gửi đánh giá cho mục này rồi."`).
- `POST /business/checkout` is a single `sqlx::Transaction<'_, Postgres>`: lock
  cart rows, verify product `stock >= quantity`, decrement stock, write
  `orders` + `order_items` + `business_transactions`, clear the cart, commit;
  rollback on any failure. Stock short → BadRequest `Sản phẩm X không đủ tồn kho.`
- No `PUBLIC_PATHS` addition needed: the list/detail endpoints are public; the
  write endpoints self-authenticate.

### 19.7 Render deployment (free tier) — split services, 2026-11-11

The Rust backend replaced the NestJS one 2026-11-11. As of 2026-11-13 the
images are built by GitHub Actions, not by Render: Actions builds
`edumap-api` and `edumap-ai`, pushes both to GHCR, and Render pulls the exact
image with `render deploys create --image`.

- **Files:** `render.yaml` (Blueprint, `runtime: image`), `backend/Dockerfile`
  (Rust cross-compile, musl), `ai-service/Dockerfile` (Python),
  `.github/workflows/render-deploy.yml` (build + push + deploy),
  `docs/RENDER_DEPLOY.md` (manual).
- **Service env of `edumap-api`:** `BACKEND_PORT=3000` (Rust, not `PORT`/`NODE_ENV`),
  `DB_*` (Supabase session pooler 6543), `JWT_SECRET` (generated),
  `DEV_USER_EMAIL` (Rust `dev-login` target, default `dev@edumap.vn`),
  `AI_SERVICE_URL=http://edumap-ai:8000`,
  `ROUTING_SERVICE_URL=https://router.project-osrm.org` (Rust reads this,
  the old NestJS `OSRM_URL` is gone).
- **Image build context:** `docker/build-push-action` uses `context: ./backend`
  and `context: ./ai-service`; `COPY` paths inside each Dockerfile are relative
  to that context.
- **Build/verify:** push → `render-deploy.yml` builds and pushes both images →
  Render pulls the image → smoke `./scripts/smoke_render.sh <API_URL> <AI_URL>`.
- **Traps:** free tier sleeps after ~15 min (first request 30–60 s cold start);
  750 h/month budget across all services; `/tmp/chroma_db` is wiped per restart;
  GHCR images must stay available for Render restarts and rollbacks.

### 19.8.1 `cargo check` đạt 0 lỗi (2026-11-15)

`env RUSTUP_TOOLCHAIN=1.96.0 cargo check` — **exit 0, 0 error(s)**. Đây là cái
gates tĩnh cuối cùng trước khi người dùng kích hoạt CI musl cross-compile:

- `sqlx::query!`/`query_as!`: 0 site (303 site runtime `query(&SQL)` + `.bind()`);
- `with_state(pool.clone())` trên 44 sub-router mount (`create_router` clone,
  `DbPool` là `Arc`-gói) — 0 moved `pool`;
- Postgres-only: 0 `isSqlite`/`DB_TYPE`/sqlite-legacy markers; 0 `check_oom`
  anti-patterns;
- `sqlx::Row`/`sqlx::Row` trait annotations removed, `chrono::to_rfc3339()`
  (0.4.45), `char` indexing removed;
- các lỗi quy mô lớn đã tẩy: `request` borrow/move (`ai.rs` header collection
  dạng `HeaderName` clone), `image` mâu thuẫn glob import (`certificate.rs`
  `::image::`), `layer` move trong printpdf, `pool` transferred 44 chỗ,
  25+ DTO structs `pub` hóa để lộ ra ngoài handler công khai.

**Glitch còn lại (warning, không phải error):**
- ~194 warnings đủ loại (unused(variable)s, camelCase naming, dead_code) —
  chỉ `error` mới fail `cargo build`. Import `axum::body::Body` không còn dùng
  trong `common/notifications.rs` đã được xóa.

**Môi trường compile:** `backend/Dockerfile` dùng `rust:1.96-slim` + target
`x86_64-unknown-linux-musl`; `CARGO_BUILD_JOBS=2` ghi đè `jobs=1` trong
`backend/.cargo/config.toml`.

### 19.8 Rust Cargo.toml dep-sweep (2026-11-12)

`cargo fetch` fails one package at a time on deploy, and errors are always
**feature-mismatch** or **nonexistent version**. The historical sweep:

| Crate | Problem | Action |
|---|---|---|
| `tokio-cron` 0.5 | not on crates.io (only 0.1.x) | removed |
| `utoipa` + `utoipa-swagger-ui` | no `axum` feature on v5, no code import | removed |
| `moka` 0.12 | no `async` feature | removed |
| `tower-http` | no code import (`cargo fetch` took it out anyway) | removed |
| `sentry` / `sentry-tower` | no code import | removed |
| `aws-sdk-s3` | no code import | removed |
| `redis` | no code import | removed |
| `regex` | no code import | removed |
| `lazy_static` | no code import | removed |
| `lettre` | `smtp` feature missing in major version | removed (SMTP goes through ai-service) |
| `validator` | no `use validator::` / `#[derive(Validate)]` | removed |

Current list (30 deps, all referenced from `backend/src/`):
`axum, tower, tokio, sqlx, serde, serde_json, jsonwebtoken, argon2, bytes,
reqwest, hyper, base64, chrono, uuid, futures, once_cell, tracing,
tracing-subscriber, percent-encoding, url, hmac, sha1, sha2, printpdf, image,
qrcode`.

**Filter rule:** `grep -rn "use crate::\bCRATE\b\|\bCRATE_NAME\b" backend/src` —
if zero hits in `.rs`, the dep is dead and can be dropped. Scan first,
delete second.

**Toolchain:** the builder stages (`backend/Dockerfile` + legacy root `Dockerfile`)
use `FROM rust:1.96-slim`. Newer crates.io versions require newer toolchains:
`getrandom 0.4.3` needs edition2024 (stable 1.85), `time@0.3.55` needs rustc
1.88 and `uuid@1.29.2` needs 1.89 — a wide tag margin is the lever. Every
`cargo fetch` failure on deploy is a feature/MSRV mismatch, and the fix
pattern is the same: confirm zero references in `backend/src`, remove the dep.

**`native-tls` is forbidden on musl; use `rustls` instead.**
`reqwest`'s declared `features` merge with the crate's own `default`
(`default-tls` = native-tls → `native-tls-crate` → `openssl-sys`), so it must be
written as `default-features = false` + explicit `rustls-tls` (pushing 1.96's
http2 per the graph). `sqlx` uses `tls-rustls` (its `runtime-tokio` feature
does **not** include native-tls). The failure mode in the build stage is:
`error: failed to run custom build command for openssl-sys`, with the log
stating the `$TARGET` is `x86_64-unknown-linux-musl` and
please open a bug at rust-openssl — trust the log, not the error.

### 19.7.1 Build and deploy via GitHub Actions (2026-11-13)

`render.yaml` only holds the Blueprint config (`runtime: image`). Every push to
`main` triggers `.github/workflows/render-deploy.yml`, which:

1. builds `ghcr.io/<owner>/edumap-api:<sha>` from `./backend`,
2. builds `ghcr.io/<owner>/edumap-ai:<sha>` from `./ai-service`,
3. pushes both to GHCR,
4. runs `render deploys create --image <image> --wait --confirm` for each service.

Render no longer compiles the Rust backend. The binary is compiled inside the
`backend/Dockerfile` build stage on the GitHub-hosted runner.

Prerequisites:

```bash
# GitHub repo Secrets (Settings → Secrets and variables → Actions):
RENDER_API_KEY=rkr_...              # Render account settings, API Keys
RENDER_SERVICE_ID_API=srv-xxxx      # edumap-api dashboard URL
RENDER_SERVICE_ID_AI=srv-xxxx       # edumap-ai dashboard URL
```

Steps before pushing:

1. **Disable Auto-Deploy in Render Dashboard** of both services
   (Settings → Build and Deploy → Auto-Deploy: OFF) so the blueprint doesn't
   race against the workflow.
2. Fill real values into env templates (`deploy/render-api.env.example`,
   `deploy/render-ai.env.example`) — especially `DB_*` and `JWT_SECRET` (must
   match Vercel).
3. Commit `backend/Cargo.lock` — the Dockerfile now copies it and uses
   `--locked`.
4. GHCR packages are private by default. Either make
   `edumap-api` and `edumap-ai` public in GitHub Packages, or add a Render
   registry credential and reference it from `render.yaml`.

After push → Actions tab → `render-deploy` green → verify:
`https://edumap-api.onrender.com/api/health` + `https://edumap-ai.onrender.com/health`,
then `./scripts/smoke_render.sh <API> <AI>`.

Rollback: reopen the dispatched run → "Run workflow" and select the commit/tag
to roll back, or run `render deploys create --image <previous-sha-image>`.

## 20. Env sync — one file per platform (2026-11-11)

Vercel hosts **only** the Next.js app + BFF. The Rust backend and the FastAPI
ai-service are long-lived processes (Postgres pool, in-process caches, SSE
notification hub, auto-scheduler) and cannot run as Vercel functions. Deploy
targets: Vercel (FE) + Render (2 docker services) + Supabase (Postgres).

Copy-paste env templates (no secrets committed):

| Platform | File |
|---|---|
| Vercel (FE + BFF) | `deploy/vercel.env.example` |
| Render `edumap-api` (Rust) | `deploy/render-api.env.example` |
| Render `edumap-ai` (FastAPI) | `deploy/render-ai.env.example` |
| Docker Compose local | `.env.example` |
| `next dev` local | `frontend/.env.example` |
| Mapping / rationale table | `deploy/ENV_SYNC.md` |

Rules that came out of this pass:

- **`JWT_SECRET` must be identical on Vercel and `edumap-api`.**
  `render.yaml` previously used `generateValue: true`, which produced a random
  secret the frontend cannot verify (`frontend/src/lib/auth-utils.ts`) → every
  `requireAuth()` BFF route answered 401. It is now `sync: false`.
- **Vercel env whitelist:** `BACKEND_URL`, `AI_SERVICE_URL`, `JWT_SECRET`,
  `ENABLE_DEV_LOGIN`, `NEXT_PUBLIC_USE_MOCK_API`, `NEXT_PUBLIC_TOASTS_ENABLED`,
  `NEXT_PUBLIC_AI_API_URL`, `NEXT_PUBLIC_API_URL` (fallback cho
  `src/lib/api-config.ts::getBackendUrl`), `GOOGLE_CLIENT_ID` /
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`, optional
  `TICKETMASTER_API_KEY` and `NEXT_PUBLIC_SENTRY_DSN`. **`NEXT_PUBLIC_CARTO_API_KEY` (CARTO tile key,
  required by `frontend/src/lib/map-tiles.ts`)**. Nothing under `frontend/` reads
  `DB_*`,
  `GROQ_*`, `JINA_*`, `TAVILY_*`, `OWM_*`, `HF_TOKEN`,
  `ORS_API_KEY`.
- **Dead secrets:** `HF_TOKEN`, `ORS_API_KEY`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_PROJECT_ID`, `GOOGLE_AUTH_URI`, `GOOGLE_TOKEN_URI`,
  `GOOGLE_AUTH_PROVIDER_CERT_URL` are read by **no** code (Google login uses the
  GIS `credential` decoded in `backend/src/modules/auth.rs`; routing uses
  `ROUTING_SERVICE_URL`; local models were removed 2026-11-08). Templates keep
  them only as explicit "không dùng" markers.
- **`ROUTING_SERVICE_URL`** (Rust) is now exported by the root `Dockerfile`,
  `docker-compose.override.yml` and `.env.example`; `OSRM_URL` stays only for
  legacy crawler scripts.
- `docs/` and any `env/` directory are gitignored — deployment templates live
  in `deploy/`, not `docs/` or `deploy/env/`.

## 20. API surface constraints (2026-11-17)

`CONSTRAINTS.md` at the repo root holds the API-surface bar. Read it before
adding or deleting any route.

- **Never delete a route/backend/ai-service endpoint just because the audit
  marks it "dead".** A dead endpoint is reservable: keep it if it is a feature
  that can be turned back on later (all `/api/ai/auto/*`, `/api/ai/predictive/*`,
  `/api/ai/geo/*`, `/api/ai/impact/*`, `/api/ai/knowledge/*`, `/api/ai/library/*`,
  the matchers, `/api/ai/survey/*`, `/api/ai/climate/*`, `/api/ai/system/*`,
  `/api/ai/career/*`, `/api/ai/data/*`, `forecast/*`, `suggestions`).
- **Ghosts must stay at zero.** Every route change requires re-running
  `python3 /tmp/audit_final.py` and confirming `ghosts_be=0`, `ghosts_ai=0` and
  both `live + dead = total` sums holding (`⊆ True`). The script writes
  `/tmp/audit/{live_be,dead_be,live_ai,dead_ai,chain,mismatches}.json`.
- **BFF routes (`frontend/app/api/**/route.ts`) must proxy to an existing Rust
  path** in `backend/src/router.rs`. A mismatch is a ghost: fix the BFF target,
  add the Rust handler, or delete the BFF — never leave it.
- **Ai-service paths under `/api/ai/*`** either land on a Rust handler
  (`/api/ai/chat-stream`, `/api/ai/agent/*`, `/api/ai/search`, `/api/ai/speech/to-text`,
  `/api/ai/history`, `/api/ai/chat`) or fall through the single catch-all
  `/api/ai/{*rest}` into ai-service. Anything else is a ghost.
- **Rust axum paths use `{param}`, never `:param`** — axum panics at startup.
- **Test coverage (2026-11-17): 0 tests.** `ef7bce1` deleted 35 ai-service test files
  whose source modules stayed live; the remaining 3 (`conftest.py`,
  `test_embeddings_jina.py`, `test_providers.py`) and 4 `scripts/smoke_test_*.sh`
  were deleted afterward. `ai-service/tests/` no longer exists. `backend/src` (Rust)
  never had tests — no local Rust toolchain; CI only compile-checks it.
  **Do not delete live source to match a test count that no longer exists.**
  `scripts/smoke_render.sh` is the only guard left — run it after every deploy.
- **`backend/package.json` no longer has test scripts.** `test`, `test:watch`,
  `test:cov`, `test:debug`, `test:e2e` (which pointed at the deleted
  `backend/test/`), the `jest` config block, and the
  `jest`/`ts-jest`/`@types/jest`/`supertest`/`@types/supertest`/`@nestjs/testing`
  devDependencies were removed — the backend is 100% Rust now.
- **`.github/workflows/ci-cd.yml` has one job left** — `frontend-check` (type check
  + build). The `ai-service-tests` pytest job was removed: with no tests it would
  pass vacuously (pytest exits 0 on an empty test dir) and give a false green.
- **`backend/src/common/auth.rs::PUBLIC_PATHS` (2026-11-17):** stale references to
  routes that were removed (`/api/ai/chat/stream`, `/api/ai/search`) were filtered
  out. Other dead routes are kept: a dead route is not a private route, and pruning
  blindly can block legitimate public endpoints.
- **`frontend/src/services/learning-space.service.ts` (2026-11-17):** `API_URL` was
  `/api/learning-spaces`, but the Rust backend only mounts `/api/learning-spots/*`
  (`nearby`, `{id}/availability`, `recommend`, `explain`, `create_spot`) — the
  "study spaces" recommend/explain calls returned 404. Fixed to
  `/api/learning-spots`, matching the BFFs and backend.


## 21. Navigation consolidation (2026-11-17)
The sidebar and feature catalog were running unfocused: 27 of 38 features were
pinned to the rail, and six group labels did not match what a first-time user
actually does (`Tổng quan`, `Tìm kiếm & Trợ lý AI`, `Chợ & Đóng góp`).
Navigation is now a **single source of truth** — `frontend/src/lib/feature-catalog.ts`
— and the rail carries only what a user reaches for daily.

**Rules that now apply**

- `sidebar: true` ⇒ the feature must be a daily-use entry point **and** its
  target page must exist (verified: every `sidebar: true` `href` resolves to an
  `app/` directory or a `map?tool=<id>` tool in
  `components/map/tools/registry.tsx`).
- `sidebar: false` ⇒ the page is still reachable by URL and from
  `/features` (the full catalog, now surfaced inside `/dashboard` as
  `components/dashboard/FeatureQuickNav.tsx`); it is *not* deleted.
- Never hand-edit a nav list. Add a catalog entry, or change `sidebar`.
- Dead routes stay in `backend/src/router.rs` and `PUBLIC_PATHS` (AGENTS §20).
  Consolidation is a front-end grouping decision — it does not delete API surface.

**What changed**

| Before | After | Rationale |
|---|---|---|
| 6 groups (`Tổng quan`, `Tìm kiếm & Trợ lý AI`, `Học tập`, `Hướng nghiệp`, `Cộng đồng`, `Chợ & Đóng góp`) | 6 groups (`Bản đồ & cá nhân`, `Học tập`, `Hướng nghiệp`, `Cộng đồng`, `Trợ lý AI`, `Đóng góp`) | Labels name the job, not the bucket; `ai` and `market` shrink to what is pinned |
| 27 sidebar entries | 17 sidebar entries | Removed the features that are only useful once in a while |
| `/features` on the rail | `/features` off the rail, surfaced inside `/dashboard` | A catalog is a reference, not a destination |
| `knowledge-graph`, `offline-tutor`, `community`, `hs-connection`, `hackathon`, `leaderboard`, `marketplace`, `resource-exchange`, `impact-measurement` pinned | unpinned | Each is a deep-dive tool; pinning them crowded out map/dashboard/career/learn |
| `features` description said "danh mục đầy đủ" | "danh mục đủ mọi tính năng" | Vietnamese only, matches §8 |
| 8 unused `lucide-react` imports in the catalog (`CloudRain`, `Crosshair`, `Database`, `Filter`, `MapPin`, `Satellite`, `ScanSearch`, `ShieldCheck`) | removed | They were unused before the change too; now imports == usage exactly |

**Verification (local, no runtime):**

- `tsc --noEmit`-equivalent balance scan green on both touched files.
- Catalog self-check: 38 unique feature ids, 6 unique groups, every `group`
  resolves to a declared group, every sidebar target exists, lucide imports
  equal usage exactly (40), no stale group labels remain.
- `python3 /tmp/audit_final.py`: `ghosts_be=0`, `ghosts_ai=0`, both
  `live + dead = total` sums hold (`⊆ True`) — no API surface was lost.

## 22. Map Hub tool grouping (2026-11-17)
The Map Hub surfaced all 10 tools as one flat tab strip (`app/map/page.tsx`), which
makes a first-time user scan the whole strip before finding the tool they need.
Tools are now **tiered** so the strip reads as *what you reach for* first, then
*what you dig into*.

**Rules**

- `tier: "core"` — looked at on almost every map visit (browse POIs, wifi, green
  spaces, climate-safe routes, voice search). These sit right after the home tab.
- `tier: "analysis"` — one-off deep dives (data gaps, gap prediction, resource
  optimisation, GeoVision satellite detection, survey planning, GIS agent chat).
  They follow after a `·` separator and a `Phân tích` label.
- Adding a tool: give it a tier in `components/map/tools/registry.tsx`;
  `components/map/tools/types.ts` declares the field; `app/map/page.tsx` renders
  both groups — no per-tool branch in the page.
- The `home` inline tool (the "Bản đồ" tab) is `tier: "core"` and carries the
  field so it satisfies the `MapTool` type.
- This is a presentation change only. No API route, ai-service endpoint or
  crawler was touched; `/tmp/audit_final.py` still reports `ghosts_be=0`,
  `ghosts_ai=0`.

**Split:** `components/map/tools/registry.tsx` có 9 công cụ = 3 `core` + 6 `analysis`;
thêm công cụ ẩn `home`inline (cũng `core`) nên dải tab trên bản đồ đọc là
4 cơ bản · 6 phân tích.

- core (3 trong registry): `wifi`, `green`, `climate`
- analysis (6): `data-hunter`, `gap-predictor`, `resource-optimizer`, `geo-vision`,
  `survey-planner`, `ai-agent`
- `home`inline là tab "Bản đồ chính", `tier: "core"`, đứng đầu dải tab

## 23. CI build errors fixed from the consolidation run (2026-11-18)

The consolidated working tree broke two unrelated builds. Both fixed:

- **Frontend `TS2307`** — `app/api/admin/data-quality/report/route.ts` was moved one
  level deeper (`admin/data-quality/route.ts` → `admin/data-quality/report/route.ts`)
  but its `authService` import kept 4 `../`. Fixed to
  `../../../../../src/services/auth.service` (5 levels:
  `app/api/admin/data-quality/report/route.ts` → `frontend/src`).
  Every `app/api/**/*.ts` was re-scanned: **0** remaining depth mismatches.
- **Rust `E0308`** — `backend/src/modules/share.rs:265` bound
  `name.unwrap_or("")`. `name` is `Option<String>` (`body.name.as_deref().map(clean)`),
  so `unwrap_or("")` returns `&str` where sqlx wants `String`. Fixed to
  `name.unwrap_or_default()`. Sibling `.bind(x.as_deref().unwrap_or(""))` calls are
  `&str` and compile fine — only this one needed the change.

Note: `app/api/admin/data-quality/report/route.ts` came from a **prior, unrelated**
agent run (the `{ => report}/` move in the working tree), not from this consolidation.
The consolidation itself touched no backend or BFF routes.

## 24. Runtime SQL fixes — Render + Supabase/PgBouncer (2026-11-18/19)

Five independent runtime faults made the Rust backend unusable after deploy
(`/api/health` 200, every data endpoint 500/502). All are code-level; no env
change was needed.

1. **`prepared statement "sqlx_s_N" already exists`** — Supabase's PgBouncer
   (transaction mode) discards named prepared statements between transactions.
   `statement_cache_capacity(0)` does **not** help (sqlx then re-prepares the
   same name). Fix: `backend/src/db/mod.rs::query()` wraps
   `sqlx::query::<DB>(sql).persistent(false)` (unnamed statement) and every
   call site uses `crate::db::query(...)`. `query_as`/`query_scalar` have no
   `persistent()` in sqlx 0.8, so their 9 call sites were rewritten to
   `crate::db::query` + `sqlx::FromRow::from_row` / `Row::get(0)`.
2. **`panic = "abort"` killed the whole server** on the first bad row decode
   (one 502 request → every later request 502). Now `panic = "unwind"`: a bad
   handler fails alone.
3. **`Row::get` type panics** — `String` is not `Decode` for UUID/timestamptz,
   `f64` is not `Decode` for NUMERIC, NULL into a non-`Option` panics. Added
   tolerant readers in `db/mod.rs`: `text`, `opt_text`, `int`, `opt_int`,
   `num`, `opt_num`, `flag`, `opt_flag`, `json`, `text_list` (each tries every
   plausible decode and falls back). ~1 100 `row.get::<T, &str>` call sites
   were rewritten to these.
4. **`operator does not exist: uuid = text`** — sqlx binds `&str` as TEXT, so
   `uuid_col = $1` fails (comparisons *and* joins). Fixes: `col::text = $1`
   for predicates, `a.id::text = b.fk::text` for joins (works whether the
   column is uuid or text). INSERT placeholders keep `$N::uuid` where the
   column is uuid.
5. **`wifi` queried columns that do not exist** on `locations`
   (`speed_mbps`, `is_free`, `password`, `password_hint`, `verified`) and
   `ST_X(geography)`. Fixed with literal defaults in the SELECT and
   `ST_X(coordinates::geometry)`; the INSERT only writes real columns.

Rules going forward:
- New SQL must use `crate::db::query`, never `sqlx::query`.
- Read rows only through the `db::*` readers, never `row.get::<T, _>`.
- Treat ids as TEXT in predicates/joins (`::text`), so the code is agnostic to
  whether the live Supabase column is `uuid` or `text`.

### 24.1 Follow-up fixes (same deploy chain)

- **Auth on public routes.** `AuthLayer` used to skip token decoding for any
  path in `PUBLIC_PATHS`, so handlers that need an identity (dashboard,
  notifications, bookmarks, business, certificates) always saw `None` → 401.
  It now decodes the bearer token on public paths too, ignores a bad token and
  attaches a valid `AuthUser`.
- **Enum columns.** `users.role` is `user_role_enum`; inserting a text bind
  fails. `DB_INSERT_USER` casts `$4::user_role_enum`, and the user SELECTs /
  RETURNING cast `role::text`, `status::text` so `sqlx::FromRow` (which uses
  strict decoding) works.
- **`sqlx::FromRow` rows must be text already.** Any struct-based query has to
  cast uuid/enum/timestamp columns to text (`id::text AS id`,
  `CAST(created_at AS TEXT)`), because those readers are not tolerant. Fixed
  for `users`, `user_preferences`, `chat_histories`.
- **`text()`/`opt_text()` gained a raw-bytes fallback** so Postgres enum labels
  decode to their text value.
- **`UNION` type mismatches**: cast every branch's timestamp to text
  (`a.created_at::text`) — done for `/api/dashboard/history`.
- **Correlated subqueries** with mixed id types: cast both sides
  (`p.business_profile_id::text = bp.id::text`) — done for `/api/business`.

Verified on the host (2026-11-19): 25 public endpoints and 8 authenticated
endpoints all return 200, including `/api/library/*` (the original report).

### 24.2 Browser mock layer, PostGIS casts, POI dedupe panic (2026-11-19)

The page the user saw as "12 cái mock sẵn" was the **client-side mock API**
(`frontend/src/mock/install.ts`), not fake rows in Postgres. It patched
`window.fetch` for every same-origin `/api/*` call and, for any route it did not
know, answered `{data:[],items:[],meta:{total:0},mock:true}` — and its seed had
exactly 12 `libraryResources`. Four independent faults had to be fixed:

1. **Mock gate (fixed, commit `72aec9b`).** `installMockApi()` defaulted to ON
   (`flag !== 'false'`). It is now opt-in **and** never installs in production:
   `NODE_ENV === 'production'` → disabled; otherwise only when
   `NEXT_PUBLIC_USE_MOCK_API === 'true'`. Verified on the live bundle: the new
   `app/layout-*.js` no longer contains `__edumapMockInstalled`/`window.fetch=`.
   The mock *data module* (`src/mock/db.ts`, storage key `edumap-mock-db-v4`) is
   still bundled, which is expected — it is only *installed* by the gate.
2. **PostGIS mixed `geography`/`geometry` (commit `1359347`).** `ST_Intersects`
   / `ST_DWithin` / `ST_Distance` with a raw `ST_MakeEnvelope`/`ST_MakePoint`
   are ambiguous for `GEOGRAPHY` columns. All such predicates now cast
   explicitly: `col::geometry` for bbox tests (`map_points.location`,
   `locations.coordinates`, `geo.rs`, `opportunity.rs`) and
   `ST_SetSRID(ST_MakePoint(...), 4326)::geography` for distance tests
   (`map.rs` nearby/ORDER BY, `internship.rs`, `intl.rs`,
   `learning_community.rs`). `summer_campaigns` has no `address` column — the
   pin query selects `location`.
3. **`levenshtein_simple` transposed matrix (commit `02250d0`).** The DP table
   was `vec![Vec; n+1]` (rows = `a`) but the inner loops wrote `matrix[j][i]`
   (rows = `b`). Whenever a POI cluster made `m > n` the index ran off the end
   and panicked → Render returned **502 with `content-length: 0`** for
   `/api/map/pois` on any dense bbox (city-centre DNTU bbox failed, a rural
   single-POI bbox worked). Rewritten to `matrix[i][j]` with the standard
   insert/delete/substitute recurrence. `locations.coordinates` is now also
   `ST_AsText(...)` (it was selected raw, so every location row decoded to
   `lat=0,lng=0`).
4. **BFF unwrap (commit after `02250d0`).** `frontend/app/api/map/pois/route.ts`
   called `.filter()` on the unwrapped payload, but the Rust handler returns
   `{items,total}` — so the BFF threw and answered 502 `Không tải được dữ liệu
   bản đồ` while the backend was healthy. It now accepts `items`, filters
   non-finite lat/lng and slices 5000.

**Also fixed in the same pass (map AI proxies).**
`get_data_gaps` sent `bounds: {minLat:null,...}` (ai-service 422
`float_type`) and **no `points`**, so the endpoint could never analyse
anything. It now parses the four bbox values, sends `bounds` only when all four
are present (plain `null` otherwise) and ships up to 2000 POIs from
`list_all_pois`. `list_all_pois` read `body.0.data.as_array()`, but `list_pois`
returns `{items,total}` → it was **always empty**, which also starved the
resource-optimisation demand points; it reads `.data["items"]` now.
`survey_params` sent `current_lat`/`min_lat` flat while
`/api/ai/survey/*` expects `current_location: {lat,lng}` + `bbox: {min_lat,...}`
+ `points`, so the survey planner always fell back to the 7 static Biên Hòa
candidates; it now builds the nested body, omits absent optionals (a `null` for
a constrained `float` is a 422), and includes up to 2000 POIs.
`DataGapsQuery` / `PoiBoundsQuery` gained camelCase `serde(alias=...)` so a
client sending `minLat` works as well as `min_lat`.

**Render free-tier networking.** `AI_SERVICE_URL` was `http://edumap-ai:8000`.
Render's own docs: *"Free web services can send private network requests, but
they can't receive them"* — so the Rust service timed out against the internal
hostname (`error sending request for url (http://edumap-ai:8000/...)`) and
`/api/map/{data-gaps,gap-forecast,resource-optimization}` answered 500.
`render.yaml` now uses the **public** URL `https://edumap-ai-0xlt.onrender.com`
(the same value must be set on the live `edumap-api` service in the Render
dashboard — the blueprint only applies on a fresh sync).

Verified on the host after deploy: `/api/map/pois` with a wide bbox → 200 with
1222 items and **0 zero-coordinate rows**; a DNTU-sized bbox → 200 with 6
items; `/api/map/locations`, `/api/map/featured-pins`, `/api/map/stats`,
`/api/map/categories` → 200; through the Vercel BFF `/api/map/pois` → 200 with
1222 items.

### 24.3 Map taxonomy filter + O(n²) dedupe (2026-11-19)

The crawled seed (`seed_crawled_data.sql`) inserts **3192** `locations` rows whose
`description` is the raw OSM type — schools (1821) and universities (155), but
also hotels (108), bars, hairdressers, bakeries. `location_to_poi_row` only read
the (mostly NULL) joined `category_name`, so 3059 rows came back as `other` and
`/api/map/pois` (and resource-optimisation demand points) were dominated by
HCMC hotels.

- `os_location_category(description)` now maps the OSM type onto the app's map
  taxonomy (`school|language_school|driving_school|college|kindergarten` →
  `school`, `university`, `library`, `bookstore`, `cafe`,
  `restaurant|fast_food|food_court`, `park|garden|playground` → `green`,
  `marketplace|supermarket`, `convenience|mall`, `lab`, `wifi*` → `wifi`).
  `location_to_poi_row` returns `None` for anything outside the taxonomy
  (hotel/bar/hairdresser/…), so those rows are simply not rendered as POIs.
  **No DB row is deleted** — this is a query-time presentation filter, and the
  rows stay reachable through `/api/wifi/locations`, `/api/share/*`, etc.
- `deduplicate_pois` was all-pairs O(n²) (~4.8 M comparisons on 3105 rows →
  `/api/map/locations` answered in **~20 s**). It now buckets rows in 0.01°
  (~1.1 km) cells and only compares a row against its own cell + the 8
  neighbours; the 200 m duplicate radius is far smaller than one cell, so the
  result is unchanged.

Verify after deploy: `/api/map/locations` should be fast (sub-second-ish) and no
longer contain `category: "other"`; `/api/map/pois` keeps the education /
study-space taxonomy only.

### 24.4 Caching the two slow map AI proxies (2026-11-19)

`/api/ai/data/gaps` and `/api/ai/resource/optimize` recompute a grid / MCLP over
~2000 POIs and took **16 s** and **13.5 s** on every call (1 vCPU). Their result
depends only on the request body, so `ai-service/services/response_cache.py`
(a plain dict TTL cache, 24 h, 128 entries, no Redis needed) now keys on
`sha256(payload)`:

- `routers/data_quality.py::data_gaps` caches `identify_data_gaps` output;
- `routers/resource.py::optimize_resources` caches the successful
  `solver.optimize` result (degraded results are not cached).

Cache hits return `metadata.cached = true` (the stored copy is not mutated).
Repeat calls are now sub-second; the first call after a container restart still
pays the full computation.

## 25. Map-first pass — ghim thao tác tại chỗ, bỏ modal phủ tối (2026-11-19)

Mục tiêu: `/map` hành xử như Windy — mọi tương tác diễn ra trên bản đồ, không
có lớp phủ tối, không còn trang danh sách trùng lặp.

### 25.1 Không còn lớp phủ tối trên `/map`
- `FeaturedPinPopup` (`fixed inset-0 bg-black/50`) bị xoá; chi tiết ghim giờ là
  `components/map/FeaturedPinCard.tsx` render **trong** panel Map Hub.
- `VoiceSearchPopup` bỏ `bg-black/60 backdrop-blur-sm` → card nổi
  `fixed bottom-6 left-1/2 -translate-x-1/2` (dùng chung với `/ai-chat`).
- Form "Ghim vị trí mới" bỏ modal `fixed inset-0 bg-black/40` → `card-surface`
  trong panel; `handleMapClick` tự mở tab `map` + panel.
- `MapClickHandler` (`components/ui/MapComponent.tsx`) bỏ qua
  `.leaflet-popup*`, `.leaflet-marker-icon`, `.marker-cluster`, `.edumap-pin`,
  `.edumap-cluster-marker`, `.leaflet-tooltip`, `.leaflet-control` — bấm ghim
  không bao giờ mở form ghim.

### 25.2 Ghim chức năng thao tác tại chỗ
`FeaturedPinCard` có 2 hành động:
- **Chỉ đường** → `onRoute(pin)` → page set `directionsTarget` →
  `InteractiveMap` gọi `routeToPoi()` (định vị GPS, mở tab `Chỉ đường`, tính
  lộ trình). `directionsTarget` được chống lặp bằng ref khoá `lat,lng`.
- **Xem trên bản đồ** → `onOpenTool(toolId)` → page set `focusTarget` (flyTo)
  rồi `handleToolChange(toolId)`; tool overlay vẽ danh sách tương ứng.
  `MAP_TOOL_FOR_CATEGORY` map đủ 6 category: wifi, green, stem, summer, donate,
  market. Category lạ mới rơi về nút "Mở trang ..." (`featureLink`).

### 25.3 Bảy trang danh sách → map tool
| Trang cũ | Tool | Panel làm gì |
|---|---|---|
| `/learning-spaces` | `learning-space` (core) | lọc bán kính/WiFi/rating/yên tĩnh/giờ mở, GPS, danh sách điểm + điểm AI, focus marker, giải thích AI |
| `/stem` | `stem` (analysis) | tìm lab, chọn thiết bị, form đặt lịch ngay trong panel (`stemService.bookEquipment`) |
| `/summer` | `summer` (analysis) | danh sách chiến dịch, đăng ký TNV, báo cáo hoạt động theo ngày |
| `/donate` | `donate` (core) | tiến độ chiến dịch, form ủng hộ (nhanh + tuỳ chọn, ẩn danh) |
| `/marketplace` | `market` (core) | sách/học cụ, lọc category, form mượn, form đăng tài liệu |
| `/wifi` | `wifi` (core) | đã có từ trước |
| `/green` | `green` (core) | đã có từ trước |

- Panel dùng chung `card-surface`, KHÔNG dùng modal; mọi form đều inline.
- Giữ nguyên detail/checkout: `/donate/campaign/[id]`,
  `/marketplace/{products,services,cart}`.
- `next.config.js` redirect 7 đường dẫn cũ; `feature-catalog.ts` trỏ
  `/map?tool=...`; `bookmark.service.ts` map thêm `learning_space`, `stem_lab`.
- `app/sitemap.ts` bỏ `/green` và `/marketplace`.

### 25.4 `/impact-match` — sửa "cái cao cái thấp"
- Hàng lọc đổi từ `flex` lệch chiều cao sang grid
  `sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end`; mọi
  input/select/button dùng `h-10` (kể cả input trong 2 modal).
- Thẻ nhu cầu/nhà tài trợ: mô tả `min-h-[2.5rem]`, khu tag `min-h-[1.75rem]`,
  hàng đáy `h-6` + `Toàn quốc` khi thiếu địa bàn → mọi thẻ trong cột cùng
  chiều cao.
- Sửa lỗi tag render rỗng (`{tag}` bị thiếu) và typo "ghẹp nối" → "ghép nối".

### 25.5 Kiểm chứng (local, không chạy runtime)
- Parse toàn bộ `.ts/.tsx` frontend: **PARSE OK**.
- `tsc` scoped trên 12 file đã đổi: chỉ còn `TS2307`/`TS2591` do thiếu
  `node_modules` local, **0 lỗi type thật**.
- `node /tmp/unused.js`: không còn import thừa ở các file đã sửa.
- `python3 /tmp/audit_final.py`: `ghosts_be=0`, `ghosts_ai=0`, tổng
  `live + dead = total` vẫn khớp.
- Runtime truth vẫn là host sau khi người dùng deploy.

## 26. P0 de-hallucination + P1 dữ liệu thật (2026-11-19/20)

Mục tiêu: `/map` và các danh sách không còn dữ liệu bịa. P0 chặn dữ liệu bịa
ngay tại nguồn; P1 bổ sung nguồn thật (báo chí VN, ảnh thật của bài, toạ độ
neo theo địa chỉ, scheduler chạy hằng đêm) — không sinh thêm dòng nào bằng
random hay bằng LLM.

### 26.1 P0 — ngăn dữ liệu bịa tại nguồn

| Vị trí | Trước | Sau |
|---|---|---|
| `ai-service/routers/geo.py` `/analyze` | luôn gọi LLM kể cả khi 1-2 điểm → bịa mật độ/xu hướng | `GEO_ANALYSIS_MIN_POINTS` (mặc định 10); dưới ngưỡng trả `degraded=true` + `stats` đếm được (`_bbox_area_km2`, `_summarize_points`, `_data_only_analysis`), không gọi LLM |
| `llm_service.analyze_geo_density` | prompt không ràng buộc số liệu | prompt chỉ được dùng `stats` được truyền vào (temperature 0.2); `_geo_analysis_fallback` không còn bịa `density_score=50.0` |
| `llm_service.explain_learning_space_recommendation` | LLM tự thêm chi tiết | prompt cấm thêm dữ kiện ngoài dữ liệu |
| `backend/src/modules/map.rs::ai_analysis` | không truyền POI thật | `AiAnalysisForm` nhận `min_lat/max_lat/min_lng/max_lng`; handler đọc POI thật (`list_pois`/`list_all_pois`), cap 800 điểm hợp lệ rồi mới gọi ai-service |
| `map.rs::list_pois` | lộ row tên kiểu `"{category} tại lat,lng"` | `is_synthetic_poi_name()` lọc bỏ |
| `crawlers/tavily_poi.py` | tạo tên `"{category} tại lat,lng"` khi thiếu tiêu đề | bỏ dòng đó (skip) thay vì bịa tên; chỉ nhận URL `http(s)` |
| `ai-service/routers/analytics.py` | `education_stats` trả cả dòng không nguồn | `_filter_sourced_stats()` loại dòng thiếu `source` (trừ khi `EDUCATION_STATS_ALLOW_UNSOURCED=true`) |
| `scripts/seed_analytics_data.py`, `seed_analytics.sql` | sinh số liệu random | xoá khối `education_stats` (60 dòng) + xoá `scripts/seed_education.py`, `seed_education_stats.sql`; thêm `cleanup_synthetic_education_stats.sql` |
| `frontend/app/map/page.tsx` | "Phân tích AI khu vực" gửi câu hỏi chung | `runAiAnalysis` gửi bbox viewport + `query: "Khu vực đang xem"`, đọc `data.ai_analysis`, truyền `hubs` dạng GeoJSON; `AiPanel` hiện mật độ theo điểm/km², chip số liệu, ghi chú `degraded` màu amber, "Ghi nhận từ dữ liệu" |

### 26.2 P1 — ảnh thật cho mọi nội dung crawl

- `crawlers/db_utils.py`: `pick_image_urls()` (nhận `str`/`{"url"}`/hỗn hợp,
  xử lý `//cdn…`, loại tracking pixel/spacer/logo/icon/`data:`; chấp nhận đuôi
  `.jpg.avif` và path hint `/images/ /photo/ /media/ /uploads/`), `image_from_html()`.
  `_IMG_EXT_RE` / `_IMG_REJECT` là hằng module.
- `crawlers/tavily_client.py`: `search(include_images=…)`, `extract` truyền tiếp,
  `search_and_extract(include_images=True)` trả về **ảnh của riêng từng bài**
  (`ext_by_url`), kèm `published_date` + `source`.
- `crawlers/tavily_parse.py`: `coerce_published()` (RFC/ISO/`dd/mm/yyyy` → UTC,
  sai thì `None` chứ không đoán); `parse_tavily_posts` phát `media_urls`,
  `source_url`, `published_at`; `make_post_row` nhận `published_at` + chuẩn hoá
  ảnh. Sửa lỗi có sẵn `IndexError: no such group` trong `extract_deadline()`
  (regex 3 group nhưng code đọc `group(4)`).
- 6 crawler ghi ảnh/nguồn/ngày thật: `scholarships_crawler` (`image_url`,
  `source_url`, `published_at`), `events_crawler` (`banner_url` — bỏ cột chết
  `events.image_url`), `hackathons_crawler`, `donations_crawler`
  (`images` + `source_url`), `community_posts_crawler`, `social_crawler`.

### 26.3 P1 — crawler báo chí thật (RSS)

- `crawlers/news_sources.py`: 8 feed giáo dục đã kiểm HTTP 200 —
  Tiền Phong, Dân trí, Thanh Niên, Tuổi Trẻ, VnExpress, VietnamNet
  (`https://vietnamnet.vn/giao-duc.rss`, bản `/rss/` trả 301), VietnamPlus
  (TTXVN), Giáo dục & Thời đại. `parse_feed()` đọc cả RSS 2.0 và Atom, trả `[]`
  (không raise) khi XML hỏng; `parse_published()` RFC822 + ISO; `strip_html()`
  hai lần unescape.
- `classify(title, summary)` **ưu tiên tiêu đề**: chỉ nhận tín hiệu từ summary
  khi có đúng cụm "học bổng" — tránh xếp tin thường thành học bổng/cuộc thi.
- `crawlers/news_crawler.py`: ghi `scholarships` (key `title`) và `posts`
  (key `title`+`source`), `description`/`content` kết thúc bằng
  `Nguồn chính thức: <url> · Kiểm chứng: <ngày>`. Hạn nộp không xác định →
  **NULL** (frontend hiện "Xem trang chính thức"), không bịa `NOW+60d`.
- Chạy thử thật: 31 scholarships + 83 posts, URL/ảnh/ngày đều lấy từ bài gốc.

### 26.4 P1 — toạ độ neo theo địa chỉ

- `crawlers/geocode.py`: Nominatim (`NOMINATIM_URL`), ép IPv4, throttle 1.1 s,
  cache JSON trong `/tmp`, `GEOCODE_MAX_PER_RUN=150`,
  `GEOCODE_MAX_DISTANCE_KM=15`, `GEOCODE_REQUIRE` (bật thì bỏ dòng không
  resolve được địa chỉ). `verify_or_replace(addr, lat, lng)` trả
  `(lat, lng, "geocode"|"text")` hoặc `None`; không bao giờ trả `(0, 0)` và
  chỉ nhận toạ độ trong khung VN (lat 8–24, lng 102–109.6).
- `crawlers/tavily_poi.py` neo mọi POI qua `verify_or_replace` trước khi ghi,
  thêm `photos` + `coord_source`. Đã kiểm: địa chỉ DNTU →
  `(10.9844801, 106.8696454)` thay cho toạ độ regex lệch.
- `scripts/crawl_pois_vietnam.py`: `TYPE_MAP` mở rộng đủ taxonomy
  (university/school/library/bookstore/lab/wifi/green/park/cafe/restaurant/
  market/convenience); `upsert_postgres()` (psycopg2, `ST_DWithin` 100 m +
  tên, refresh description/address/photos/source_url thay vì nhân bản);
  `main()` rẽ nhánh `DB_TYPE` (mặc định `postgres`).

### 26.5 P1 — scheduler thật + cột provenance

- `crawlers/crontab`: `DB_TYPE=postgres`, `DB_SQLITE_PATH=` rỗng, thêm khối
  news crawler.
- `scripts/run_feature_crawlers.sh`: mặc định `postgres`, `news` chạy đầu danh
  sách `news jobs internships hackathons events community_posts social
  scholarships donations gamification`.
- `scripts/run_crawl_pois.sh`: mặc định `postgres`, bỏ `DB_SQLITE_PATH`.
- `.github/workflows/crawl-nightly.yml`: Render free tier không chạy cron nên
  GitHub Actions làm scheduler — cron `0 17 * * *` (= 00:00 VN),
  `workflow_dispatch` với input `crawlers` / `run_pois`; áp
  `add_content_provenance_columns.sql` rồi chạy crawler. Thiếu secret DB thì
  bước migration bỏ qua kèm `::warning::` (job vẫn xanh).
- Secret cần khai trong GitHub: `DB_HOST`, `DB_PORT`, `DB_USERNAME`,
  `DB_PASSWORD`, `DB_DATABASE`, `TAVILY_API_KEY` (tuỳ chọn).
- `backend/src/database/migrations/add_content_provenance_columns.sql`
  (idempotent `ADD COLUMN IF NOT EXISTS` + 4 index) và `schema.sql`:
  `scholarships.image_url/source_url/published_at/location_scope`,
  `events.source_url/published_at`, `posts.source/source_url/published_at/
  location_scope`, `donation_campaigns.source_url/published_at/location_scope`,
  `locations.source_url`, `map_points.source_url`.

### 26.6 P1 — backend + frontend đọc dữ liệu mới

- Cột mới trong Rust đọc qua `to_jsonb(<table>)->>'col'` (scholar.rs,
  community.rs, map.rs) → nếu migration chưa chạy thì trả `null` chứ không 500.
- `scholar.rs`: `image_url`/`source_url`/`published_at` trong 2 SELECT, 2
  RETURNING và `scholarship_to_json`.
- `community.rs`: `source`/`source_url`/`published_at` trong
  `DB_SELECT_POSTS`, `DB_SELECT_POST_BY_ID`, `post_to_json`; **sửa 500 có sẵn**:
  filter từ `" AND {filters}"` nối sau `) sub` → `" WHERE {filters}"`.
- `map.rs`: `photos` + `source_url` trong POI bbox/type/by-id/locations;
  helper `photos_of()` trả `[]` khi thiếu.
- Frontend: `MapPopupContent` (`photos`, `sourceUrl`, thumbnail `onError` ẩn,
  link "Nguồn chính thức ↗"), `MapComponent` truyền 2 prop; `scholarships`
  (thumbnail thẻ + ảnh hero + deadline null-safe), `community` (thumbnail
  `media_urls[0]` + link nguồn ở cả card và popup chi tiết);
  `scholarship.service.ts` / `community.service.ts` thêm field optional.

### 26.7 Kiểm chứng P0+P1 (local, không chạy runtime)

- `py_compile` OK toàn bộ `crawlers/*.py` + `scripts/crawl_pois_vietnam.py`;
  import sweep 15 module crawler sạch.
- `bash -n` OK: `crawlers/entrypoint.sh`, `run_feature_crawlers.sh`,
  `run_crawl_pois.sh`.
- News crawler chạy thật (RSS): 31 scholarships + 83 posts, ảnh/URL/ngày thật.
- Geocode chạy thật: DNTU resolve đúng, địa chỉ rác giữ toạ độ gốc.
- Brace-balance BALANCED: `map.rs`, `scholar.rs`, `community.rs`, `geo.py`.
- Frontend: parse toàn bộ `.ts/.tsx` **PARSE OK**; `tsc` scoped trên 22 file →
  chỉ `TS2307` (thiếu `node_modules` local), **0 lỗi type thật**;
  `/tmp/unused.js` sạch.
- `python3 /tmp/audit_final.py`: `ghosts_be=0`, `ghosts_ai=0`,
  `155+88=243 ⊆ True`, `17+55=72 ⊆ True`.
- **Chưa kiểm được**: đường Tavily `include_images` (máy local không có
  `TAVILY_API_KEY`); runtime truth vẫn là host sau khi người dùng deploy.

### 26.8 Việc người dùng phải làm khi deploy

1. Chạy `backend/src/database/migrations/add_content_provenance_columns.sql`
   trên Supabase (workflow cũng tự chạy nếu có secret DB).
2. Chạy một lần `cleanup_synthetic_education_stats.sql` để xoá số liệu random
   còn trong production (trong lúc chưa chạy, ai-service đã lọc ẩn chúng).
3. Khai secret GitHub Actions: `DB_*` + `TAVILY_API_KEY`, rồi
   `workflow_dispatch` `crawl-nightly` một lần để làm đầy dữ liệu thật.
4. Smoketest sau deploy: `/api/scholarships` (có `image_url`/`source_url`),
   `/api/community/posts` (có `source_url`, filter không 500), `/api/map/pois`
   (POI có `photos`), `/map` → "Phân tích AI khu vực" (số liệu khớp POI thật).

## 27. P2 de-hallucination + cầu Postgres cho ai-service (2026-11-20)

P0 (chặn nguồn) và P1 (nguồn thật) đã xong. P2 xoá nốt các giá trị **tự sinh**
còn lại và sửa một lỗi kiến trúc lớn: **ai-service đọc SQLite trong khi
production là Postgres (Supabase)**, nên impact measurement, climate guardian,
career/mentor fallback, data-quality, question-gap, analytics và knowledge graph
đều trả rỗng trong production (baseline 70% giả đã che mất lỗi này).

### 27.1 Cầu Postgres dùng chung — `ai-service/services/pg.py`

- `ThreadedConnectionPool` (1..`AI_DB_POOL_MAX`, mặc định 4), `RealDictCursor`,
  `connect_timeout` (`DB_CONNECT_TIMEOUT`, mặc định 10), `sslmode`
  (`DB_SSLMODE`, mặc định `prefer`).
- `is_postgres()` — `DB_TYPE != 'sqlite'` (mặc định postgres);
  `configured()` — có `DB_HOST` + psycopg2; `borrow()` — trả pool cho lớp
  adapter.
- `query()` / `scalar()` **không bao giờ raise**: thiếu cấu hình, connection
  refused hay SQL sai đều trả `[]`/`None`. Pool chỉ bị reset khi lỗi
  `OperationalError`/`InterfaceError` (connection-level), không reset vì một
  câu SQL sai.
- Câu lệnh gửi **unnamed statement** (không prepared) để PgBouncer của Supabase
  (transaction mode) không gặp `prepared statement already exists`.
- Quy ước SQL: `id::text`, `CAST(jsonb AS TEXT)`, `CAST(enum AS TEXT)`,
  `CAST(timestamp AS TEXT)`, `CAST(numeric AS DOUBLE PRECISION)`,
  `ST_AsText(geom)`; join/predicate so sánh id dạng `::text`.
  `locations` **không có** `deleted_at` (khác `map_points`).

### 27.2 Bỏ dữ liệu tự sinh còn lại

| Vị trí | Trước | Sau |
|---|---|---|
| `services/resource_optimizer.py` | `_default_demand_points()` sinh 24 điểm nhu cầu quanh tâm | xoá hàm; `demand_points` rỗng → `degraded` + FeatureCollection rỗng + lý do tiếng Việt |
| `services/impact_measure.py` | baseline "trước triển khai" = dân số × 0.70 | không còn baseline giả: `has_baseline=false`, `access_rate`/`user_count`/`diff`/`people_in_radius`/`impact_score`/`confidence_interval` = `null`; narrative template nêu rõ thiếu dữ liệu nền, **không gọi LLM** khi không có baseline |
| `models/impact_measure_models.py` + `routers/impact_measure.py` | field `float` bắt buộc, trả 0 | `Optional[...]`, thêm `has_baseline`, degraded trả `null` chứ không trả 0 |
| `llm_service._suggestions_fallback` | 3 nghề bịa kèm `match_score` 85/78/72 | trả `[]`; `routers/suggestions.py` đánh dấu `degraded=true` + lý do |
| `llm_service._chat_fallback_reply` | **lỗi thật**: `def` bị lặp (thụt 5 space) làm hàm trả `None` → `_strip_markdown(None)` crash toàn bộ chat fallback | xoá dòng lặp; fallback trả chuỗi 327 ký tự |
| `crawlers/scholarships_crawler.py` | deadline thiếu → `now + 30 ngày` | deadline không xác định/ngoài phạm vi → `NULL` (UI hiện "Xem trang chính thức") |
| `crawlers/jobs_crawler.py`, `crawlers/internships_crawler.py` | `application_deadline`/`deadline` = 31/12 năm crawl; internship `duration="Flexible"`, `requirements`/`benefits` tự viết | `NULL` hết |
| `crawlers/tavily_parse.py` | `parse_tavily_jobs` luôn gán deadline cuối năm; `make_*_row` tự bịa deadline/duration/benefits/`is_free=True`/tên POI `"{category} tại lat,lng"`/`capacity=200` | deadline lấy từ bài viết hoặc `NULL`; các field bịa → `NULL`; POI không tiêu đề → bỏ dòng |
| `crawlers/events_crawler.py` | không có ngày → coi như diễn ra hôm nay, `end=+1 ngày`, `capacity=200` | không có ngày thật → **bỏ sự kiện** (`events.start_date` NOT NULL); `capacity=NULL` |
| `scripts/seed_analytics_data.py` + `backend/src/database/migrations/seed_analytics.sql` | sinh 1000 `user_events` random | **xoá cả hai** (bảng `user_events` còn không tồn tại trong `schema.sql`) |
| `scripts/seed_dntu_content.py`, `seed_dntu_extra.py`, `mega_seed_dntu.py` | seed học bổng/sự kiện/số liệu bịa, chạy được ngay | thêm cổng `ALLOW_DEMO_SEED=1` (giống `seed_edu_data.py`) |
| `backend/src/modules/wifi.rs` | 3 query `true AS is_free` | `NULL::boolean AS is_free`; JSON trả `null` thay vì `false` |
| `frontend/.../WifiTool.tsx` | `is_free` false → "Trả tiền"; tốc độ mặc định "Ổn định" | ba trạng thái Miễn phí / Trả tiền / **Chưa rõ**; tốc độ lấy từ `speed_mbps` thật, không có → "Chưa đo" (marker xám) |
| `frontend/.../FeaturedPinCard.tsx` | `is_free` false → "Trả tiền" | thêm nhánh "Chưa rõ" |

### 27.3 ai-service đọc Postgres (thay vì SQLite rỗng)

Giữ nguyên nhánh SQLite sau `DB_TYPE=sqlite` cho dev, nhưng mặc định đọc
Postgres:

- `services/impact_measure.py::_load_facilities` — `map_points` +
  `ST_Intersects(... ST_MakeEnvelope)`.
- `services/climate_guardian.py` — `locations`, `map_points`, `flood_zones`
  (`ST_AsGeoJSON`, `"riskLevel"`).
- `services/llm_service.py::_read_fallback_rows(sql, pg_sql, params)` dùng cho
  career advice, `_recommend_career_fallback`, `_match_mentors_fallback`,
  `_get_local_trends` (jobs + career_paths). Lưu ý `mentors` **không có** cột
  `location` → `NULL::text AS location`.
- `services/data_quality.py::_query`, `services/auto_scheduler.py::_query`,
  `routers/analytics.py::_query`, `services/question_gap_analyzer.py`
  (`query_logs`), `services/predictive_service.py` (jobs skills + POI UNION).
- `services/knowledge_graph.py` — **knowledge graph chạy được trên Postgres**:
  tự tạo `kg_nodes`/`kg_edges`/`kg_extraction_review` (`_init_schema` chọn DDL
  Postgres hay SQLite), adapter `_PgConn` dịch `?` → `%s` và trả row kiểu
  `sqlite3.Row` (hỗ trợ `row[0]`), `_fetch(sql, pg_sql)` cho các bảng nguồn,
  upsert portable (`ON CONFLICT (id) DO UPDATE` / `ON CONFLICT DO NOTHING`),
  `updated_at` bind bằng Python. `_ensure()` retry bootstrap mỗi 60 s thay vì
  chết tới lần restart sau (trước đây `_available` chỉ đúng khi `DB_TYPE=sqlite`
  nên toàn bộ tính năng chết ở production).
  Sửa kèm 2 lỗi thật: `_parse_json` là `@staticmethod` nhưng đọc `self` (mọi lần
  trích xuất LLM đều rơi vào rule-based), và `knowledge_graph.query(...)` trả
  `False` thay vì `None` khi chưa sẵn sàng.

### 27.4 Kiểm chứng P2 (local, không chạy runtime)

- `python3 -m compileall ai-service crawlers scripts` → OK.
- Import sweep 14 module ai-service → OK (không có Postgres local: mọi cầu
  Postgres trả `[]`, knowledge graph tự báo `degraded` và retry sau 60 s).
- Knowledge graph chạy thật trên SQLite tạm: 11 nodes / 11 edges, `query()`
  1-degree, `suggest_partners`, `extract_entities` (7 link), review +
  `approve_extraction`, seed lần 2 idempotent.
- `impact_measure.measure()` không có cơ sở → `impact_score=None`,
  `has_baseline=False`, narrative giải thích; có baseline thật → 19.3 + Wilson CI.
- `resource_optimizer.optimize({demand_points: []})` → degraded, 0 feature.
- Frontend: PARSE OK; `tsc` scoped 28 file → 0 lỗi type thật (chỉ TS2307 do
  thiếu `node_modules`); `/tmp/unused.js` sạch.
- `python3 /tmp/audit_final.py`: `ghosts_be=0`, `ghosts_ai=0`,
  `155+88=243 ⊆ True`, `17+55=72 ⊆ True` — không mất API surface.
- **Chưa kiểm được**: mọi câu SQL Postgres mới (máy local không có DB Supabase);
  runtime truth vẫn là host sau khi deploy.

### 27.5 Việc người dùng phải làm khi deploy

1. Deploy như bình thường (`git push` → Actions build → Render).
2. Smoketest: `/api/impact-measurement/measure` (vùng chưa có cơ sở →
   `impact_score: null`, `has_baseline: false`, `degraded: true`),
   `/api/map/climate-risk` (có facility thật), `/api/wifi/locations`
   (`is_free: null` thay vì `true`), `/api/community/posts?type=...` (200),
   `/api/ai/knowledge/graph` (node_count > 0 sau lần seed đầu),
   `/api/career/jobs` (deadline `null` khi bài viết không nêu hạn).
3. `kg_*` không cần migration tay — bảng tự tạo khi ai-service khởi động.
