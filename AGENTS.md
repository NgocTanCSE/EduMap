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

## 6. Current known limitations on HF

- AI chat history and uploads are ephemeral (`/tmp`).
- Geo/PostGIS analytics is limited in SQLite mode.
- ChromaDB is re-created on every Space restart; seeding runs in a background
  thread and RAG degrades gracefully until it finishes.
