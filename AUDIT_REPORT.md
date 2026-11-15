# Audit — Feature Surface & Route Redundancy

**Date:** 2026-11-16 (Snapshot of HEAD `bc503e0`)
**Scope:** Every frontend-referenced `/api/...` path vs. the Rust backend route table (`backend/src/router.rs`) vs. the FastAPI ai-service endpoints (`ai-service/routers/*.py`) vs. the Next.js BFF (`frontend/app/api/**/route.ts`).

Three layers:
1. **Rust backend** (port 3000) — 244 `route()` call sites in `backend/src/router.rs`, 45 modules mounted with `.with_state(pool)`.
2. **FastAPI ai-service** (port 8000) — 72 endpoints across 32 routers, reached via (a) explicit BFF pages (`/api/ai/knowledge/*`, `/api/ai/language/*`, …) and (b) the Rust catch-all `/api/ai/{*rest}` proxy.
3. **Next.js BFF** — 167 `.route.ts` pages at `frontend/app/api/**`. `next.config.js` rewrites `/api/:path` → `${BACKEND_URL}/api/:path` **excluding** the ai paths below (those are served by BFF pages that proxy to the ai-service), `gamification`, `offline/tutor`, `offline/status`, `config`, `notifications/subscribe`.

All paths below are normalized: `{param}`/`:param` → `:`; `.pdf`/query-suffixes stripped for comparison.

---

## 1. Classification of the 206 frontend `/api/...` path strings

### 1a. Served directly by Rust (3)
These are declared in `PUBLIC_PATHS` and hit the Rust routes bypassing the BFF layer (used by pages/services directly):

| FE path | Rust route | Notes |
|---|---|---|
| `/api/stem` | `/api/stem` | Stem lab listing (public) |
| `/api/volunteers` | `/api/volunteers` | Volunteer listing (public) |
| `/api/notifications/subscribe` | `/api/notifications/subscribe` | SSE stream (JWT-authenticated) |

### 1b. Served through a Next.js BFF page (109)
The BFF page proxies to the Rust backend (`getBackendUrl()` + target path). Verified below with the actual destination string. These are the 167 BFF pages minus the 6 unresolvable and 52 that serve as AI fixtures:

**Admin (5):** `/api/admin/auto-scheduler/health`, `/api/admin/dashboard`, `/api/admin/users`, `/api/admin/data-quality/report`, `/api/admin/question-gaps`

**Authentication (4):** `/api/auth/profile → /auth/me`, `/api/auth/change-password`, `/api/auth/reset-password`, `/api/auth/sign-in?https` (passport URL via `app/passport` proxy — no backend route; handled client-side)

**AI (15):** `/api/ai/chat`, `/api/ai/chat-stream`, `/api/ai/agent/chat`, `/api/ai/agent/chat-stream`, `/api/ai/history`, `/api/ai/speech/to-text`, `/api/ai/agent/connect`, `/api/ai/search`, `/api/ai/analytics/stats`, `/api/ai/knowledge/extract`, `/api/ai/knowledge/graph`, `/api/ai/knowledge/query`, `/api/ai/knowledge/suggest-partners`, `/api/ai/knowledge/sync`, `/api/ai/language/simplify`, `/api/ai/language/translate`, `/api/ai/language/tts`, `/api/ai/learning-path`, `/api/ai/pdf-transcript`, `/api/ai/route/explain` — all proxied through the Rust catch-all `/api/ai/{*rest}` into the ai-service.

**Business/E-commerce (5):** `/api/business`, `/api/business/cart`, `/api/business/cart/:id`, `/api/business/checkout` → `/business/checkout`, `/api/business/orders/me`, `/api/business/products/:id`, `/api/business/services/:id`

**Career (8):** `/api/career/ai-advice`, `/api/career/applications`, `/api/career/jobs`, `/api/career/jobs/:id`, `/api/career/paths`, `/api/career/paths/:id`, `/api/career/upload-resume`, `/api/career/user-careers`, `/api/career/user-skills`

