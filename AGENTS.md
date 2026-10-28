# AGENTS.md — EduMap project memory

> This file is the persistent context for any AI agent working on EduMap.
> Read it before changing code. Keep it up to date when deployment or
> architecture assumptions change.

## 1. Deployment model (IMPORTANT — do not forget)

> ### ⚠️ Deployment contract (read this first)
>
> - **Runtime = Hugging Face Spaces, FREE plan, and nowhere else.**
>   The Space (`tancse2005/Edumap`) runs on the **free CPU tier**: 2 vCPU /
>   16 GB RAM, **ephemeral disk**, **sleeps after ~48 h of inactivity**, and
>   every restart wipes `/tmp`. There is **no** paid hardware, no persistent
>   volume, no external Postgres/Redis/MinIO/Chroma server.
> - **Local machine = code editing only.** `/home/ngoctan/Downloads/EduMap`
>   exists to write code, read code, and run unit tests / typechecks. A local
>   run (even a green one) is **never** proof that the feature works: the only
>   accepted verification is a request against
>   <https://tancse2005-edumap.hf.space> after a deploy.
> - Consequences that shape every design decision:
>   - Anything written to `/tmp` (ChromaDB vectors, uploads, caches, elevation
>     tiles) disappears on restart → features must degrade gracefully and
>     re-seed on boot, never assume warm state.
>   - Cold start takes tens of seconds → frontends/proxies need retries and
>     honest loading states; a first-request 503 is a cold start, not a bug.
>   - No GPU / no bundled models → all AI work goes through remote APIs
>     (Cloudflare Workers AI → Gemini) with template fallbacks.
>   - Only one container, one public port (7680) → internal services must stay
>     on 3000/8000 and be reached through the Next.js BFF, never from browsers.

- **Production runs ONLY on Hugging Face Spaces (Docker, free plan).**
  - Space: <https://huggingface.co/spaces/tancse2005/Edumap>
  - Public URL: <https://tancse2005-edumap.hf.space>
  - Hardware: **free CPU basic** — no GPU, no persistent storage.
- **Local (`/home/ngoctan/Downloads/EduMap`) is for code editing, unit tests,
  and inspection only.** Do not treat a local run as the source of truth for
  runtime behaviour. Validate runtime fixes on the HF Space.
- Deploy with:
  ```bash
  HF_TOKEN=<token> ./deploy-hf.sh
  ```
  (`deploy-hf.sh` pushes `HEAD:main` to the `hf` remote.)
  > **Verified caveat (2026-10-27):** the HF Space repository has its own
  > commit history ("chore: upload project files…") that is unrelated to this
  > local git history, so a plain push can be rejected as non-fast-forward.
  > If that happens, upload the tree with `huggingface_hub.HfApi().upload_folder`
  > (or `huggingface-cli upload`), or force-push only after confirming you
  > intend to replace the Space tree. The deployed files themselves did match
  > local HEAD when this note was written.
  > **No deploys from the agent:** there is no `HF_TOKEN` in this environment.
  > The user (tan) performs the deploy; the agent only prepares the commit.
- HF Spaces rebuilds the Docker image automatically on push. A Space restart
  wipes ephemeral state (`/tmp/chroma_db`, `/tmp/uploads`).
- **Secrets live in HF Spaces → Settings → Secrets**, not in the repo.
  `.env` is gitignored and is only a local template; an empty key in `.env`
  does NOT mean the provider is disabled in production.

## 2. Architecture (single HF container)

```
HF Spaces Docker container (public port 7680)
├─ frontend   Next.js 14      :7680  ← public
├─ backend    NestJS          :3000  ← internal
├─ ai-service FastAPI          :8000  ← internal
├─ crawler    Python (cron)          ← daily
├─ SQLite     frontend/public/edumap.db
└─ ChromaDB   /tmp/chroma_db (ephemeral)
```

- Process manager: `supervisord.conf`.
- Build: multi-stage `Dockerfile`.
- PostgreSQL/Redis/MinIO/NGINX/OSRM are replaced by SQLite, in-process LRU
  cache, filesystem, Next.js BFF and public OSRM/ORS respectively.

### Unified Hub pattern (2026-10-27)

Multiple standalone pages that share a domain have been consolidated into
**hub pages with tab/tool navigation**:

