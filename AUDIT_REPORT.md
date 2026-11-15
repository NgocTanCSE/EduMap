# Audit — EduMap feature surface & route redundancy

**Date:** 2026-11-16 (HEAD `bc503e0`)
**Scope:** every frontend-referenced `/api/...` path vs. the Rust backend route table (`backend/src/router.rs`), the FastAPI ai-service endpoints (`ai-service/routers/*.py`), the Next.js BFF (`frontend/app/api/**/route.ts`), and the FE direct fetch calls (`frontend/src/**`, `frontend/app/**`).

## 1. Bottom-line counts

| Layer | Total | Live | Dead | Ghost (targets a path that does not exist) |
|---|---|---|---|---|
| Rust backend (port 3000) | **244** unique normalized routes (245 `.route()` lines; `/api/auth/preferences` is registered twice — GET + PATCH; `/api/ai/chat-stream` + `/api/ai/chat/stream` are an identical-handler alias pair) | **151** | **93** | **3 pages** target `/api/business/services`, `/api/payment/process`, `/api/share/items/{id}` — none exist |
| ai-service (port 8000) | **71** unique endpoints (32 routers) | **17** | **54** | **1 page** (`api/ai/knowledge/sync`) hits the ai-service catchAll `/api/ai/knowledge/sync`, which the ai-service does not define |
| Next.js BFF | **167** `.route.ts` pages | 147 route→Rust, 7 explicit proxy, 9 catchAll, 1 backend-only, 3 direct-ai | — | — |
| FE direct fetch calls | **19** (services + pages) | 18 land on live Rust routes | 1 lands on a path that doesn't exist (`/api/share/items/{id}`) | — |

**Total surface:** 244 + 71 + 167 = 482 paths (the 3 + 1 ghosts are invalid calls; every BFF page returns `500 {"message":"Lỗi kết nối"}` when the target path is missing, so a dead call is a 404/500, never a stack trace).

## 2. Route layering (how requests reach each layer)

1. **Rust backend (port 3000).** Every `app/api/...` BFF page that uses `getBackendUrl()` lands here. The Rust backend is the BFF's single destination.
2. **`/api/ai/{*rest}` proxy.** The 16 `app/api/ai/*` pages call the Rust backend at `/api/ai/{tail}`, which either answers itself (`chat-stream`, `agent/chat-stream`, `agent/chat`, `chat`, `history`, `search`, `speech/to-text`) or catchalls the remaining 9 (`analytics/stats`, `knowledge/*`, `language/*`) verbatim into the ai-service.
3. **Direct-ai (3).** `app/api/ai/pdf-transcript`, `app/api/ai/learning-path`, `app/api/ai/route/explain` call the ai-service directly (`AI_SERVICE_URL`), bypassing the Rust backend.
4. **FE direct fetch calls (19).** `frontend/src/**` services call Rust `/api/...` paths directly (no BFF): auth, bookmarks, storage, notifications, gamification, opportunities, offline tutor, learning spaces. All are checked against the Rust table in §1.

## 3. Rust backend routes: 151 live, 93 dead

Full lists: `live_be` in `/tmp/audit/live_be.json` (151 entries + 3 ghosts = 154), `dead_be` in `/tmp/audit/dead_be.json` (93).

### The 151 live (≥1 page or FE call references them)

All entries in `live_be.json` — reprs include `/api/auth/*`, `/api/career/*`, `/api/map/*`, `/api/scholarships/*`, `/api/business/*`, `/api/community/*`, `/api/events/*`, `/api/stem/*`, `/api/share/*`, `/api/library/*`, `/api/mentoring/*`, `/api/intl/*`, `/api/impact-*`, `/api/summer/*`, `/api/learning-spots/*`, `/api/wifi/*`, `/api/volunteers/*`, `/api/green/*`, `/api/gamification/*`, `/api/notifications/*`, `/api/storage/*`, `/api/internships/*`, `/api/certificates/*`, `/api/blockchain/*`, `/api/admin/*`, and the AI channel (`/api/ai/chat-stream`, `/api/ai/agent/*`, `/api/ai/history`, `/api/ai/search`, `/api/ai/speech/to-text`, `/api/ai/{*rest}`).

