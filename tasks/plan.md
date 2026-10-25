# Implementation Plan: Sync predictive_service.py with Holt's Linear Forecasting

## Overview
Sync the predictive service (`ai-service/services/predictive_service.py`) with the
Holt's Linear Exponential Smoothing approach already implemented in
`ai-service/routers/analytics.py`. The analytics router already has correct
Holt's Linear (double exponential smoothing, alpha=0.3, beta=0.1) plus CAGR
compounding in `_build_sectors()`. The predictive service still uses if-else
keyword matching and returns `{}` from `get_market_trends()`.

## Architecture Context
- **ai-service** = Python FastAPI service deployed to HF Spaces
- Frontend → Next.js BFF API routes → NestJS backend → ai-service (FastAPI)
- HF Spaces mode: DB_TYPE=sqlite, data read from `/app/frontend/public/edumap.db`
- `analytics.py` has `_holt_linear_forecast()`, `_load_education_stats()`,
  `_build_sectors()` — all module-level, ready to import
- `predictive_service.py` is a class-based service (no circular import risk
  since analytics.py doesn't import from services/)

## Design Decision: Import, don't duplicate
The predictive_service will **import** `_holt_linear_forecast`, `_load_education_stats`,
and `_build_sectors` from `routers.analytics` to guarantee the two modules stay
in sync ("đồng bộ"). This avoids code drift and reuses the same data-loading
layer (PostgreSQL ↔ SQLite fallback).

## Tasks

### Task 1: Update predictive_service.py
- [ ] Add `_load_education_stats()` — delegates to `analytics._load_education_stats()`
- [ ] Add `_load_active_job_skills()` — loads from jobs table via SQLite fallback
- [ ] Add `_holt_forecast()` — delegates to `analytics._holt_linear_forecast()`
- [ ] Add `_build_sectors()` — delegates to `analytics._build_sectors()`
- [ ] Rewrite `get_market_trends(steps_ahead=3)` — returns real trend data with
      Holt's forecasts instead of `{}`
- [ ] Rewrite `predict_career_path(user_history, steps_ahead=3)` — uses
      Holt's time-series forecasting + skill matching instead of if-else keywords
- [ ] Enhance `analyze_trends()` — uses real data + Holt's, plus keyword freq

### Task 2: Update predictive.py router
- [ ] `/market-data` → call `get_market_trends()` with default steps_ahead
- [ ] `/career-prediction` → handle structured dict return from `predict_career_path()`
- [ ] `/trends` → use enhanced `analyze_trends()` results
- [ ] Add optional `steps_ahead` query param to trend endpoints

### Task 3: Write tests
- [ ] Test `get_market_trends()` returns structured data (not `{}`)
- [ ] Test `predict_career_path()` returns dict (not string) with match_score
- [ ] Test `predict_career_path()` handles empty input gracefully
- [ ] Test `analyze_trends()` uses Holt's method
- [ ] Test Holt's forecast produces non-empty results with seed data

### Task 4: Verify
- [ ] Run all existing tests (no regressions)
- [ ] Run new predictive tests
- [ ] Verify imports work with DB_TYPE=sqlite
- [ ] Verify requirements.txt (numpy already present — no statsmodels/prophet needed)

## Risks
| Risk | Mitigation |
|------|-----------|
| Circular import (service → router) | analytics.py doesn't import predictive_service, so no cycle |
| Frontend expects old return types | Frontend doesn't call /api/ai/predictive/* directly |
| No SQLite data locally | Seed test DB from seed_education_stats.sql for tests |