- **`/map` (Map Hub)** — 10 tool tabs in a single sidebar panel:
  Data Hunter, Gap Predictor, Resource Optimizer, GeoVision AI, Survey Planner,
  Climate Guardian, AI Agent, Voice Search, Wifi, Green.
  - Old routes (`/map/data-hunter`, `/climate-guardian`, `/ai-agent`,
    `/voice-search`, `/wifi`, `/green`, `/talk2map`) now redirect to
    `/map?tool=<id>` (or `/map` for Talk2Map since search is built into the
    map page).
  - Tools use `next/dynamic({ ssr: false })` to avoid leaflet SSR crashes.
  - Registry: `components/map/tools/registry.tsx` (10 tools, `MAP_TOOLS` array).
  - Each tool module exports `XxxPanel` + `XxxOverlay` as named exports.

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
  OSM, priority colour labels, gold next pin, auth-gated); toolbar button on
  `app/map/page.tsx`; nav "Kế hoạch khảo sát" under "AI an toàn" in `Sidebar.tsx`.
- **Verify (DONE):** pytest 17/17; `py_compile` OK; backend `tsc` 0 errors;
  frontend `tsc` 0 errors. Full-stack curl: `GET /api/map/survey/priorities?...grid_size_km=0.7&top_n=3`
  -> 200 + ordered FeatureCollection (`priority_score = info_value / cost`,
  descending, real POIs `degraded=false`; empty DB `degraded=true`); cache miss ->
  `metadata.cached=null`, repeat -> `metadata.cached=true`.
  **Runtime truth = HF Spaces free tier** (`https://tancse2005-edumap.hf.space`).

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
  `ScheduleModule` is disabled in SQLite/HF mode. Env-tunable:
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
`Cloudflare Workers AI → Google Gemini` (with template fallback).

Embeddings (`ai-service/services/vector_store.py`):
`Cloudflare Workers AI → Google Gemini`.
(XKIRO, NVIDIA, Kimi, and HF Inference API have been removed as
text-generation and embedding providers. On HF Spaces, Cloudflare TLS is
blackholed so Gemini is the effective primary.)