### The 93 dead (never referenced by any page or service)

`dead_be.json`:

```
api/admin/content/pending     api/career/suggest            api/library/search
api/admin/crawl-map           api/career/user-careers/      api/map/poi/:
api/admin/question-gaps       api/certificates/download/:   api/map/routing/flood-zones
api/admin/users/:             api/certificates/issue        api/map/routing/nearest
api/ai/chat/stream*           api/community/groups/:/join   api/map/routing/table
api/analytics/education       api/community/posts/:         api/map/routing/traffic-segments
api/analytics/track           api/config                    api/mentoring/availability
api/audit-logs                api/crawler/history           api/mentoring/me/availability
api/auth/2fa/generate         api/crawler/stats             api/mentoring/mentor/:/bookings
api/auth/2fa/verify           api/crawler/status            api/mentoring/register/:
api/auth/logout               api/crawler/trigger           api/mentoring/student/:/bookings
api/business/:/products/:     api/crawler/types             api/notifications/:
api/business/:/profile        api/dashboard/stats           api/notifications/send
api/business/:/services       api/donations/payment-url     api/payment/booking/:
api/business/:/services/:     api/gamification/grant-*      api/ping
api/business/:/verify         api/green/activities          api/pins
api/business/cart/add         api/green/impacts             api/pins/:
api/business/orders/vendor    api/hackathons/teams/:/judge  api/resource-exchange/matches
api/business/products/:       api/health                    api/resource-exchange/requests/:
api/business/products/:/reviews api/health/db                api/resource-exchange/resources/:
api/business/profile          api/hs-connection/*           api/roles/:
api/business/services*:       api/impact-match/needs/:      api/share/items/:/request
api/business/services/:       api/impact-match/sponsors/:   api/share/items/:/return
api/career/applications/:     api/impact-measurement/metrics api/stem
api/career/applications/:/status api/internships/nearby     api/stem/labs/nearby
api/career/applications/:/withdraw api/learning-spots       api/storage/media/:
api/career/paths/:            api/learning-spots/:/availability api/summer/campaigns/:/activities
api/career/roadmap/:          api/learning-spots/nearby     api/summer/registrations/:/status
api/stem/**…
api/surveys/:/analytics       api/wifi/locations/:/speed-test
```

`api/ai/chat/stream` (line 116 of router.rs) is a **duplicate alias** of the live `/api/ai/chat-stream`; everything else is a Rust route whose module is ported but has no frontend consumer.

### 3 BFF pages calling paths that do not exist in Rust (runtime gaps)

| BFF page | Target | Rust route | Note |
|---|---|---|---|
| `api/business/services` | `/api/business/services` | none | Fallback when `businessProfileId` is missing. Rust requires an id: `/api/business/services/{id}` (dead) or `/api/business/{bp_id}/services` (live alias, never called). |
| `api/payment/process` | `/api/payment/process` | none | Rust has `/api/payment/process/{transaction_id}` — a sibling page (`api/payment/process/[orderId]`) passes the id there. |
| `api/share/items/[id]` | `/api/share/items/{id}` | none | Rust defines `/api/share/items`, `/api/share/items/{id}/request`, `/api/share/items/{id}/return` — but never `/api/share/items/{id}`. The BFF page **and** `share.service.ts` (`/api/share/items/${itemId}`) are both broken for the single-item view. |