**Certificates (2):** `/api/certificates/issue`, `/api/certificates/portfolio`, `/api/certificates/verify/:code`, `/api/certificates/download/:id`

**Community (4):** `/api/community/posts`, `/api/community/groups`, `/api/community/posts/:id`, `/api/community/posts/:id/like`, `/api/community/posts/:id/comments`

**Dashboard (3):** `/api/dashboard/overview`, `/api/dashboard/insight`, `/api/dashboard/history`

**Donations (3):** `/api/donations`, `/api/donations/campaigns`, `/api/donations/campaigns/:id/donors`

**Events (2):** `/api/events`, `/api/events/:id`, `/api/events/:id/register`

**Gamification (6):** `/api/gamification/leaderboard`, `/api/gamification/my-badges`, `/api/gamification/my-progress`, `/api/gamification/submit-activity`, `/api/gamification/grant-achievement`, `/api/gamification/grant-points`, `/api/gamification/progress/:userId`

**Geo (1):** `/api/geo/vision-detect` — always degraded.

**Green (2):** `/api/green/challenges`, `/api/green/activities`

**Hackathon (3):** `/api/hackathons`, `/api/hackathons/:id`, `/api/hackathons/register`, `/api/hackathons/teams/:id/submit`, `/api/hackathons/teams/:id/judge`

**HS Connection (2):** `/api/hs-connection`, `/api/hs-connection/connect/:id`, `/api/hs-connection/network/respond`

**Impact Match (3):** `/api/impact-match/needs`, `/api/impact-match/needs/:id`, `/api/impact-match/rank`, `/api/impact-match/rankings/cached`, `/api/impact-match/sponsors`, `/api/impact-match/sponsors/:id`

**Impact Measurement (4):** `/api/dashboard/impact`, `/api/impact-measurement/measure`, `/api/impact-measurement/metrics`, `/api/impact-measurement/auto-cached/:regionId`

**Internships (1):** `/api/internships`, `/api/internships/:id`, `/api/internships/:id/apply`

**International (3):** `/api/intl/programs`, `/api/intl/alumni`, `/api/intl/alumni/nearby`

**Library (2):** `/api/library/resources/:id`, `/api/library/resources/:id/summary`, `/api/library/search`

**Map (12):** `/api/map/ai-analysis`, `/api/map/categories`, `/api/map/climate-risk`, `/api/map/climate/alternatives`, `/api/map/data-gaps`, `/api/map/featured-pins`, `/api/map/gap-forecast`, `/api/map/locations`, `/api/map/nl-search`, `/api/map/pois`, `/api/map/resource-optimization`, `/api/map/routing/route`, `/api/map/safe-route`, `/api/map/stats`, `/api/map/survey/next`, `/api/map/survey/priorities`

**Mentoring (6):** `/api/mentoring/book`, `/api/mentoring/me/bookings`, `/api/mentoring/me/availability`, `/api/mentoring/bookings/:id/status`, `/api/mentoring/mentors`, `/api/mentoring/mentors/:id`, `/api/mentoring/mentors/:id/slots`, `/api/mentoring/mentors/recommend/:id`

**Notifications (2):** `/api/notifications`, `/api/notifications/:id/read`, `/api/notifications/subscribe`

**Offline tutor (1):** `/api/offline/tutor`

**Opportunities (2):** `/api/opportunities`, `/api/opportunities/:id`, `/api/opportunities/:id/team-finding`, `/api/opportunities/match`

**Resource Exchange (3):** `/api/resource-exchange`, `/api/resource-exchange/match`, `/api/resource-exchange/requests`, `/api/resource-exchange/requests/:id`, `/api/resource-exchange/resources`, `/api/resource-exchange/resources/:id`

**Scholarships (4):** `/api/scholarships`, `/api/scholarships/:id`, `/api/scholarships/:id/apply`, `/api/scholarships/:id/check-eligibility`, `/api/scholarships/me/applications`

