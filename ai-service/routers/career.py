from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json

router = APIRouter(prefix="/api/ai/career", tags=["2. Career Recommendation"])

class RecommendedCareer(BaseModel):
    title: str
    match_score: int
    explanation: str
    missing_skills: List[str]

class CareerRecommendationResponse(BaseModel):
    user_id: str
    top_careers: List[RecommendedCareer]

@router.post("/recommend", response_model=CareerRecommendationResponse)
async def recommend_career(request_data: dict):
    # Chỉ trả về dữ liệu THẬT từ AI — bỏ mọi danh sách career mẫu fallback
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")

    class FakeRequest:
        user_id = request_data.get('user_id', '')
        full_name = request_data.get('full_name', '')
        mbti_type = request_data.get('mbti_type', '')
        skills = request_data.get('skills', [])
        career_aspirations = request_data.get('career_aspirations', [])
        holland_code = request_data.get('holland_code', '')
        def json(self):
            return json.dumps(request_data, default=str)

    try:
        ai_results = await llm_service.recommend_career(FakeRequest())
        top_careers = [RecommendedCareer(**item) for item in ai_results if item and isinstance(item, dict)]
        return CareerRecommendationResponse(
            user_id=request_data.get('user_id', 'unknown'),
            top_careers=top_careers
        )
    except Exception as e:
        print(f"Error in recommend_career: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Lỗi đề xuất cánh hạn: {str(e)}")
