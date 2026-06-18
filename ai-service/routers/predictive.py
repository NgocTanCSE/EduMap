from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from services.predictive_service import predictive_service
from services.llm_service import llm_service

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
async def analyze_market_trends(request: TrendAnalysisRequest):
    """
    Phân tích xu hướng thị trường lao động dựa trên từ khóa.
    """
    try:
        # Tạo dữ liệu log mẫu từ từ khóa
        recent_logs = [{"keyword": kw} for kw in request.keywords]
        
        trends = predictive_service.analyze_trends(recent_logs)
        
        # Bổ sung phân tích AI
        ai_analysis = await llm_service.analyze_market_trends(request.keywords)
        
        return {
            "status": "success",
            "trends": trends,
            "ai_analysis": ai_analysis,
            "time_period": request.time_period
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/career-prediction")
async def predict_career_path(request: CareerPredictionRequest):
    """
    Dự báo lộ trình nghề nghiệp dựa trên kỹ năng và sở thích.
    """
    try:
        # Kết hợp kỹ năng và sở thích thành history
        user_history = request.skills + request.interests
        
        prediction = predictive_service.predict_career_path(user_history)
        
        # Bổ sung gợi ý AI chi tiết
        ai_suggestion = await llm_service.get_suggestions(
            skills=request.skills,
            interests=request.interests
        )
        
        return {
            "status": "success",
            "prediction": prediction,
            "ai_suggestion": ai_suggestion,
            "career_paths": [
                {
                    "title": "AI Engineer",
                    "match_score": 0.85,
                    "reason": "Dựa trên kỹ năng Python và sở thích"
                },
                {
                    "title": "Data Scientist",
                    "match_score": 0.78,
                    "reason": "Phù hợp với sở thích phân tích dữ liệu"
                },
                {
                    "title": "Full-stack Developer",
                    "match_score": 0.72,
                    "reason": "Có thể phát triển từ kỹ năng hiện có"
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/market-data")
async def get_market_data():
    """
    Lấy dữ liệu xu hướng thị trường hiện tại.
    """
    try:
        return {
            "status": "success",
            "market_trends": predictive_service.market_trends,
            "last_updated": "2026-06-15",
            "source": "EduMap Analytics"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