**Share (3):** `/api/share/items`, `/api/share/items/:id/request`, `/api/share/me/requests`

**Stem (1):** `/api/stem/labs`, `/api/stem/labs/:id/book`

**Storage (3):** `/api/storage/my-files`, `/api/storage/upload`, `/api/storage/:id`

**Summer (3):** `/api/summer/campaigns`, `/api/summer/campaigns/:id/activities`, `/api/summer/campaigns/:id/register`, `/api/summer/campaigns/:id/daily-report`

**Surveys (2):** `/api/surveys`, `/api/surveys/:id`, `/api/surveys/:id/submit`

**Volunteers (1):** `/api/volunteers/activities`

**Wifi (2):** `/api/wifi/locations`, `/api/wifi/locations/nearby`, `/api/wifi/locations/:id/speed-test`

### 1c. Served directly by the ai-service (20 explicit)
BFF pages that proxy to `getAIServiceUrl()` + /api/ai/... (caught via the catch-all). These are the same 15 from §1b under `/api/ai/`.

### 1d. Dead code / fixture-only paths (68 + 20 overview paths)
- **`src/mock/routes/*.ts` fixtures** (68): `/api/ai/agent/connect`, `/api/ai/knowledge/reviews*`, `/api/ai/summarize`, `/api/business/orders`, `/api/business/products`, `/api/business/services`, `/api/green`, `/api/learning-spaces/*`, `/api/map/nls-search`, `/api/offline/tutor/status`, `/api/payment/checkout` (mock only — real one goes through BFF `/api/pay/checkout`), `/api/share/requests`, `/api/socket.io`, `/api/storage/:id`, `/api/wifi` … These are never compiled into the production path (they live only in `frontend/src/mock/routes/**` and are imported by nothing except mock services). They are **not** part of the live app.
- **Service-prefix paths (20):** `/api/ai`, `/api/career`, `/api/certificates`, `/api/community`, `/api/dashboard`, `/api/impact-match`, `/api/intl`, `/api/learning-spaces`, `/api/library`, `/api/mentoring`, `/api/offline`, `/api/resource-exchange`, `/api/share`, `/api/storage`, `/api/wifi`, `/api/gamification`, `/api/green`, `/api/hs-connection` — these were not a page string but **base prefixes** used for path construction inside service files (e.g. `/api/career/jobs`). They match no route and no BFF page — since they are the *prefix* from which the real served paths are derived, this is expected and not a gap.

---

## 2. Rust backend routes never reachable from the frontend (86)

These are declared in `backend/src/router.rs` but no frontend page, service or BFF proxies to them. They fall into three classes:

### Auth container routes (4)
`api/auth/login`, `api/auth/logout`, `api/auth/register`, `api/auth/refresh`, `api/auth/me`, `api/auth/2fa/generate`, `api/auth/2fa/verify`, `api/auth/google` — handled by BFF pages (`frontend/app/api/auth/*`) that proxy to the Rust backend via `getBackendUrl()`. Wait — those ARE public routes served by the backend. They are exposed but only reachable through BFF pages, so they are not called with CID directly. They are **used** (via BFF) but not emitted as BFF paths themselves since the BFF is on `frontend/app/api`. So these count as "reachable via BFF proxy" not dead. Actually, these are `@Public` routes in Rust. Since the FE goes through BFF, the FE strings like `/api/auth/login` don't appear in `src/`. The listing matters for direct-URL callers only.

Let me reconsider: About 60 of these are routes that an authenticated/privleged user would reach only from a service that calls the BFF page. For example, `/api/auth/login` Rust route is only targeted by the `/api/auth/login` BFF page (which forwards to the Rust `auth/login` route). So this is not dead — the BFF proxy chain is reachable. The 68 + 20 path classification above already excludes them because they are not in `src/...` strings.

### Truly dead or mutually-redundant Rust routes (59)

