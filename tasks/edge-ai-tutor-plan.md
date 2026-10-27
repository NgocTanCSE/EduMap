# Edge AI Tutor (offline) — Implementation Plan

> Idea #7: Hỗ trợ học sinh khi Internet yếu/không có.
> Mô hình ngôn ngữ nhỏ chạy cục bộ, kết hợp tài liệu đã duyệt.
> Deploy ONLY trên HF Spaces free plan (cpu-basic, 1vCPU, ~2-3GB RAM).

## Architecture

```
Frontend (Next.js PWA :7680)            ← public, caches responses via next-pwa
  │ app/api/offline/tutor/route.ts      ← BFF: forward to backend
Backend (NestJS :3000)                  ← internal
  │ offline.controller.ts → offline.service.ts  ← proxy to ai-service + cache
ai-service (FastAPI :8000)              ← internal
  │ routers/offline_tutor.py
  │ offline/tutor.py                    ← TinyLlama 1.1B 4-bit local LLM
```

## Sub-tasks

### T5: requirements.txt + Dockerfile (do FIRST — unblocks pip install in Docker)
- **File:** `ai-service/requirements.txt`
- Add `transformers`, `torch` (CPU-only), `accelerate`, `bitsandbytes`
- **File:** Root `Dockerfile` — bump `CACHEBUST` ARG → `…+edge-ai-tutor`
- **File:** `ai-service/.dockerignore` — add model dirs (`/models/`, `*.bin`, `*.safetensors`, `*.gguf`)
- Verify: `pip install --dry-run` resolves; Dockerfile builds ai-deps stage

### T1: Model selection + verification
- Model: `TinyLlama/TinyLlama-1.1B-Chat-v1.0` (1.1B params, ~632MB fp16, ~500MB 4-bit)
- Download at runtime to `/app/uploads/offline-models/` (writable on HF Spaces)
- Use `transformers` + `bitsandbytes` (4-bit NF4 quant) + `torch` CPU
- Script: `ai-service/offline/verify_model.py`
- Verify: `transformers` loads model, 4-bit quantization fits RAM, inference <5s/token on CPU
- If too slow → fallback to `phi-2` (2.7B, but fp32 ~4GB — too big) or `Qwen2-0.5B`

### T2: ai-service/offline/tutor.py + router
- **File:** `ai-service/offline/__init__.py`
- **File:** `ai-service/offline/tutor.py`
  - `OfflineTutor` class with lazy model loading (singleton)
  - `explain(topic, material_context)` → str
  - `generate_practice(topic, difficulty, num_questions)` → list[dict]
  - `suggest_next(user_progression)` → dict
  - Template-based fallback (Vietnamese) when model unavailable
  - In-process dict cache (TTL 60 min) keyed by MD5(action:topic:params)
- **File:** `ai-service/routers/offline_tutor.py`
  - `POST /api/offline/tutor` with body `{ action, topic, context?, difficulty?, num_questions?, progression? }`
  - Graceful degradation: returns 200 with `degraded: true` + template content (never 503)
- **File:** `ai-service/main.py` — add `'offline_tutor'` to `router_names`

### T3: Backend POST /api/offline/tutor + cache
- **File:** `backend/src/modules/ai/offline-tutor.module.ts` (new, minimal)
  - OR add method to existing `ai.controller.ts` + `ai.service.ts`
- `POST /api/offline-tutor` → proxies to `ai-service POST /api/offline/tutor`
- NestJS `CacheModule` (in-memory on HF Spaces, TTL 3600s)
- JWT guard (or public with optional user context)

### T4: Frontend PWA + mobile
- **File:** `frontend/app/offline-tutor/page.tsx` — PWA page (already PWA-enabled via next-pwa)
  - Chat UI like `ai-agent/page.tsx` but for offline tutor
  - Three modes: Explain, Practice, Suggest
  - Shows `degraded` flag when using template fallback
- **File:** `frontend/app/api/offline/tutor/route.ts` — BFF proxy
- **File:** `frontend/next.config.js` — add `offline/tutor` to rewrites exclusion
- **File:** `frontend/components/Sidebar.tsx` — add "Trợ lý ngoại tuyến" under "Học tập"
- **File:** `mobile/src/services/ai.service.ts` — add `offlineTutor()` method
- **File:** `mobile/src/screens/OfflineTutorScreen.tsx` — mobile screen
- **File:** `mobile/src/navigation/MainTabs.tsx` — add tab

### T5-verify: Docker build + pytest
- Build: `docker build --target ai-deps -t edumap-ai-deps .`
- Test: `cd ai-service && python3 -m pytest tests/test_offline_tutor.py -q`
- Smoke test against HF Spaces after deploy
