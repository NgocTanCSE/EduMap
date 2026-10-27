# Implementation Plan: Idea #13 — AI Learning Space Recommender

## Deployment model (remembered)

> **Production runs ONLY on Hugging Face Spaces (Docker, free plan).**
> Local (`/home/ngoctan/Downloads/EduMap`) is for code editing, unit tests, and
> inspection only. Runtime is on HF Spaces:
> `https://tancse2005-edumap.hf.space`

This shapes every decision below:
- SQLite is the runtime DB (`DB_TYPE=sqlite`, `DB_SYNC=false`). The shipped DB
  lives at `frontend/public/edumap.db` and is **not** auto-created by TypeORM.
- `backend/src/database/sqlite-bootstrap.ts` is the schema self-healer that runs
  at boot — any new column added to an entity **must** be back-ported here so it
  exists in the shipped SQLite file on HF.
- `scripts/real_vn_data.py` is the single source of truth for real Vietnamese
  content. Seeded into the shipped DB via `scripts/migrate_real_data.py`.
- No fake data. Honest empty states when no real rows exist.

## Overview

Build an AI-powered Learning Space Recommender that ranks study spots (cafés,
libraries, study rooms) by distance, opening hours, Wi-Fi, quietness, and
rating — then explains *why* each spot was recommended via the AI service
(FastAPI), with a 24-hour response cache and graceful fallbacks.

**Existing foundation:** The `learning_spots` table already exists in
`schema.sql`, the TypeORM `LearningSpot` entity, and the
`LearningCommunityModule` (/learning-spots with `nearby`, `availability`,
`create`). The table is currently empty and lacks `opening_hours`,
`quietness`, `amenities`, `address`, `description`. This plan extends it.

**Architecture (full stack):**

```
Frontend (Next.js 14)
  app/learning-spaces/page.tsx   ← T3: filter panel + map + explain
  app/api/learning-spaces/*/route.ts  ← BFF proxies to backend
  src/services/learning-space.service.ts

  ↓ BFF → NestJS backend (:3000)

  backend/src/modules/learning-community/
    learning-space-recommender.service.ts  ← T1: scoring + orchestrate explain
    learning-community.controller.ts        ← GET /learning-spots/recommend
    entities/learning-spot.entity.ts       ← extended columns

  ↓ HTTP → ai-service FastAPI (:8000)

  ai-service/routers/learning_space.py  ← T2: POST /api/ai/learning-space/explain
  ai-service/services/llm_service.py    ← explain_learning_space_recommendation()
```

## Architecture Decisions

- **Reuse, don't duplicate:** Add `LearningSpaceRecommenderService` inside the
  existing `learning-community` module (it already owns the `LearningSpot`
  entity) rather than creating a parallel module. This follows the project's
  vertical-slice + scope-discipline conventions.
- **Backend orchestrates explain:** The backend recommend endpoint calls the
  AI service explain endpoint internally (graceful degradation: if the AI
  service is down, return ranked spots without explanations, never crash).
- **Normalized scoring:** Every criterion normalized to [0,1] before weighting,
  so distance bias can't dominate (mitigates the "scoring bias" risk).
- **24h cache for LLM explain:** Use the existing `cache_service` (Redis with
  graceful fallback) keyed by a hash of spot+preferences; falls back to static
  template explanations if cache/store unavailable.
- **Real data only:** Extend `scripts/real_vn_data.py` with verified
  Vietnamese study spaces (university libraries, public libraries) and seed
  via `migrate_real_data.py`.

## Task List

### Phase 0: Schema & Data Foundation

#### Task 1: Extend `learning_spots` schema, entity, and SQLite bootstrap
**Description:** Add `opening_hours`, `quietness`, `amenities`, `address`,
`description`, `last_updated` columns to the `learning_spots` table so the
recommender has the data it needs (hours, noise level, facilities).

**Acceptance criteria:**
- [ ] `schema.sql` — ALTER/TABLE adds the columns (or new CREATE TABLE)
- [ ] `learning-spot.entity.ts` — entity declares the new columns with
      appropriate types (TEXT for hours/addr/desc, INTEGER for quietness,
      JSON for amenities)
- [ ] `sqlite-bootstrap.ts` — ensures the columns exist in the shipped SQLite
      DB on boot (idempotent `ALTER TABLE ... ADD COLUMN`)
- [ ] `tsc` passes with the entity changes

**Verification:**
- [ ] `cd backend && npx tsc --noEmit`
- [ ] SQLite DB has the new columns after bootstrap

**Dependencies:** None
**Files touched:**
- `backend/src/modules/learning-community/entities/learning-spot.entity.ts`
- `backend/src/database/schema.sql`
- `backend/src/database/sqlite-bootstrap.ts`

#### Task 2: Seed real Vietnamese learning spaces
**Description:** Add verified Vietnamese study spaces to
`scripts/real_vn_data.py` and wire them into `migrate_real_data.py`.