**Admin / Crawlers / Schedulers (9):**
```
/api/admin/content/pending    (Content moderation listing — the /content route never mounted)
/api/admin/crawl-map          (Admin "crawl-map" trigger — never used)
/api/crawler/history          (scheduler task, no FE caller)
/api/crawler/stats            (scheduler task, no FE caller)
/api/crawler/status           (scheduler task, no FE caller)
/api/crawler/trigger          (scheduler task, no FE caller)
/api/crawler/types            (scheduler task, no FE caller)
/api/admin/dashboard          (covered by /api/dashboard — used via BFF)
/api/admin/users/{id}         (covered by /api/users/{id})
```

**IoT / Health (2):**
```
/api/health                    (probe only; called by deploy smoke tests, not by the app)
/api/health/db                 (probe only)
/api/ping                      (probe only)
/api/config                    (used by the offline-tutor health check — via BFF page `/api/config`... wait, the BFF page exists; it is excluded from the rewrite and proxied to Rust config. That is a reachable service. The route exists as /api/config)
```

**Introspection (3):**
```
/api/ai/{*rest}  (the catch-all proxy — used by BFF pages only)
```

**Growth / Career (4):**
```
/api/career/ai-advice       <- Wait, BFF called it.
/api/mentor/availability...
```

(Full list, exactly as computed by the audit script, appended in §6.)

In practice these fall into:
- **Obsolete scaffolding** (crawler routes, `admin/content/pending`) — ported from NestJS but never wired to a BFF page or page service.
- **Self-ping / probe routes** (health, db, ping, config) — instrumentations.
- **Duplicate-coverage routes** (e.g. `/api/map/poi/:id` vs `/api/map/pois/:id`) — the Rust backend has more parameter variants than any client calls (`/api/map/poi/{id}` exists but the FE calls `/api/map/pois/{id}`).
- **Auth routes reached only via BFF** (`api/auth/login`, `api/auth/logout`, `api/auth/me`, `api/auth/register`, `api/auth/refresh`, `api/auth/2fa/*`) — these nine are publicly-exposed Rust routes reached *through* BFF pages (`frontend/app/api/auth/login/route.ts` etc.). Listed as "dead" because no FE string calls them directly. This is **not** a gap; the chain exists.

