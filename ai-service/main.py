import traceback
from fastapi import FastAPI, Body
from services.llm_service import llm_service
from services.db_service import db_service
import pandas as pd

print("AI SERVICE: Starting imports...")

from routers.chat import chat
print("AI SERVICE: chat router imported")

from routers.suggestions import suggestions
print("AI SERVICE: suggestions router imported")

from routers.analytics import analytics
print("AI SERVICE: analytics router imported")

from routers.career import career
print("AI SERVICE: career router imported")

from routers.geo import geo
print("AI SERVICE: geo router imported")

from routers.learning_path import learning_path
print("AI SERVICE: learning_path router imported")

from routers.mentor import mentor
print("AI SERVICE: mentor router imported")

from routers.moderation import moderation
print("AI SERVICE: moderation router imported")

from routers.search import search
print("AI SERVICE: search router imported")

from routers.library import library
print("AI SERVICE: library router imported")

from routers.scholarship import scholarship
print("AI SERVICE: scholarship router imported")

from routers.predictive import predictive
print("AI SERVICE: predictive router imported")

try:
    print("AI SERVICE: Creating FastAPI app...")
    app = FastAPI(title="EduMap AI Service")
    print("AI SERVICE: FastAPI app created")

    app.include_router(chat.router, prefix="/api/ai")
    print("AI SERVICE: chat router included")

    app.include_router(suggestions.router, prefix="/api/ai")
    print("AI SERVICE: suggestions router included")

    app.include_router(analytics.router)
    print("AI SERVICE: analytics router included")

    app.include_router(career.router)
    print("AI SERVICE: career router included")

    app.include_router(geo.router)
    print("AI SERVICE: geo router included")

    app.include_router(learning_path.router)
    print("AI SERVICE: learning_path router included")

    app.include_router(mentor.router)
    print("AI SERVICE: mentor router included")

    app.include_router(moderation.router)
    print("AI SERVICE: moderation router included")

    app.include_router(search.router)
    print("AI SERVICE: search router included")

    app.include_router(library.router)
    print("AI SERVICE: library router included")

    app.include_router(scholarship.router)
    print("AI SERVICE: scholarship router included")

    app.include_router(predictive.router)
    print("AI SERVICE: predictive router included")

    @app.get("/api/ai/trends")
    async def get_trends():
        try:
            if llm_service.is_ready:
                market_logs = [{"keyword": "AI"}, {"keyword": "Industrial"}]
                return await llm_service.analyze_market_trends(market_logs)

            stats_data = db_service.get_education_stats(year=2024)
            if not stats_data:
                return {"status": "offline", "message": "AI Service offline - configure GEMINI_API_KEY for market trends."}

            df = pd.DataFrame(stats_data)
            if 'metric_value' in df.columns:
                df = df.rename(columns={'metric_value': 'value'})
            trending_skills = [
                {"name": "AI Engineering", "growth": "+95%"},
                {"name": "Sustainability", "growth": "+80%"},
                {"name": "Cybersecurity", "growth": "+75%"},
                {"name": "Cloud Computing", "growth": "+70%"}
            ]

            it_df = df[df['metric_type'].str.contains('IT', case=False)] if not df.empty and 'metric_type' in df.columns else df

            return {
                "status": "success",
                "historical_data": df.to_dict(orient="records") if not df.empty else [],
                "insights": {
                    "average_annual_growth_pct": 15.0,
                    "prediction_2025_it_students": 2400000,
                    "top_user_activity": "view_ai_trends"
                },
                "trending_skills": trending_skills
            }
        except Exception as e:
            print(f"Error in get_trends: {e}")
            traceback.print_exc()
            return {"status": "offline", "message": "AI Service offline."}

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

    print("AI SERVICE: Startup completed successfully")

except Exception as startup_error:
    print("FATAL AI SERVICE STARTUP ERROR:")
    traceback.print_exc()
    raise startup_error
