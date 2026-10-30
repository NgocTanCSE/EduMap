import os
print("AI SERVICE STARTING")

# HF Spaces may resolve IPv6 first on a network without a working IPv6 route,
# which makes TLS handshakes to Cloudflare/HF hang until timeout. Force IPv4
# before any service (and therefore any HTTP client) is imported.
try:
    from services.net import force_ipv4
    force_ipv4()
except Exception as e:
    print(f"0. force_ipv4 FAIL: {e}")

try:
    import traceback
    print("1. traceback OK")
except Exception as e:
    print(f"1. traceback FAIL: {e}")

try:
    import pandas as pd
    print("2. pandas OK")
except Exception as e:
    print(f"2. pandas FAIL: {e}")

try:
    from fastapi import FastAPI, HTTPException, BackgroundTasks
    print("3. fastapi OK")
except Exception as e:
    print(f"3. fastapi FAIL: {e}")

# Import services
try:
    from services.llm_service import llm_service
    print(f"4. llm_service OK, is_ready={llm_service.is_ready}")
except Exception as e:
    print(f"4. llm_service FAIL: {e}")
    llm_service = None

try:
    from services.db_service import db_service
    print("5. db_service OK")
except Exception as e:
    print(f"5. db_service FAIL: {e}")
    db_service = None

# Create FastAPI app
try:
    app = FastAPI(title="EduMap AI Service")
    print("FastAPI app created")
except Exception as e:
    print(f"FastAPI app FAIL: {e}")
    raise

# Import and include routers with robust error handling
router_names = ['chat', 'suggestions', 'analytics', 'career', 'geo', 'learning_path', 'mentor', 'moderation', 'search', 'library', 'scholarship', 'predictive', 'forecast', 'pdf_transcript', 'resource', 'data_quality', 'agent', 'talk2map', 'data_hunter', 'climate', 'offline_tutor', 'impactmatch', 'knowledge', 'opportunity', 'learning_space', 'impact_measure', 'language', 'speech', 'question_gaps', 'resource_exchange', 'survey', 'system']

for name in router_names:
    try:
        module = __import__(f'routers.{name}', fromlist=['router'])
        r = getattr(module, 'router', None)
        if r is not None:
            # Every router declares its own full path prefix (e.g.
            # "/api/ai/chat", "/api/ai/survey"). Mount them uniformly so the
            # route table is identical no matter which main.py revision runs.
            app.include_router(r)
            print(f"Router routers.{name} included successfully")
        else:
            print(f"Router module routers.{name} does not have 'router' attribute")
    except Exception as e:
        print(f"Router routers.{name} include FAIL: {e}")

# Startup diagnostics: make a missing chat route obvious in the HF logs.
# NOTE: include_router() registers lazy `_IncludedRouter` proxies, so
# `app.routes` does not expose the resolved paths even after startup (it made
# this diagnostic print a false "not registered" warning). The OpenAPI schema
# resolves the proxies, so it is the reliable source for the real route table.
@app.on_event("startup")
def _log_registered_routes():
    try:
        paths = sorted(app.openapi().get("paths", {}).keys())
        chat_paths = [p for p in paths if "/chat" in p or "suggestions" in p]
        print(f"CHAT ROUTES REGISTERED: {chat_paths}")
        if "/api/ai/chat/stream" not in paths:
            print("WARNING: /api/ai/chat/stream is NOT registered — chat will 404!")
        print(f"TOTAL API ROUTES REGISTERED: {len(paths)}")
    except Exception as _diag_err:  # pragma: no cover - diagnostics only
        print(f"Route diagnostics failed (non-fatal): {_diag_err}")


# ── Startup hook: auto-seed ChromaDB ─────────────────────────────────────────
# HF Spaces uses an ephemeral ChromaDB (CHROMA_DB_PATH=/tmp/chroma_db) that is
# wiped on every Space restart. Without auto-seeding the vector DB is empty on
# first boot until a manual POST /api/ai/sync-knowledge or a library/career/
# scholarship create event fires. This startup hook calls seed_data() in a
# daemon thread so uvicorn can begin serving immediately while seeding proceeds
# in parallel — if a request arrives before seeding completes, RAG degrades
# gracefully (returns empty results instead of crashing).
@app.on_event("startup")
def _startup_seed_vector_db():
    """Seed the vector DB (ChromaDB) at application startup."""
    import threading

    def _seed():
        try:
            from seed_vector_db import seed_data
            print("=== Startup: seeding vector DB (ChromaDB)... ===")
            result = seed_data()
            print(
                "=== Startup: seed_data() complete — "
                f"{result.get('synced_count', '?')} documents, "
                f"source={result.get('source', '?')}, "
                f"status={result.get('status', '?')} ==="
            )
        except Exception as e:
            # Non-fatal: a seeding failure must NOT prevent the AI service
            # from starting. RAG will degrade gracefully on an empty vector DB.
            print(f"Startup: seed_data() failed (non-fatal): {e}")

    threading.Thread(target=_seed, daemon=True).start()


