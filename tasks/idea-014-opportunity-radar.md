# Idea #14: Opportunity Radar (scholarship/job) — Implementation Plan

> **Deployment memory (per user):** EduMap deploys ONLY on Hugging Face Spaces (free plan).
> Local is for code editing + unit tests only. Runtime validation must happen on the HF Space.
> See AGENTS.md §1 for the full deployment model.

## Architecture / Data Flow

```
User → Frontend (Next.js :7680)
  → BFF /api/opportunities/match  (Next.js proxy)
    → Backend NestJS /opportunities/match   [T1: SQLite pre-filter]
      → AI Service (FastAPI :8000) /api/ai/opportunity/match   [T2: NLP criteria extraction]
        → XKIRO → NVIDIA → Cloudflare → HF (graceful fallback)
  ← match_score + checklist ← AI ← candidates ← SQLite pre-filter ← backend
```

**Key runtime facts (HF Spaces, DB_TYPE=sqlite):**
- AI service has `DB_SQLITE_PATH=/app/frontend/public/edumap.db` but does NOT open a DB
  connection in SQLite mode (db_service=None). The NestJS backend owns SQLite access
  via TypeORM repositories.
- All LLM calls use `curl --ipv4 --insecure` (HF Spaces IPv6/TLS quirk).
- Provider circuit breakers = 5 min. RAG_TIMEOUT=8s. Keep below NestJS 10s stream timeout.
- NLP confidence threshold = 0.6. Deadline filter = deadline > today.

## T1 — Backend ScholarshipMatchingService (SQLite pre-filter)
- Extend `Opportunity` entity: add `organization`, `requirements`, `benefits`, `url`,
  `field_tags`, `region`, `status`, `created_by`, `deleted_at` (currently missing vs DB).
- New `OpportunityMatchingService`:
  - `getUserProfile(userId)` → fetches major, skills, interests, location, role, gpa.
  - `preFilterOpportunities(opts)` → SQLite query: `deleted_at IS NULL`, `status='active'`,
    `deadline > now OR deadline IS NULL`, optional type/field filter. Cross-DB LIKE
    (LOWER) so it works on SQLite + Postgres.
  - `matchOpportunities(userId, opts)` → pre-filter, then proxy to AI service
    `POST /api/ai/opportunity/match` with `{ user_profile, opportunities }`, return result.
- Add `POST /opportunities/match` to `OpportunityController` (JWT-guarded).
- Wire `UserRepository` + `AIModule` into `OpportunityModule`.

## T2 — AI service POST /api/ai/opportunity/match (NLP criteria extraction)
- New router `ai-service/routers/opportunity.py`:
  - `POST /api/ai/opportunity/match`
  - Input: `{ user_profile, opportunities[] }`
  - For each opportunity: extract criteria (GPA req, major/fields, skill reqs,
    language req, experience req, deadline) via LLM JSON output.
  - Compute `match_score` 0–100, `confidence` 0–1 (threshold 0.6 → low-confidence flag).
  - Filter expired deadlines.
  - Build per-opportunity `checklist` (CV, transcript, personal statement, language
    cert, portfolio, letter of recommendation...).
  - Process in batches of ≤8 (token/time budget on free HF plan).
  - Graceful fallback: keyword heuristic scoring + `_degraded=True` when ALL LLM
    providers are down (never crash chat — degrade).
- Add `match_opportunities()` method to `LLMService` (llm_service.py).
- Register `opportunity` in `main.py` router list.

## T3 — Frontend app/opportunities/radar/page.tsx
- New page: requires auth → calls BFF `POST /api/opportunities/match`.
- Renders: match score bar (0–100), confidence badge (≥0.6 high), match reasons,
  required-doc checklist, deadline, "Nguồn chính thức ↗" link, region.
- Empty state when no matches; degraded banner when AI unavailable.
- Honest empty states for scholarships/jobs with no real data (data policy).
- Add BFF route `frontend/app/api/opportunities/match/route.ts`.
- Add "Cơ hộp Radar" link in `Sidebar.tsx` (Hướng nghiệp section).

## T4 — Test + smoke test #19
- Backend: `opportunity.matching.service.spec.ts` — mock repos, assert pre-filter
  (deadline filter, status filter, limit) + AI proxy call shape.
- AI service: `tests/test_opportunity_match.py` — assert NLP extraction + scoring
  output shape, confidence threshold handling, expired-deadline filtering,
  degraded fallback when llm_service not ready.
- Smoke test: `scripts/smoke_test.py` (existing) extended / a small script that
  starts the ai-service in-proc and hits `/api/ai/opportunity/match` with a
  canned payload to confirm the endpoint returns 200 + structured matches.

## Acceptance criteria
- [x] Backend pre-filter excludes expired + inactive opportunities (SQLite).
- [x] AI service returns `{ matches: [{ id, title, match_score, confidence,
      is_eligible, extracted_criteria, match_reasons, checklist }], degraded }`.
- [x] Low confidence (<0.6) flagged, not silently trusted.
- [x] Expired deadlines filtered, never shown.
- [x] All sources end with `Nguồn chính thức: <url> · Kiểm chứng: <date>`.
- [x] Graceful degradation when all LLM providers down.
- [x] Frontend radar page renders scores + checklists, empty state when none.
- [x] Tests pass (backend NestJS + AI service pytest).
- [x] Deploys to HF free plan (no extra infra).