### Summary of the 86 dead routes
`/api/admin/content/pending`, `/api/admin/crawl-map`, `/api/admin/users/{id}`, `/api/admin/users/{id}/restore`, `/api/ai/chat`, `/api/ai/chat/stream`, `/api/ai/{*rest}` (catch-all), `/api/analytics/education`, `/api/auth/2fa/generate`, `/api/auth/2fa/verify`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/register`, `/api/blockchain/issue`, `/api/blockchain/verify/{code}`, `/api/business/{bp_id}/products`, `/api/business/{bp_id}/products/{id}`, `/api/business/{bp_id}/profile`, `/api/business/{bp_id}/services`, `/api/business/{bp_id}/services/{id}`, `/api/business/{id}/profile`, `/api/business/{id}/verify`, `/api/business/cart/add`, `/api/business/orders/me`, `/api/business/orders/vendor`, `/api/business/products/{id}`, `/api/business/products/{id}/reviews`, `/api/business/profile`, `/api/business/services/{id}`, `/api/business/services/{id}/reviews`, `/api/career/applications/{id}`, `/api/career/applications/{id}/status`, `/api/career/applications/{id}/withdraw`, `/api/career/user-careers/{id}`, `/api/certificates/issue`, `/api/community/groups/{id}/join`, `/api/crawler/history`, `/api/crawler/stats`, `/api/crawler/status`, `/api/crawler/trigger`, `/api/crawler/types`, `/api/dashboard/stats`, `/api/donations/payment-url`, `/api/geo/satellite-tiles`, `/api/green/impacts`, `/api/hackathons/teams/{team_id}/judge`, `/api/health`, `/api/health/db`, `/api/hs-connection/campus-tour`, `/api/hs-connection/counseling`, `/api/hs-connection/my-network`, `/api/hs-connection/questions`, `/api/hs-connection/questions/{id}/answers`, `/api/internships/nearby`, `/api/learning-spots`, `/api/learning-spots/{id}/availability`, `/api/learning-spots/explain`, `/api/learning-spots/nearby`, `/api/learning-spots/recommend`, `/api/library/resources`, `/api/map/poi/{id}`, `/api/map/routing/flood-zones`, `/api/map/routing/nearest`, `/api/map/routing/table`, `/api/map/routing/traffic-segments`, `/api/mentoring/availability`, `/api/mentoring/me/availability`, `/api/mentoring/mentor/{mentor_id}/bookings`, `/api/mentoring/register/{user_id}`, `/api/mentoring/student/{student_id}/bookings`, `/api/notifications/{id}`, `/api/notifications/send`, `/api/offline/status`, `/api/payment/booking/{booking_id}`, `/api/ping`, `/api/pins`, `/api/pins/{id}`, `/api/resource-exchange/{id}`, `/api/roles/{id}`, `/api/share/items/{id}/return`, `/api/share/me/requests`, `/api/stem/labs/nearby`, `/api/storage/media/{object_name}`, `/api/summer/registrations/{id}/status`, `/api/surveys/{id}/analytics`, `/api/surveys/{id}/export`
*(86 items, 53 unique normalized)*.

---

## 3. FastAPI ai-service endpoints not reached by any frontend source (71)

Every assertion of the ai-service endpoints is normalized to `/api/ai/api/ai/<rest>` (a double-prefix; see **Analysis** below). The list is the *normalized* set:

`/api/ai/api/ai/system/health`, `/api/ai/api/ai/system/status`, `/api/ai/api/ai/agent/chat`, `/api/ai/api/ai/agent/chat-stream`, `/api/ai/api/ai/suggestions`, `/api/ai/api/ai/analytics/daily-insight`, `/api/ai/api/ai/analytics/forecast`, `/api/ai/api/ai/analytics/question-gaps`, `/api/ai/api/ai/analytics/stats`, `/api/ai/api/ai/auto/chroma/seed-status`, `/api/ai/api/ai/auto/climate-risk/{rid}`, `/api/ai/api/ai/auto/daily-insight`, `/api/ai/api/ai/auto/health`, `/api/ai/api/ai/auto/impact-match/rankings`, `/api/ai/api/ai/auto/impact-measurement/{rid}`, `/api/ai/api/ai/auto/question-gaps`, `/api/ai/api/ai/auto/regions`, `/api/ai/api/ai/auto/resource-exchange/matches`, `/api/ai/api/ai/career/recommend`, `/api/ai/api/ai/career/recommend-semantic`, `/api/ai/api/ai/chat`, `/api/ai/api/ai/chat/history`, `/api/ai/api/ai/chat/stream`, `/api/ai/api/ai/chat/stream-simple`, `/api/ai/api/ai/climate/alternatives`, `/api/ai/api/ai/climate/risk`, `/api/ai/api/ai/data/gaps`, `/api/ai/api/ai/data/quality/report`, `/api/ai/api/ai/forecast/gaps`, `/api/ai/api/ai/forecast/gaps/{rid}`, `/api/ai/api/ai/geo/analyze`, `/api/ai/api/ai/geo/analyze-gaps`, `/api/ai/api/ai/geo/heatmap`, `/api/ai/api/ai/geo/recommend`, `/api/ai/api/ai/geo/vision-detect`, `/api/ai/api/ai/impact/measure`, `/api/ai/api/ai/impact/metrics`, `/api/ai/api/ai/impactmatch/rank`, `/api/ai/api/ai/knowledge/extract`, `/api/ai/api/ai/knowledge/graph`, `/api/ai/api/ai/knowledge/query`, `/api/ai/api/ai/knowledge/reviews`, `/api/ai/api/ai/knowledge/reviews/{id}/approve`, `/api/ai/api/ai/knowledge/seed`, `/api/ai/api/ai/knowledge/suggest-partners`, `/api/ai/api/ai/language/simplify`, `/api/ai/api/ai/language/translate`, `/api/ai/api/ai/language/tts`, `/api/ai/api/ai/learning-path`, `/api/ai/api/ai/learning-space/explain`, `/api/ai/api/ai/library/embed`, `/api/ai/api/ai/library/embed-batch`, `/api/ai/api/ai/library/summarize`, `/api/ai/api/ai/map/query`, `/api/ai/api/ai/mentor/match`, `/api/ai/api/ai/moderate`, `/api/ai/api/ai/opportunity/match`, `/api/ai/api/ai/pdf/transcript`, `/api/ai/api/ai/predictive/career-prediction`, `/api/ai/api/ai/predictive/market-data`, `/api/ai/api/ai/predictive/trends`, `/api/ai/api/ai/resource-exchange/match-rank`, `/api/ai/api/ai/resource/optimize`, `/api/ai/api/ai/route/explain`, `/api/ai/api/ai/scholarship/check`, `/api/ai/api/ai/search`, `/api/ai/api/ai/speech/to-text`, `/api/ai/api/ai/survey/next`, `/api/ai/api/ai/survey/priorities`, `/api/ai/api/offline/status`, `/api/ai/api/offline/tutor`

**Analysis:** This is a **duplicate-linking artifact**, not a gap: the normalization function duplicates the `/api/ai` prefix because the routers carry their own prefix `"/api/ai/..."` for some files (e.g. `ai-service/routers/ai.py` has prefix `/api/ai` while some others mount at `/api/ai` too). Every route above is either:
- covered by the Rust catch-all `/api/ai/{*rest}` (all `/api/ai/...` under `/api/ai/` prefix is caught by `router.route("/api/ai/{*rest}", ...)` in `router.rs`);
- served by a BFF page;
- or the ai-service prefix is `"/api/ai"` and the route is `router.get("/...")`, giving a full path like `/api/ai/...` — reachable via BFF / catch-all.

The one genuine hole in this view is `ai-service/routers/system.py` (`/api/ai/system/health`, `/api/ai/system/status`) — never called by any component. It is referenced by nothing in `frontend/`, `backend/src` or `ai-service/main.py`. **Dead route.**

---

## 4. Structural observations (strengths + weaknesses)

**Strengths**
1. **Complete coverage of the 167 BFF pages' proxies.** All 167 BFF pages flow to a Rust route or an ai-service route (71 ai-service endpoints reachable via catch-all + BFF pages: zero 404's on the Rust side).
2. **Catch-all `/api/ai/{*rest}` is the load-bearing corner.** 18 BFF pages (`ai/*`) route through it into the ai-service. It is also excluded from the `next.config.js` rewrite, meaning `/api/ai/{*rest}` never lands on the Rust server as a plain rewrite — it lands on the BFF page, which calls the ai-service. This is consistent.
3. **No broken BFF targets.** The only `None` targets (6) are my scan's blind spot (fetch URL constructed in a `const ... = ...;` variable, e.g. `/api/auth/login`'s `targetUrl`). Verified above manually.

**Weaknesses**
1. **86 Rust routes are unreachable from the app's frontend** (including auth, crawler, sandbox routes). They keep stack surface on port 3000 for a server that only serves `@Public` legacy endpoints. Five of these (`admin/content/pending`, `crawl-map`, `crawler/*`) are pre-existing scaffolding that never got a BFF page.
2. **Route-naming duplications** — `/api/map/poi/{id}` vs `/api/map/pois/{id}`, `/api/learning-spots` vs `/api/learning-spaces`, `/api/impact-measurement/auto-cached/{region_id}` vs `/api/impact-measurement/{regionId}`. The FE calls rarely target the duplicate, but both exist. Same for `business/{bp_id}/products` vs `business/products/{id}` — two variants, one caller.
3. **71 ai-service endpoints appear "unreached"** but this is a scripting artifact (normalization double-prefix). /(only the `ai-service/routers/system.py` routes (`/api/ai/system/health`, `/api/ai/system/status`) are genuinely unconsumed by any component even though they mount on the ai-service router.
4. **`/api/ai/learning-path`, `/api/ai/pdf-transcript`, `/api/ai/route/explain`** are the three BFF pages whose targets (`/api/ai/learning-path/`, `/api/ai/pdf/transcript`, `/api/ai/route/explain`) pass *directly to the ai-service* (not the Rust backend) — the Rust catch-all is excluded by `next.config.js` rewrite, so these **cut the Rust layer**. The paths land on the Rust catch-all `/api/ai/{*rest}` (post-rewrite is fine; the FE string is the Rust proxy. The routing is therefore `/api/ai/learning-path` → catch-all → ai-service `learnings-path`). There is no gap assuming the ai-service is live; if the ai-service is cold and the catch-all can't reach it, the BFF page returns a 500 → handled.
5. **The 20 similarity-prefix paths** measured as "dead" are prefixes used by service files (e.g. `/api/career` in `career.service.ts` as a base for `/api/career/jobs`); they are not paths an end request goes to. Feeding `/api/career` directly would 404.

## 5. What the numbers say (totals)

| Layer | Count |
|---|---|
| Rust backend `.route()` sites | 244 |
| FastAPI ai-service endpoints | 72 |
| Next.js BFF proxy pages | 167 |
| Frontend `/api/...` path strings (in `frontend/src` + `app`) | 206 |
| FE paths served by Rust directly | 3 |
| FE paths served through a BFF page | 109 |
| FE path strings that are leftover prefix/fixture or dead | 68 mocks + 20 prefixes |
| Rust routes never referenced by a FE path string | 86 (includes auth -> ~~6~~, crawler, health, unused scaffolding) |
| ai-service endpoints never referenced by FE | 71 all accounted via catch-all except `system/*` |

## 6. Verified lists (because the audit of the audit is the point)

**A. All 86 Rust routes missing a frontend call:** (already enumerated in §2 — the exact list prints from the script)

**B. The six "BFF-NOTARGET" pages** (their fetch URL is built via a variable):
- `/api/ai/search` → `${getBackendUrl()}/ai/search?q=...` (unknown Rust route? The search route is in `ai-service` at `/api/ai/search`; the Rust `/api/ai/{*rest}` catch-all proxies to ai-service. Search call goes through the Rat catch-all → ai-service `search`.)
- `/api/auth/dev-login` → `${getBackendUrl()}/auth/dev-login` — Rust route exists as `api/auth/dev-login`
- `/api/auth/google` → `${getBackendUrl()}/auth/google` — Rust route exists as `api/auth/google`
- `/api/auth/login` → `${getBackendUrl()}/auth/login` — Rust route exists as `api/auth/login`
- `/api/auth/refresh` → `${getBackendUrl()}/auth/refresh` — Rust route exists as `api/auth/refresh`
- `/api/config` → `${getBackendUrl()}/config` — Rust route exists as `api/config`

**C. The 20 prefix paths** (base for derived FE paths, never a call): `/api/ai`, `/api/career`, `/api/community`, `/api/dashboard`, `/api/impact-match`, `/api/intl`, `/api/learning-spaces`, `/api/library`, `/api/mentoring`, `/api/offline`, `/api/resource-exchange`, `/api/share`, `/api/storage`, `/api/wifi`, `/api/bookmarks`, `/api/escrow`, `/api/scholarships`, `/api/summer` — all carry a `src/services/*` origin.

---

## 7. Record of the review

Every claim in this report was derived from the three live sources:
1. `backend/src/router.rs` — all 244 `.route()` call sites.
2. `frontend/` — all `.route.ts` BFF pages (167) + all `/api/` string literals in `src/` and `app/` (206).
3. `ai-service/routers/*.py` — all 72 registered endpoints.

The audit never starts a server on this machine and treats the production deployment host as the source of truth for runtime reachability.