**Acceptance criteria:**
- [ ] `LEARNING_SPOTS` list added to `real_vn_data.py` with real places:
      National Library of Vietnam, HCMUT Library, VNU Library, UEH Library,
      Thư viện Bộ Sư Thầy — each with official URL + `Kiểm chứng` date
- [ ] `migrate_real_data.py` seeds `learning_spots` table (idempotent)
- [ ] No fabricated/fake rows (`EduMap Foundation`, etc. excluded)

**Verification:**
- [ ] `python3 scripts/migrate_real_data.py` runs without error
- [ ] `learning_spots` has real rows in the test DB

**Dependencies:** Task 1
**Files touched:**
- `scripts/real_vn_data.py`
- `scripts/migrate_real_data.py`

### Phase 1: Backend Scoring (T1)

#### Task 3: `LearningSpaceRecommenderService` — scoring algorithm
**Description:** New service inside `learning-community` module that queries
`learning_spots`, applies a normalized weighted scoring algorithm, and
optionally fetches LLM explanations from the AI service.

**Acceptance criteria:**
- [ ] `scoringWeights` configurable (distance, rating, wifi, quietness,
      open_now, capacity) — defaults sum to 1.0
- [ ] Every criterion normalized to [0, 1] (distance = 1 − dist/radius)
- [ ] `recommend()` returns: ranked list with `score`, `distance_km`,
      `open_now`, `quietness`, `matching_criteria` breakdown
- [ ] Calls AI service explain endpoint (graceful: falls back to static
      template if AI service unreachable)
- [ ] Respects `EMBED_GLOBAL_TIMEOUT_SECONDS` spirit — fast, ≤ 100ms for
      20 spots without LLM

**Verification:**
- [ ] Unit tests pass (`backend/src/modules/learning-community/learning-space-recommender.service.spec.ts`)
- [ ] Scoring is deterministic for same input

**Dependencies:** Task 1, Task 2
**Files touched:**
- `backend/src/modules/learning-community/learning-space-recommender.service.ts`
- `backend/src/modules/learning-community/learning-community.module.ts` (register service + AI HttpService)

#### Task 4: Backend `/learning-spots/recommend` endpoint + tests
**Description:** Add a `GET /learning-spots/recommend` endpoint to the
existing `LearningCommunityController` with query params for filtering.

**Acceptance criteria:**
- [ ] Params: `lat`, `lng`, `radius` (default 5 km), `has_wifi`,
      `min_rating`, `min_capacity`, `quietness_min`, `open_now`,
      `limit` (default 20), `w_*` weight overrides
- [ ] Returns ranked list + GeoJSON + `degraded`/`reason` flags when AI
      explain is unavailable
- [ ] Input validation via DTO + class-validator
- [ ] 24h explain cache honored

**Verification:**
- [ ] e2e test: `GET /api/learning-spots/recommend?lat=...&lng=...` returns 200 + ranked array
- [ ] `GET /api/learning-spots/recommend` without coords returns 400

**Dependencies:** Task 3
**Files touched:**
- `backend/src/modules/learning-community/learning-community.controller.ts`
- `backend/src/modules/learning-community/dto/recommend-spots.dto.ts`

### Phase 2: AI Explain Endpoint (T2)

#### Task 5: `llm_service.explain_learning_space_recommendation()`
**Description:** Add a method to `LLMService` that takes a spot + user
preferences and returns a human-readable explanation of why it was
recommended.

**Acceptance criteria:**
- [ ] Method signature: `explain_learning_space_recommendation(spot: dict,
      preferences: dict) -> dict`
- [ ] Uses `_generate_text_with_fallback()` (provider chain: OpenRouter →
      NVIDIA → Cloudflare → HF) with a concise prompt
- [ ] `_explain_learning_space_fallback()` returns a static template
      explanation when AI provider unavailable
- [ ] Returns `{"explanation": str, "degraded": bool, "reason": str}`

**Verification:**
- [ ] `py_compile` passes
- [ ] Fallback returns a non-empty explanation

**Dependencies:** Task 3 (input shape defined)
**Files touched:**
- `ai-service/services/llm_service.py`

#### Task 6: AI router `learning_space.py` + registration + tests
**Description:** New FastAPI router with the explain endpoint, 24h cache,
registered in `main.py`.

**Acceptance criteria:**
- [ ] `ai-service/routers/learning_space.py`:
      `POST /api/ai/learning-space/explain`
- [ ] Request model: `spot` (dict), `preferences` (dict)
- [ ] 24h TTL cache (86400s) keyed by `hash(spot_id + prefs_json)`
- [ ] Degraded flag passed through from `llm_service`
- [ ] Registered in `main.py` router list
- [ ] Tests: degraded path, fallback, valid input → 200

**Verification:**
- [ ] `cd ai-service && python3 -m pytest tests/test_learning_space_explain.py -q`
- [ ] `python3 -m py_compile ai-service/routers/learning_space.py`

**Dependencies:** Task 5
**Files touched:**
- `ai-service/routers/learning_space.py`
- `ai-service/main.py`
- `ai-service/tests/test_learning_space_explain.py`

