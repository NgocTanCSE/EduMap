# AGENTS.md — EduMap project memory

> This file is the persistent context for any AI agent working on EduMap.
> Read it before changing code. Keep it up to date when deployment or
> architecture assumptions change.

## 1. Deployment model (IMPORTANT — do not forget)

- **Production runs ONLY on Hugging Face Spaces (Docker).**
  - Space: <https://huggingface.co/spaces/tancse2005/Edumap>
  - Public URL: <https://tancse2005-edumap.hf.space>
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

## 3. AI provider chain

Text generation (`ai-service/services/llm_service.py`):
`OpenRouter → NVIDIA → Cloudflare → HF` (with template fallback).

Embeddings (`ai-service/services/vector_store.py`):
`OpenRouter → Gemini → Cloudflare → HF → NVIDIA → 01.ai/Kimi`.

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
- OpenRouter model slugs are provider-prefixed:
  `openai/text-embedding-3-small` (the unprefixed `text-embedding-3-small`
  is wrong; `vector_store.py` normalises legacy values).
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

- `OPENROUTER_API_KEY`, `HF_TOKEN`, `KIMI_API_KEY`, `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`, `GEMINI_API_KEY`, `NVIDIA_API_KEY` are HF Secrets.
- `OPENROUTER_MODEL=deepseek/deepseek-chat` (text generation).
- `OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small`.
- `HF_EMBEDDING_MODEL=intfloat/multilingual-e5-base` (768-dim).
- `CHROMA_DB_PATH=/tmp/chroma_db` (re-seeded at startup by `main.py`).
- `DB_TYPE=sqlite`, `DB_SQLITE_PATH=/app/frontend/public/edumap.db`.

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

## 7. Current known limitations on HF

- AI chat history and uploads are ephemeral (`/tmp`).
- Geo/PostGIS analytics is limited in SQLite mode.
- ChromaDB is re-created on every Space restart; seeding runs in a background
  thread and RAG degrades gracefully until it finishes.
