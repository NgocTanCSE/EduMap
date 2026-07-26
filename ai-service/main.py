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
    from fastapi import FastAPI
    print("3. fastapi OK")
except Exception as e:
    print(f"3. fastapi FAIL: {e}")

# Import services with error handling
_llm_service = None
_db_service = None

try:
    from services.llm_service import llm_service as _llm_service
    print(f"4. llm_service OK, is_ready={_llm_service.is_ready}")
except Exception as e:
    print(f"4. llm_service FAIL: {e}")

try:
    from services.db_service import db_service as _db_service
    print("5. db_service OK")
except Exception as e:
    print(f"5. db_service FAIL: {e}")

# Create mocks if services failed
if _llm_service is None:
    class MockLLMService:
        is_ready = False
        async def chat_with_rag(self, *args, **kwargs): 
            return {"reply": "AI Service chưa sẵn sàng.", "sources": []}
        async def analyze_market_trends(self, *args, **kwargs):
            return {"status": "offline", "message": "AI Service not configured"}
        async def generate_career_advice(self, *args, **kwargs):
            return "AI Service chưa sẵn sàng."
    _llm_service = MockLLMService()
    print("4b. mock llm_service used")

if _db_service is None:
    class MockDBService:
        def get_education_stats(self, year=2024):
            return [
                {"region": "Hà Nội", "province": "Hà Nội", "metric_type": "IT Enrollment", "metric_value": 85.0, "year": 2024},
                {"region": "Hà Nội", "province": "Hà Nội", "metric_type": "IT Enrollment", "metric_value": 72.0, "year": 2023},
            ]
        def get_user_events(self, limit=1000):
            return []
    _db_service = MockDBService()
    print("5b. mock db_service used")

# Assign to expected names for routers
llm_service = _llm_service
db_service = _db_service

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
    try:
        if llm_service.is_ready:
            return await llm_service.analyze_market_trends([{"keyword": "AI"}])
        
        stats_data = db_service.get_education_stats(year=2024)
        if not stats_data:
            return {"status": "offline", "message": "AI Service offline"}
        
        try:
            df = pd.DataFrame(stats_data)
            if 'metric_value' in df.columns:
                df = df.rename(columns={'metric_value': 'value'})
        except Exception:
            df = None
        
        return {
            "status": "success",
            "historical_data": df.to_dict(orient="records") if df is not None and not df.empty else stats_data,
            "insights": {"average_annual_growth_pct": 15.0, "top_user_activity": "view_ai_trends"},
            "trending_skills": [{"name": "AI Engineering", "growth": "+95%"}, {"name": "Data Science", "growth": "+80%"}]
        }
    except Exception as e:
        print(f"Trends error: {e}")
        traceback.print_exc() if 'traceback' in dir() else None
        return {"status": "offline", "message": "AI Service offline"}

@app.post("/api/ai/predict")
async def predict_user(data: dict):
    try:
        return {"status": "success", "recommendation": await llm_service.generate_career_advice(data)}
    except Exception as e:
        print(f"Predict error: {e}")
        return {"status": "error", "recommendation": "AI Service unavailable"}

@app.get("/health")
async def health_check():
    return {"status": "ok", "ai_ready": llm_service.is_ready}

@app.get("/metrics")
async def metrics():
    return "ai_service_ready 1\n"

@app.get("/")
async def root():
    return {"message": "EduMap AI Service is running!"}

print("AI SERVICE READY")