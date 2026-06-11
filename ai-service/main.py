from fastapi import FastAPI, Body
from services.llm_service import llm_service
from routers import analytics, career, geo, learning_path, mentor, moderation, search, library, scholarship, chat, suggestions

app = FastAPI(title="EduMap AI Service")

# Include Routers
app.include_router(chat.router, prefix="/api/ai")
app.include_router(suggestions.router, prefix="/api/ai")
app.include_router(analytics.router)
app.include_router(career.router)
app.include_router(geo.router)
app.include_router(learning_path.router)
app.include_router(mentor.router)
app.include_router(moderation.router)
app.include_router(search.router)
app.include_router(library.router)
app.include_router(scholarship.router)

@app.get("/api/ai/trends")
async def get_trends():
    mock_market_logs = [{"keyword": "AI"}, {"keyword": "Industrial"}]
    return await llm_service.analyze_market_trends(mock_market_logs)

@app.post("/api/ai/predict")
async def predict_user(data: dict = Body(...)):
    prediction = await llm_service.generate_career_advice(data)
    return {
        "status": "success",
        "recommendation": prediction
    }

@app.get("/health")
async def health_check():
    return {"status": "ok", "ai_ready": llm_service.is_ready}

@app.get("/metrics")
async def metrics():
    return "# HELP ai_service_ready AI Service Readiness\n# TYPE ai_service_ready gauge\nai_service_ready 1\n"

@app.get("/")
async def root():
    return {"message": "EduMap AI Service is running with Gemini Pro Engine!"}