# ── Startup hook: staggered local model loading (OOM prevention) ─────────────
# All local models use lazy loading (loaded on first request), but we also kick
# off a staggered warmup here so the FIRST user request doesn't pay the full
# cold-start penalty. Models are pre-loaded in sequence with delays to avoid
# RAM spikes that could OOM the 16GB HF Spaces free container.
# Order: embeddings → reranker → vision → LLM (each ~15s apart).
# TinyLlama was removed on 2026-10-30 — the Edge AI Tutor now uses the
# DeepSeek/Gemini/Cloudflare cascade, so there is no second local LLM.
@app.on_event("startup")
def _startup_stagger_local_models():
    """Staggered pre-load of local models to smooth the RAM curve on startup.

    Each model loads 15 seconds after the previous — avoiding the scenario
    where seed_vector_db (embeddings) + vision + LLM all load at once and
    OOM-kill the container. Models still lazy-load on first request if the
    warmup thread hasn't reached them yet.
    """
    import threading
    import time

    model_load_order = [
        ("embeddings", "vector_store"),
        ("reranker", "vector_store"),
        ("vision", "geo"),
        ("llm", "llm_service"),
    ]

    def _warmup():
        for name, module_name in model_load_order:
            # Stagger: wait between model loads to let RAM settle
            time.sleep(15)  # 15s stagger between each model
            try:
                if name == "embeddings":
                    from services.vector_store import vector_store
                    ok = vector_store._warmup_local_embedding()
                    print(f"[staggered-warmup] {name} {'model pre-loaded OK' if ok else 'pre-load skipped (see warnings above)'}")
                elif name == "reranker":
                    from services.vector_store import vector_store
                    ok = vector_store._warmup_local_reranker()
                    print(f"[staggered-warmup] {name} {'pre-loaded OK' if ok else 'pre-load skipped (see warnings above)'}")
                elif name == "vision":
                    from routers.geo import _load_local_vision_model
                    ok = _load_local_vision_model()
                    print(f"[staggered-warmup] {name} {'pre-loaded OK' if ok else 'pre-load FAILED — GeoVision will use HF Inference API / template fallback'}")
                elif name == "llm":
                    from services.llm_service import _load_local_llm
                    ok = _load_local_llm()
                    if ok:
                        print(f"[staggered-warmup] {name} pre-loaded OK")
                    else:
                        print(f"[staggered-warmup] {name} pre-load FAILED — using Cloudflare/Gemini/template fallback chain")
            except Exception as e:
                # Non-fatal: lazy-load will retry on first request
                print(f"[staggered-warmup] {name} pre-load failed (non-fatal): {type(e).__name__}: {e}")
                # Continue to next model — one model's failure doesn't block others

    threading.Thread(target=_warmup, daemon=True).start()


# ── Startup hook: auto-seed Knowledge Graph ────────────────────────────────
# HF Spaces runs everything in one container; the SQLite DB at
# DB_SQLITE_PATH is pre-built at deploy time but may be updated by the
# hourly crawler job. The knowledge graph (Idea #8) is a derived SQLite
# adjacency list (kg_nodes / kg_edges) built FROM those content tables, so it
# must be (re)seeded at startup and refreshed hourly.
#
# This startup hook seeds the graph in a daemon thread (non-blocking) so
# uvicorn can begin serving immediately while seeding proceeds. Requests that
# arrive before seeding completes get whatever nodes exist (possibly 0 →
# frontend shows an empty state, which is the honest default per AGENTS.md).
#
# A repeating background thread then re-seeds every 60 minutes (hourly sync
# per T3) so the graph stays in sync with crawled data. In SQLite/HF mode
# ScheduleModule is disabled, so the loop lives here instead of in NestJS.
@app.on_event("startup")
def _startup_seed_knowledge_graph():
    """Seed the AI Knowledge Graph at startup + start hourly refresh thread."""
    import threading
    import time as _time

    # Sync interval (env-tunable; default 3600s = 1 hour per T3 spec).
    sync_interval = int(os.getenv("KNOWLEDGE_GRAPH_SYNC_INTERVAL", "3600"))

    def _seed_once():
        try:
            from services.knowledge_graph import KnowledgeGraphService
            svc = KnowledgeGraphService()
            result = svc.seed_graph()
            print(
                f"=== Startup: knowledge graph seeded — "
                f"{result.get('nodes', 0)} nodes, {result.get('edges', 0)} edges ==="
            )
        except Exception as e:
            print(f"Startup: knowledge graph seed failed (non-fatal): {e}")

    def _loop():
        """Initial seed immediately, then re-seed every sync_interval."""
        _seed_once()
        while True:
            _time.sleep(sync_interval)
            _seed_once()

    threading.Thread(target=_loop, daemon=True).start()


# Endpoints
@app.get("/api/ai/trends")
async def get_trends():
    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service not initialized.")
    try:
        return await llm_service.analyze_market_trends([{"keyword": "AI"}])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Lỗi khi phân tích xu hướng: {str(e)}")

