from datetime import date as _date
from fastapi import APIRouter, HTTPException
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
            "time_period": request_data.time_period or "30d"
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

        prediction = predictive_service.predict_career_path(user_history)

        ai_suggestion = []
        try:
            if llm_service and llm_service.is_ready:
                ai_suggestion = await llm_service.get_suggestions()
        except Exception as e:
            print(f"AI suggestion error: {e}")

        return {
            "status": "success",
            "prediction": prediction,
            "ai_suggestion": ai_suggestion
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in predictive/career-prediction: {e}")
        raise HTTPException(status_code=503, detail="Không dự đoán được lộ trình nghề nghiệp.")

@router.get("/market-data")
async def get_market_data():
    try:
        from services.predictive_service import predictive_service
        return {
            "status": "success",
            "market_trends": predictive_service.get_market_trends(),
            "last_updated": _date.today().isoformat(),
            "source": "EduMap Analytics"
        }
    except Exception as e:
        print(f"Error in predictive/market-data: {e}")
        raise HTTPException(status_code=503, detail="Không lấy được dữ liệu thị trường.")
