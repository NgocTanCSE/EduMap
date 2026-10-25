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
router_names = ['chat', 'suggestions', 'analytics', 'career', 'geo', 'learning_path', 'mentor', 'moderation', 'search', 'library', 'scholarship', 'predictive', 'pdf_transcript']

for name in router_names:
    try:
        module = __import__(f'routers.{name}', fromlist=['router'])
        r = getattr(module, 'router', None)
        if r is not None:
            if name == 'chat':
                app.include_router(r, prefix="/api/ai")
            elif name == 'suggestions':
                app.include_router(r, prefix="/api/ai")
            else:
                app.include_router(r)
            print(f"Router routers.{name} included successfully")
        else:
            print(f"Router module routers.{name} does not have 'router' attribute")
    except Exception as e:
        print(f"Router routers.{name} include FAIL: {e}")


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
    if not llm_service or not getattr(llm_service, "is_ready", False):
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình OPENROUTER_API_KEY (primary), NVIDIA_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
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