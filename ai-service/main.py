import os
print("AI SERVICE STARTING")

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

# Import routers with error handling
router_modules = {}
router_names = ['chat', 'suggestions', 'analytics', 'career', 'geo', 'learning_path', 'mentor', 'moderation', 'search', 'library', 'scholarship', 'predictive']

for name in router_names:
    try:
        module = __import__(f'routers.{name}', fromlist=[name])
        router_modules[name] = getattr(module, name, None)
        print(f"6. router.{name} OK")
    except Exception as e:
        router_modules[name] = None
        print(f"6. router.{name} FAIL: {e}")

print("7. All routers attempted")

# Create FastAPI app
try:
    app = FastAPI(title="EduMap AI Service")
    print("8. FastAPI app created")
except Exception as e:
    print(f"8. FastAPI app FAIL: {e}")
    raise

# Include routers
for name, router in router_modules.items():
    if router:
        try:
            if name == 'chat':
                app.include_router(router.router, prefix="/api/ai")
            else:
                app.include_router(router.router)
            print(f"9. router.{name} included")
        except Exception as e:
            print(f"9. router.{name} include FAIL: {e}")

# Endpoints
@app.get("/api/ai/trends")
async def get_trends():
    if not llm_service or not getattr(llm_service, "is_ready", False):
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY để xem xu hướng thị trường.")
    try:
        return await llm_service.analyze_market_trends([{"keyword": "AI"}])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Lỗi khi phân tích xu hướng: {str(e)}")

@app.post("/api/ai/predict")
async def predict_user(data: dict):
    if not llm_service or not getattr(llm_service, "is_ready", False):
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
    try:
        return {"status": "success", "recommendation": await llm_service.generate_career_advice(data)}
    except Exception as e:
        print(f"Predict error: {e}")
        raise HTTPException(status_code=502, detail=f"AI Service error: {str(e)}")

@app.post("/api/ai/sync-knowledge")
async def sync_knowledge(background: bool = False, background_tasks: BackgroundTasks = None):
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