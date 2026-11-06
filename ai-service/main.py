import os
print("AI SERVICE STARTING")




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


try:
    app = FastAPI(title="EduMap AI Service")
    print("FastAPI app created")
except Exception as e:
    print(f"FastAPI app FAIL: {e}")
    raise


router_names = ['chat', 'suggestions', 'analytics', 'career', 'geo', 'learning_path', 'mentor', 'moderation', 'search', 'library', 'scholarship', 'predictive', 'forecast', 'pdf_transcript', 'resource', 'data_quality', 'agent', 'talk2map', 'climate', 'offline_tutor', 'impactmatch', 'knowledge', 'opportunity', 'learning_space', 'impact_measure', 'language', 'speech', 'resource_exchange', 'survey', 'system', 'auto', 'route']

for name in router_names:
    try:
        module = __import__(f'routers.{name}', fromlist=['router'])
        r = getattr(module, 'router', None)
        if r is not None:



            app.include_router(r)
            print(f"Router routers.{name} included successfully")
        else:
            print(f"Router module routers.{name} does not have 'router' attribute")
    except Exception as e:
        print(f"Router routers.{name} include FAIL: {e}")






@app.on_event("startup")
def _log_registered_routes():
    try:
        paths = sorted(app.openapi().get("paths", {}).keys())
        chat_paths = [p for p in paths if "/chat" in p or "suggestions" in p]
        print(f"CHAT ROUTES REGISTERED: {chat_paths}")
        if "/api/ai/chat/stream" not in paths:
            print("WARNING: /api/ai/chat/stream is NOT registered — chat will 404!")
        print(f"TOTAL API ROUTES REGISTERED: {len(paths)}")
    except Exception as _diag_err:
        print(f"Route diagnostics failed (non-fatal): {_diag_err}")










@app.on_event("startup")
def _startup_seed_vector_db():
    """Seed the vector DB (ChromaDB) at application startup."""
    import threading

    def _seed():



        from utils.memory_guard import check_oom
        oom = check_oom()
        if not oom["safe_to_load_models"]:
            print(
                f"=== Startup: SKIPPING vector DB seed — RAM too tight "
                f"(available={oom['ram']['available_gb']:.1f}GB, "
                f"threshold={oom['threshold_gb']:.1f}GB). "
                f"Will lazy-seed on first request. ==="
            )
            return

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


            print(f"Startup: seed_data() failed (non-fatal): {e}")

    threading.Thread(target=_seed, daemon=True).start()










@app.on_event("startup")
def _startup_stagger_local_models():
    """Staggered pre-load of local models to smooth the RAM curve on startup.

    Each model loads 30 seconds after the previous — avoiding the scenario
    where seed_vector_db (embeddings) + vision + LLM all load at once and
    OOM-kill the container. Models still lazy-load on first request if the
    warmup thread hasn't reached them yet.
    """
    import threading
    import time
    import os




    stagger_seconds = int(os.getenv("MODEL_LOAD_STAGGER_SECONDS", "30"))

    model_load_order = [
        ("embeddings", "vector_store"),
        ("reranker", "vector_store"),
        ("vision", "geo"),
        ("llm", "llm_service"),
    ]

    def _warmup():
        from utils.memory_guard import check_oom

        for name, module_name in model_load_order:

            time.sleep(stagger_seconds)





            oom = check_oom()
            if not oom["safe_to_load_models"]:
                print(
                    f"[staggered-warmup] {name} SKIPPED — RAM too tight "
                    f"(available={oom['ram']['available_gb']:.1f}GB, "
                    f"threshold={oom['threshold_gb']:.1f}GB). "
                    f"Will lazy-load on first request if needed."
                )
                continue

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

                    if os.getenv("LOCAL_VISION_ENABLED", "false").lower() != "true":
                        print(f"[staggered-warmup] {name} SKIPPED — LOCAL_VISION_ENABLED=false")
                        continue
                    from routers.geo import _load_local_vision_model
                    ok = _load_local_vision_model()
                    print(f"[staggered-warmup] {name} {'pre-loaded OK' if ok else 'pre-load FAILED — GeoVision will use HF Inference API / template fallback'}")
                elif name == "llm":

                    if os.getenv("LOCAL_LLM_ENABLED", "false").lower() != "true":
                        print(f"[staggered-warmup] {name} SKIPPED — LOCAL_LLM_ENABLED=false")
                        continue
                    from services.llm_service import _load_local_llm
                    ok = _load_local_llm()
                    if ok:
                        print(f"[staggered-warmup] {name} pre-loaded OK")
                    else:
                        print(f"[staggered-warmup] {name} pre-load FAILED — using Cloudflare/Gemini/template fallback chain")
            except Exception as e:

                print(f"[staggered-warmup] {name} pre-load failed (non-fatal): {type(e).__name__}: {e}")


    threading.Thread(target=_warmup, daemon=True).start()

















@app.on_event("startup")
def _startup_seed_knowledge_graph():
    """Seed the AI Knowledge Graph at startup + start hourly refresh thread."""
    import threading
    import time as _time


    sync_interval = int(os.getenv("KNOWLEDGE_GRAPH_SYNC_INTERVAL", "3600"))

    def _seed_once():

        from utils.memory_guard import check_oom
        oom = check_oom()
        if not oom["safe_to_load_models"]:
            print(
                f"=== Knowledge graph seed SKIPPED — RAM too tight "
                f"(available={oom['ram']['available_gb']:.1f}GB) ==="
            )
            return
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






















@app.on_event("startup")
def _startup_auto_scheduler():
    """Start the AI Auto-Scheduler daemon thread."""
    import threading

    def _run():



        from utils.memory_guard import check_oom
        oom = check_oom()
        if not oom["safe_to_load_models"]:
            print(
                f"[auto-scheduler] Startup SKIPPED — RAM too tight "
                f"(available={oom['ram']['available_gb']:.1f}GB). "
                f"Will start on first /api/ai/auto/* request."
            )
            return

        from services.auto_scheduler import auto_scheduler, AUTO_ENABLED
        if not AUTO_ENABLED:
            print("[auto-scheduler] Scheduler DISABLED (AUTO_SCHEDULER_ENABLED=false)")
            return
        try:
            from services.auto_scheduler import auto_scheduler
            print("[auto-scheduler] Starting daemon loop (staggered initial run)...")


            auto_scheduler.run_loop()
        except Exception as e:

            print(f"[auto-scheduler] Scheduler loop failed (non-fatal): {type(e).__name__}: {e}")

    threading.Thread(target=_run, daemon=True).start()



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