GeoVision AI — satellite imagery facility detection (Idea #10):
`ai-service/routers/geo.py` POST `/api/ai/geo/vision-detect` →
`curl --ipv4 --insecure` → HF Inference Router
(`https://router.huggingface.co/models/{GEO_VISION_MODEL}`).

**GeoVision AI (Idea #10 — unlisted school/educational-facility detection):**

- `GEO_VISION_MODEL` (default `facebook/owlv2-base-c`): zero-shot object detection
  model on HF Inference API. NOT bundled in Docker — runs on HF's servers.
- Tile sources for the stitched image:
  - `osm` (default) — OSM standard tiles via `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
    (no key; shows building footprints useful for school detection).
  - `esri` — Esri World Imagery (aerial; no key, rate-limited).
  - `bing` — Bing Maps aerial tiles via quadkey URL (optional `BING_MAPS_API_KEY`).
- Tile grid is capped at **8×8 = 64 tiles** (max 2048×2048 px at z=18) to stay
  under HF's 5 MB inference input limit.
- Stitched tiles are cached 24 h in an in-memory LRU cache
  (`GeoVisionService.tileCache`) to protect against HF Inference quota limits.
- Detection boxes (pixel coords) are converted back to lat/lng via Web Mercator
  inverse, then cross-checked against existing `map_points` within the bbox.
  Detections within 80 m of a known POI are tagged `known`; others are `new`.
- RAG/vision failure degrades gracefully: returns `degraded: true` with empty
  detections — the frontend shows a warning, never a crash.
- `ai-service/start.sh` recovers `GEO_VISION_MODEL`, `GEO_VISION_TIMEOUT_SECONDS`,
  and `BING_MAPS_API_KEY` from PID 1 environ (HF Spaces secret propagation fix).

- **AI Climate Learning Guardian (Idea #11):** `ai-service/services/climate_guardian.py`
  (`ClimateGuardianService` singleton) + `ai-service/routers/climate.py`
  (`POST /api/ai/climate/risk`, `POST /api/ai/climate/alternatives`).
  - Risk model: `risk_score = 0.35·flood_risk + 0.35·weather_risk + 0.30·access_risk`
  - Flood zones: loaded from SQLite `flood_zones` table (seeded by
    `scripts/migrate_real_data.py` from `scripts/real_vn_data.py:FLOOD_ZONES`)
    with a static fallback (`STATIC_FLOOD_ZONES`) for empty-DB.
  - Weather: OpenWeatherMap (requires `OWM_API_KEY` HF Space secret) via
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
    (Cloudflare Workers AI → Google Gemini) with `temperature=0.3`,
    `max_tokens=2048`, `top_p=0.8`. Template-based fallback ensures the endpoint
    never 502s when all providers are down (HF Spaces free plan).
  - Difficulty levels: `elementary` (lớp 1-3), `middle` (THCS, default),
    `high` (THPT), `college` (đại học). LLM explains jargon per level.
  - Translation supports an optional **glossary** dict so domain terms are
    preserved (mitigates "context loss" risk).
  - TTS provider chain: Google Cloud TTS (via `curl --ipv4 --insecure`,
    needs `GOOGLE_TTS_API_KEY` HF secret) → `edge-tts` (keyless, good VN
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
    (no LLM needed, works on HF Spaces free plan). Three intents:
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
    Frontend page: `app/voice-search/page.tsx` (full-page voice search:
    record button → Web Speech API → Whisper fallback → nl-search → results
    overlay; report_form intent shows a pre-filled report form).
  - Voice buttons on `/map` (floating control panel) and `/ai-chat`
    (input area) — both use Web Speech API, fall back to Whisper, and
    route transcripts through the Talk2Map nl-search pipeline.
  - Nav entry: "Tìm bằng giọng nói" (Mic icon) under "Học tập" in `Sidebar.tsx`.
  - Smoke test: `scripts/smoke_test_voice_geo.sh` (STT degraded path + intent
    classification for geo_recommend / geo_query / report_form).
  - Tests: `tests/test_speech.py` (26 tests: SpeechService + intent + router).

Rules that must be preserved:

- Every embedding provider is called through `curl --ipv4 --insecure` because
  HF Spaces has an IPv6/TLS quirk.
- Per-provider circuit breakers (5 minutes) prevent re-burning timeouts.
- **Embedding budget** (seconds, env-tunable):
  - `EMBED_GLOBAL_TIMEOUT_SECONDS` (default 6) — whole chain.
  - `EMBED_PROVIDER_TIMEOUT_SECONDS` (default 4) — one attempt.
  - `RAG_TIMEOUT_SECONDS` (default 8) — `chat_with_rag*` hard limit.
  - Keep these below the NestJS stream timeout (10s). A slow provider must
    never starve the fallbacks or leave the chat bubble empty.
- Provider model slugs and circuit breakers:
  Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fp8`, etc.) and
  Google Gemini (`gemini-3.8-flash`, etc.) are the only two text-generation
  providers. Each has a 5-minute circuit breaker after auth (401/403) or
  network failure. `curl --ipv4 --insecure` is used for all API calls (HF
  Spaces IPv6/TLS quirk).
- RAG failure must degrade gracefully: answer LLM-only, never crash chat.

## 4. Useful local commands

```bash
# Python syntax check
python3 -m py_compile ai-service/services/vector_store.py

# AI service unit tests
cd ai-service && python3 -m pytest tests -q

# Backend tests / build
cd backend && npm test -- --runInBand
cd backend && npm run build

# Frontend typecheck/build
cd frontend && npx tsc --noEmit

# Deploy to HF (only after changes are committed)
HF_TOKEN=<token> ./deploy-hf.sh
```

## 5. Environment notes

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GEMINI_API_KEY`,
  `HF_TOKEN` (GeoVision vision detection only) are HF Secrets.
- `CLOUDFLARE_MODEL` — Cloudflare Workers AI text generation model cascade.
- `GEMINI_MODEL` — Google Gemini text generation model cascade.
- `HF_EMBEDDING_MODEL` removed — embeddings use Cloudflare → Gemini cascade.
- `CHROMA_DB_PATH=/tmp/chroma_db` (re-seeded at startup by `main.py`).
- `DB_TYPE=sqlite`, `DB_SQLITE_PATH=/app/frontend/public/edumap.db`.
- `OWM_API_KEY` — OpenWeatherMap API key (HF Space secret, optional). When set,
  the Climate Learning Guardian fetches real-time weather severity; when absent,
  it falls back to a static flood-hazard map built from real Vietnamese flood
  zone polygons (Đồng Nai, Cửu Long, Đà Nẵng, TPHCM) seeded via
  `scripts/migrate_real_data.py`.
- `GOOGLE_TTS_API_KEY` — Google Cloud TTS API key (HF Space secret, optional).
  When set, the Language Bridge uses Google Cloud TTS (best voice quality);
  when absent, it falls back to `edge-tts` (Microsoft Edge online, keyless)
  then `gTTS` (Google Translate TTS, keyless), then degrades to text-only
  (browser Web Speech API). The Language Bridge LLM endpoints (simplify,
  translate) do NOT require this key — they use the same `_generate_text_with_fallback`
  cascade as all other AI features.

## 6. Data policy (verified Vietnamese content only)

Users verified the live HF Space and reported the seeded feature data as
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
- **Honest empty states beat fake rows.** `posts`, `shared_items`, `surveys`,
  `mentors`, `green_activities`, `summer_activities` are intentionally empty;
  the UI shows an empty state instead of invented people/listings.
- **Provenance is user-visible:** every description ends with
  `Nguồn chính thức: <url> · Kiểm chứng: <date>`, and scholarship pages render
  an “Nguồn chính thức ↗” link from `apply_url`.
- `@edumap.vn` accounts (96) are **demo login accounts**, not feature content.
  Keep `admin@edumap.vn` — it is the admin login on HF.

## 7. Current known limitations on HF (free plan)

- **Free-tier reality:** 2 vCPU, no GPU, ephemeral disk, ~48 h sleep timer.
  The first request after a restart can take 30–60 s (container + Next.js +
  NestJS + FastAPI + Chroma bootstrap). A one-off 503 is a cold start; only a
  repeated failure is a bug.
- AI chat history and uploads are ephemeral (`/tmp`).
- Geo/PostGIS analytics is limited in SQLite mode — there is no `ST_DWithin`,
  `ST_MakePoint` or `::geography`. Query builders MUST branch on
  `isPostgresNow()` and compute distances in JS (see
  `WifiService.getWifiPointsNearby`) instead of shipping PostGIS SQL to SQLite.
- **`DB_SYNC` must stay `false`** on HF (set in the Dockerfile). The shipped
  `edumap.db` predates parts of the entity set, so `synchronize: true` dies on
  NOT NULL drift (e.g. `temporary_locations.category_id`,
  `temporary_green_challenges.created_by`). Schema changes ship as explicit
  migrations / `ensureSqliteSchema()`, never via `synchronize`.
- **ChromaDB is re-created on every Space restart.** Startup seeding runs in a
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
- **One page frame.** Use `.page-shell` (or `.page-shell-narrow`) from
  `app/globals.css`; it sets `max-w-6xl`, `px-4 py-6 sm:px-6 sm:py-8` and
  `space-y-6`. Pages that must stay full-width use
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

- **Map Hub floating panels (2026-10-28):**
  - Trang `/map` (Map Hub) hiện có 2 panel trôi nổi (floating):
    - **Bảng bản đồ** (trái): `fixed`, kéo tự do qua `useDraggable` (chỉ kéo ở header), có nút Ẩn/Hiện ("Mở bảng bản đồ"). `onMouseDown` chỉ gắn vào header để cuộn chuột trong nội dung không bị chặn.
    - **Bảng chỉ đường** (phải, `RoutingPanel`): xuất hiện **sổ xuống từ nút "Chỉ đường" floating** (góc trên phải), `fixed` tại `top-[56px] right-4`, không kéo tự do nữa. `max-h-[calc(100dvh-120px)]` + `overflow-y-auto scrollbar-hide` để nội dung không bị rớt/cắt. `width: 340px` co dãn với màn hình.
  - Bản đồ chiếm toàn bộ diện tích (`absolute inset-0`) phía sau các panel, vẫn có thể pan/zoom bình thường khi panel chỉ đường mở (không bị khóa).
  - Nút zoom `+`/`-` trên bản đồ đã ẩn (`zoomControl={false}`); người dùng cuộn chuột để zoom.
  - Popup khi bấm ghim/pin được rộng ra 3× (`max-w-[240px]` → `max-w-[720px]`).
  - `useDraggable` không bắt đầu kéo khi nhấn vào `input`/`textarea`/`select` → nhập liệu và cuộn chuột trong panel hoạt động bình thường.
  - Bảng chỉ đường có nút **"Chọn bản đồ"** bên cạnh mỗi ô tọa độ (điểm xuất phát / điểm đến). Nhấn nút rồi click vào bản đồ sẽ chọn vị trí đó làm điểm tương ứng.
  - Các label icon+checkbox dùng `whitespace-nowrap` để không rớt dòng.
  - Layout dùng `flex-1` + `overflow-y-auto` để không bị rớt nội dung khi panel hẹp.
  - Hook dùng chung: `frontend/src/hooks/useDraggable.ts`.