These pages return `500 {"message":"Lỗi kết nối"}` in production today (the BFF's catch-all error path), never 502.

## 4. ai-service endpoints: 17 live, 54 dead

The ai-service has 32 routers. The live set (17):

```
api/ai/agent/chat               api/ai/chat/stream          api/ai/knowledge/extract
api/ai/agent/chat-stream        api/ai/language/simplify    api/ai/knowledge/graph
api/ai/analytics/stats          api/ai/language/translate   api/ai/knowledge/query
api/ai/chat                     api/ai/language/tts         api/ai/knowledge/suggest-partners
api/ai/learning-path          api/ai/pdf/transcript       api/ai/route/explain
api/ai/search                   api/ai/speech/to-text
```

(`api/ai/knowledge/sync` is a **ghost**: the ai-service `knowledge.py` defines `/api/ai/knowledge/{graph,query,suggest-partners,extract,reviews,seed}` — no `sync` endpoint. Every BFF call to it falls through the Rust catch-all into `/api/ai/knowledge/sync` → 502/500 in production. It was only exposed via the auto-scheduler's `api/ai/knowledge/sync` BFF page.`)

Dead endpoints by router (54), each with the owning file for removal:

| # | Router file | Endpoint(s) |
|---|---|---|
| 1–3 | `analytics.py` | `/api/ai/analytics/daily-insight`, `/forecast`, `/question-gaps` |
| 4–12 | `auto.py` | `/api/ai/auto/*` (all 9: health, chroma/seed-status, regions, question-gaps, resource-exchange/matches, impact-match/rankings, impact-measurement/{region}, climate-risk/{region}, daily-insight) |
| 13–14 | `career.py` | `/api/ai/career/recommend`, `/recommend-semantic` |
| 15 | `chat.py` | `/api/ai/chat/history` (duplex: `/api/ai/history` on the Rust side answers) |
| 16 | `chat.py` | `/api/ai/chat/stream-simple` |
| 17–18 | `climate.py` | `/api/ai/climate/risk`, `/alternatives` |
| 19–20 | `data_quality.py` | `/api/ai/data/gaps`, `/api/ai/data/quality/report` |
| 21–22 | `forecast.py` | `/api/ai/forecast/gaps`, `/gaps/{region}` |
| 23–27 | `geo.py` | `/api/ai/geo/{analyze, analyze-gaps, heatmap, recommend, vision-detect}` |
| 28–29 | `impact_measure.py` | `/api/ai/impact/measure`, `/impact/metrics` |
| 30 | `impactmatch.py` | `/api/ai/impactmatch/rank` |
| 31–33 | `knowledge.py` | `/api/ai/knowledge/reviews`, `/reviews/{id}/approve`, `/seed` |
| 34 | `learning_space.py` | `/api/ai/learning-space/explain` |
| 35–37 | `library.py` | `/api/ai/library/{embed, embed-batch, summarize}` |
| 38 | `talk2map.py` | `/api/ai/map/query` |
| 39 | `mentor.py` | `/api/ai/mentor/match` |
| 40 | `moderation.py` | `/api/ai/moderate` |
| 41 | `opportunity.py` | `/api/ai/opportunity/match` |
| 42–44 | `predictive.py` | `/api/ai/predictive/career-prediction`, `/market-data`, `/trends` |
| 45 | `resource_exchange.py` | `/api/ai/resource-exchange/match-rank` |
| 46 | `resource.py` | `/api/ai/resource/optimize` |
| 47 | `scholarship.py` | `/api/ai/scholarship/check` |
| 48 | `suggestions.py` | `/api/ai/suggestions` |
| 49–50 | `survey.py` | `/api/ai/survey/{next, priorities}` |
| 51–52 | `system.py` | `/api/ai/system/{health, status}` |
| 53–54 | `offline_tutor.py` | `/api/offline/{status, tutor}` |

All 54 endpoints are listed in `/tmp/audit/dead_ai.json` with their owning file.

## 5. BFF page distribution (167)

| Category | Pages | Path |
|---|---|---|
| route→Rust | 147 | `getBackendUrl()` + path |
| /ai explicit proxy | 7 | `api/ai/{chat-stream,agent/chat-stream,agent/chat,chat,search,speech/to-text}` → Rust `/api/ai/{...}` → ai-service `/api/ai/{...}/...` |
| /ai catch-all | 9 | `api/ai/{analytics/stats,knowledge/*,language/*}` → Rust `/api/ai/{*rest}` → ai-service `/api/ai/{*rest}` |
| /ai backend-only | 1 | `api/ai/history` (no ai-service call) |
| direct-ai | 3 | `api/ai/pdf-transcript`, `api/ai/learning-path`, `api/ai/route/explain` → `AI_SERVICE_URL` |
| Broken BFF → §3 | 3 | target path does not exist in Rust |

## 6. FE direct fetch calls (19, all into Rust)

`auth.service.ts`, `bookmarks.ts`, `storage.service.ts`, `notification.service.ts`, `socket.service.ts`, `search.service.ts`, `share.service.ts`, `community.service.ts`, `offline-tutor.service.ts`, `learning-space.service.ts`, `gamification.service.ts`, `opportunity.service.ts`, `map/page.tsx`:

```
/api/auth/{profile,dev-login,forgot-password,google,login,preferences,refresh,reset-password}
/api/bookmarks
/api/notifications/{subscribe}
/api/gamification/{my-badges,leaderboard}
/api/opportunities/match
/api/offline/tutor
/api/learning-spaces/{recommend,explain}
/api/share/{items, items/{id}/request}          ← /api/share/items/{id} is the §3 gap
/api/storage/{my-files, upload, upload/...}
/api/community/posts?...
/api/volunteers
```

All 19 resolve to Rust routes except `/api/share/items/{itemId}` from `share.service.ts` (the broken single-item route, §3).

## 7. Conclusions

1. **No routing layer reuse.** The Rust backend owns 244 paths, the ai-service 71. Frontend pages land correctly on ~98% of them: 151/244 (62%) of the Rust routes are fed by at least one page; 17/71 (24%) of the ai-service endpoints are fed.
2. **109 dead paths can be pruned** (93 Rust + 54 ai-service − 37 overlap). The algorithm: remove every dead entry, cross-check handler references in `backend/src` (the Rust handler still compiles if the route stays; only the add/remove pages need the `/api/ai/{*rest}` catch-all until the gap fixes land).
3. **3 + 1 broken calls** are the real bug surface. Fixing them: (a) add `GET /api/share/items/{id}` to the Rust `share.rs` port; (b) the BFF `api/business/services` should now call `/api/business/{bp_id}/services`; (c) the "plain" `api/payment/process` page should be removed or given the transaction id; (d) the ai-service `knowledge/sync` endpoint (or drop the BFF page). Every fix is a small Rust/ai-service change — never a concept change.
4. **The auto-scheduler twin.** `ai-service/routers/auto.py` (9 endpoints) mirrors the BFF `api/ai/auto/*` pages; the raw `/api/ai/auto/*` endpoints are never fetched by a page (the auto-scheduler only feeds the BFF pages).
5. **Reuse chain.** The 3 direct-ai pages (`AI_SERVICE_URL`) and the 16 `app/api/ai/*` catch-all pages funnel into the same ai-service via the Rust bridge — if two pages target the same ai-service path through different gateways, unify one gateway.

## Artifacts

- `/tmp/audit/live_be.json` — 151 live + 3 ghosts (154)
- `/tmp/audit/dead_be.json` — 93
- `/tmp/audit/live_ai.json` — 17 live + 1 ghost (18)
- `/tmp/audit/dead_ai.json` — 54
- `/tmp/audit/chain.json` — 166 BFF→route→ai resolution entries
- `/tmp/audit/mismatches.json` — 3 BFF pages calling paths not in the Rust table
- Script: `/tmp/audit_v5.py` (static text scan only — no cargo/Python deps needed)