@app.post("/api/ai/predict")
async def predict_user(data: dict):
    """Career prediction endpoint (legacy alias — frontend uses career/recommend).

    Removed the hard 503 gate so the method's own fallback handles the
    ``is_ready=False`` case. ``generate_career_advice`` already degrades to
    a SQLite-backed keyword-based response (never 502/503).
    """
    try:
        return {"status": "success", "recommendation": await llm_service.generate_career_advice(data)}
    except Exception as e:
        print(f"Predict error: {e}")
        raise HTTPException(status_code=502, detail=f"AI Service error: {str(e)}")

@app.post("/api/ai/sync-knowledge")
async def sync_knowledge(background_tasks: BackgroundTasks, background: bool = False):
    """
    Endpoint đồng bộ dữ liệu từ PostgreSQL sang AI Vector Database (ChromaDB).
    - background=false (mặc định): Đồng bộ ngay và trả về số lượng tài liệu đã cập nhật.
    - background=true: Chạy tiến trình đồng bộ ngầm trong nền.
    """
    try:
        from seed_vector_db import seed_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể tải module đồng bộ: {str(e)}")

    if background and background_tasks:
        background_tasks.add_task(seed_data)
        return {
            "status": "processing",
            "message": "Quá trình đồng bộ tri thức từ Database sang AI Vector Store đang chạy ngầm trong nền."
        }

    try:
        result = seed_data()
        if result.get("status") == "error":
            raise HTTPException(status_code=502, detail=result.get("message"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Lỗi khi đồng bộ tri thức: {str(e)}")


# ─── Incremental Embed endpoints (auto-embed on new books / locations) ───────
# These mirror the endpoints in routers/library.py but are registered at the
# top-level /api/ai/ prefix so the backend (ai.service.ts, map.service.ts)
# can call POST /api/ai/embed directly. See library.py for background docs.
@app.post("/api/ai/embed")
async def incremental_embed(req_body: dict):
    """Incrementally embed a SINGLE new document (book / location) into the
    vector DB. Called automatically on create — NOT a full re-sync."""
    from services.vector_store import vector_store
    from pydantic import BaseModel, Field
    from typing import Dict, Any

    class EmbedRequest(BaseModel):
        text: str = Field(..., description="Document text to embed")
        metadata: Dict[str, Any] = Field(default_factory=dict)
        id: str = Field(..., description="Document ID")

    try:
        req = EmbedRequest(**req_body)
        ok = vector_store.embed_document(req.text, req.metadata, req.id)
        if ok:
            return {"status": "ok", "id": req.id, "message": "Document embedded successfully."}
        return {"status": "error", "id": req.id, "message": "Vector store not available (graceful degradation)."}
    except Exception as e:
        print(f"[embed] Error embedding '{req_body.get('id', '?')}': {e}")
        return {"status": "error", "message": str(e)}


@app.post("/api/ai/embed-batch")
async def incremental_embed_batch(req_body: dict, background_tasks: BackgroundTasks = None, background: bool = False):
    """Batch incremental embed — embeds multiple documents."""
    from services.vector_store import vector_store
    from pydantic import BaseModel, Field
    from typing import Dict, Any, List

    class EmbedRequest(BaseModel):
        text: str
        metadata: Dict[str, Any] = Field(default_factory=dict)
        id: str

    class EmbedBatchRequest(BaseModel):
        documents: List[EmbedRequest]

    try:
        req = EmbedBatchRequest(**req_body)
        if background and background_tasks:
            def _bg():
                ok_count = 0
                for d in req.documents:
                    try:
                        if vector_store.embed_document(d.text, d.metadata, d.id):
                            ok_count += 1
                    except Exception as ex:
                        print(f"[embed-batch BG] '{d.id}' failed: {ex}")
                print(f"[embed-batch BG] Done — {ok_count}/{len(req.documents)} embedded.")
            background_tasks.add_task(_bg)
            return {"status": "processing", "count": len(req.documents), "message": "Batch embed running in background."}

        ok_count = 0
        for d in req.documents:
            try:
                if vector_store.embed_document(d.text, d.metadata, d.id):
                    ok_count += 1
            except Exception as ex:
                print(f"[embed-batch] '{d.id}' failed: {ex}")
        return {"status": "ok", "count": len(req.documents), "embedded": ok_count}
    except Exception as e:
        print(f"[embed-batch] Error: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/health")
async def health_check():
    ai_ready = bool(llm_service and getattr(llm_service, "is_ready", False))
    db_ready = bool(db_service and getattr(db_service, "conn", None) is not None)
    return {
        "status": "ok" if ai_ready else "degraded",
        "ai_ready": ai_ready,
        "db_ready": db_ready
    }

@app.get("/metrics")
async def metrics():
    ai_ready = 1 if (llm_service and getattr(llm_service, "is_ready", False)) else 0
    return f"ai_service_ready {ai_ready}\n"

@app.get("/")
async def root():
    return {"message": "EduMap AI Service is running!"}

print("AI SERVICE READY")