### Phase 3: Frontend (T3)

#### Task 7: Frontend service + BFF routes
**Description:** Frontend service + BFF route handlers for the recommend
and explain endpoints.

**Acceptance criteria:**
- [ ] `frontend/src/services/learning-space.service.ts`:
      `recommendSpots(opts)`, `explainSpot(spot, prefs)`, typed interfaces
- [ ] `frontend/app/api/learning-spaces/recommend/route.ts` — BFF proxy
      to backend `/api/learning-spots/recommend`
- [ ] `frontend/app/api/learning-spaces/explain/route.ts` — BFF proxy to
      backend (which calls AI service)
- [ ] Uses `getBackendUrl()`, `unwrapApiResponse()`, `fetchWithRetry()`,
      `authService.getAccessToken()` per existing conventions

**Verification:**
- [ ] `npx tsc --noEmit` passes

**Dependencies:** Task 4, Task 6
**Files touched:**
- `frontend/src/services/learning-space.service.ts`
- `frontend/app/api/learning-spaces/recommend/route.ts`
- `frontend/app/api/learning-spaces/explain/route.ts`

#### Task 8: `app/learning-spaces/page.tsx` — filter panel + map
**Description:** The user-facing page with a filter panel (distance,
opening hours, Wi-Fi, quietness, rating, capacity) and a results map + list
using Leaflet `MapComponent`.

**Acceptance criteria:**
- [ ] Filter panel with sliders/inputs for all criteria
- [ ] Results rendered as: list cards (with score, explain badge) + map pins
- [ ] Geolocation button → fetch nearby spots
- [ ] Each card shows an "Explain" that calls the explain endpoint
- [ ] Loading + empty states (no fake results)
- [ ] Responsive layout

**Verification:**
- [ ] `npx tsc --noEmit` passes
- [ ] Manual smoke: page loads, filters adjust, map renders

**Dependencies:** Task 7
**Files touched:**
- `frontend/app/learning-spaces/page.tsx`

### Phase 4: Tests + Smoke Test (T4)

#### Task 9: Backend + AI test suite
**Description:** Comprehensive tests for scoring + explain endpoints.

**Acceptance criteria:**
- [ ] Scoring spec: normalize correctness, weight sensitivity, distance
      bias guard, empty input, filter application
- [ ] AI explain spec: valid input → 200 + explanation; degraded flag
      when providers unavailable; cache hit behavior
- [ ] No existing test regressions

**Verification:**
- [ ] `cd ai-service && python3 -m pytest tests -q`
- [ ] `cd backend && npm test -- --runInBand`

**Dependencies:** Task 3, Task 6
**Files touched:**
- `backend/src/modules/learning-community/learning-space-recommender.service.spec.ts`
- `ai-service/tests/test_learning_space_explain.py`

#### Task 10: Smoke test #18
**Description:** Smoke test script that exercises the full request path
on the deployed HF Space.

**Acceptance criteria:**
- [ ] `scripts/smoke_test_learning_space.sh` (smoke test #18)
- [ ] Tests: GET /api/learning-spots/recommend (200 + ranked), explain
      endpoint (200 + explanation), map page render
- [ ] Exit 0 on all pass, 1 on any fail
- [ ] Targets `https://tancse2005-edumap.hf.space` by default

**Verification:**
- [ ] Script is syntactically valid (`bash -n`)
- [ ] Run against local dev or HF Space

**Dependencies:** Task 4, Task 6, Task 8
**Files touched:**
- `scripts/smoke_test_learning_space.sh`

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scoring bias (distance always dominates) | Low diversity | Normalize to [0,1] per criterion; configurable weights |
| LLM explain slow (5-10s) | Latency | 24h cache; static template fallback; ≤8s RAG timeout |
| AI service down on HF | No explain | Graceful degradation: return scores only, `degraded: true` |
| SQLite schema drift (columns missing in shipped DB) | Crash | `sqlite-bootstrap.ts` self-heals; entity + bootstrap updated together |
| No real learning-spot data | Fake rows temptation | `real_vn_data.py` curated list; honest empty state if 0 rows |
| IPv6 blackhole on HF outbound to AI providers | Timeouts | `vector_store.py`/`llm_service.py` already `curl --ipv4 --insecure`; circuit breakers 5 min |

## Verification (overall Definition of Done)

- [ ] `cd backend && npx tsc --noEmit` — clean
- [ ] `cd backend && npm test -- --runInBand` — all pass
- [ ] `cd ai-service && python3 -m pytest tests -q` — all pass
- [ ] `python3 -m py_compile ai-service/routers/learning_space.py ai-service/services/llm_service.py`
- [ ] `npx tsc --noEmit` (frontend) — clean
- [ ] `scripts/migrate_real_data.py` seeds `learning_spots` with real rows
- [ ] `bash -n scripts/smoke_test_learning_space.sh` — valid
- [ ] Deploy-ready: all changes committed to `main`, `HF_TOKEN ./deploy-hf.sh`
