"""Router for /api/ai/predictive/* endpoints.

Synced with analytics.py's Holt's Linear Exponential Smoothing approach:
- /trends      → uses real education_stats + Holt's forecast (via predictive_service.analyze_trends)
- /career-prediction → uses time-series forecasting + skill matching (via predictive_service.predict_career_path)
- /market-data → returns real trend data with Holt's forecasts (via predictive_service.get_market_trends)
"""

from datetime import date as _date
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional

router = APIRouter(prefix="/api/ai/predictive", tags=["12. AI Predictive Analytics"])

class TrendAnalysisRequest(BaseModel):
    # Defaults keep backward-compat with clients that send a partial/empty body
    # (the old `dict` handler tolerated missing fields with .get(..., default)).
    keywords: List[str] = Field(default_factory=list)
    time_period: Optional[str] = "30d"

class CareerPredictionRequest(BaseModel):
    user_id: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    experience_level: Optional[str] = "beginner"

@router.post("/trends")
async def analyze_market_trends(request_data: TrendAnalysisRequest):
    try:
        from services.predictive_service import predictive_service
        from services.llm_service import llm_service

        keywords = request_data.keywords
        recent_logs = [{"keyword": kw} for kw in keywords]

        # analyze_trends now uses real education_stats data with Holt's Linear
        # Exponential Smoothing, synced with analytics.py
        trends = predictive_service.analyze_trends(recent_logs)

        ai_analysis = None
        try:
            if llm_service and llm_service.is_ready:
                ai_analysis = await llm_service.analyze_market_trends(keywords)
        except Exception as e:
            print(f"AI trends error: {e}")

        return {
            "status": "success",
            "trends": trends,
            "ai_analysis": ai_analysis,
            "time_period": request_data.time_period or "30d",
            "method": "holt_linear_exponential_smoothing"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in predictive/trends: {e}")
        raise HTTPException(status_code=503, detail="Không phân tích được xu hướng.")

@router.post("/career-prediction")
async def predict_career_path(request_data: CareerPredictionRequest):
    try:
        from services.predictive_service import predictive_service
        from services.llm_service import llm_service

        skills = request_data.skills
        interests = request_data.interests
        user_history = skills + interests

        # predict_career_path now uses Holt's time-series forecasting
        # instead of if-else keyword matching, synced with analytics.py
        prediction = predictive_service.predict_career_path(user_history)

        ai_suggestion = []
        try:
            if llm_service and llm_service.is_ready:
                ai_suggestion = await llm_service.get_suggestions()
        except Exception as e:
            print(f"AI suggestion error: {e}")

        return {
            "status": prediction.get("status", "success"),
            "prediction": prediction,
            "ai_suggestion": ai_suggestion,
            "method": "holt_linear_exponential_smoothing"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in predictive/career-prediction: {e}")
        raise HTTPException(status_code=503, detail="Không dự đoán được lộ trình nghề nghiệp.")

@router.get("/market-data")
async def get_market_data(steps: int = Query(default=3, ge=1, le=10, description="Số năm dự báo tới")):
    try:
        from services.predictive_service import predictive_service
        trends = predictive_service.get_market_trends(steps_ahead=steps)

        return {
            "status": trends.get("status", "success"),
            "market_trends": trends,
            "last_updated": _date.today().isoformat(),
            "source": "EduMap Analytics — Holt's Linear Exponential Smoothing",
            "method": "holt_linear_exponential_smoothing",
        }
    except Exception as e:
        print(f"Error in predictive/market-data: {e}")
        raise HTTPException(status_code=503, detail="Không lấy được dữ liệu thị trường.")
