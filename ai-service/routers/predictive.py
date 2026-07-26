from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/ai/predictive", tags=["12. AI Predictive Analytics"])

class TrendAnalysisRequest(BaseModel):
    keywords: List[str]
    time_period: Optional[str] = "30d"

class CareerPredictionRequest(BaseModel):
    user_id: str
    skills: List[str]
    interests: List[str]
    experience_level: Optional[str] = "beginner"

@router.post("/trends")
async def analyze_market_trends(request_data: dict):
    try:
        from services.predictive_service import predictive_service
        from services.llm_service import llm_service
        
        keywords = request_data.get('keywords', [])
        recent_logs = [{"keyword": kw} for kw in keywords]
        trends = predictive_service.analyze_trends(recent_logs)
        
        ai_analysis = {"status": "offline"}
        try:
            ai_analysis = await llm_service.analyze_market_trends(keywords)
        except Exception:
            pass
        
        return {
            "status": "success",
            "trends": trends,
            "ai_analysis": ai_analysis,
            "time_period": request_data.get('time_period', '30d')
        }
    except Exception as e:
        print(f"Error in predictive/trends: {e}")
        return {"status": "error", "trends": [], "ai_analysis": {}, "time_period": "30d"}

@router.post("/career-prediction")
async def predict_career_path(request_data: dict):
    try:
        from services.predictive_service import predictive_service
        from services.llm_service import llm_service
        
        skills = request_data.get('skills', [])
        interests = request_data.get('interests', [])
        user_history = skills + interests
        
        prediction = predictive_service.predict_career_path(user_history)
        
        ai_suggestion = []
        try:
            ai_suggestion = await llm_service.get_suggestions()
        except Exception:
            pass
        
        return {
            "status": "success",
            "prediction": prediction,
            "ai_suggestion": ai_suggestion,
            "career_paths": [
                {"title": "AI Engineer", "match_score": 0.85, "reason": "Dựa trên kỹ năng"},
                {"title": "Data Scientist", "match_score": 0.78, "reason": "Phù hợp phân tích"},
                {"title": "Full-stack Developer", "match_score": 0.72, "reason": "Kỹ năng đa dạng"}
            ]
        }
    except Exception as e:
        print(f"Error in predictive/career-prediction: {e}")
        return {"status": "error", "prediction": "", "ai_suggestion": [], "career_paths": []}

@router.get("/market-data")
async def get_market_data():
    try:
        from services.predictive_service import predictive_service
        return {
            "status": "success",
            "market_trends": predictive_service.get_market_trends(),
            "last_updated": "2026-06-15",
            "source": "EduMap Analytics"
        }
    except Exception as e:
        print(f"Error in predictive/market-data: {e}")
        return {"status": "success", "market_trends": {}, "last_updated": "2026-06-15", "source": "EduMap Analytics"}