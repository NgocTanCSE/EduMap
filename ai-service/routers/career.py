from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

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
    try:
        from services.llm_service import llm_service
        
        if not llm_service or not llm_service.is_ready:
            default_careers = [
                {"title": "AI Engineer", "match_score": 85, "explanation": "Xu hướng tuyển dụng cao", "missing_skills": []},
                {"title": "Data Analyst", "match_score": 75, "explanation": "Cơ hội việc làm phong phú", "missing_skills": []},
                {"title": "Web Developer", "match_score": 70, "explanation": "Kỹ năng đa dạng", "missing_skills": []}
            ]
            return CareerRecommendationResponse(
                user_id=request_data.get('user_id', 'unknown'),
                top_careers=[RecommendedCareer(**c) for c in default_careers]
            )
        
        class FakeRequest:
            user_id = request_data.get('user_id', '')
            full_name = request_data.get('full_name', '')
            mbti_type = request_data.get('mbti_type', '')
            skills = request_data.get('skills', [])
            career_aspirations = request_data.get('career_aspirations', [])
            holland_code = request_data.get('holland_code', '')
            json = lambda self: request_data
        
        ai_results = await llm_service.recommend_career(FakeRequest())
        
        top_careers = [RecommendedCareer(**item) for item in ai_results if item]
        return CareerRecommendationResponse(
            user_id=request_data.get('user_id', 'unknown'),
            top_careers=top_careers
        )
    except Exception as e:
        print(f"Error in recommend_career: {str(e)}")
        return CareerRecommendationResponse(
            user_id=request_data.get('user_id', 'unknown'),
            top_careers=[{"title": "N/A", "match_score": 0, "explanation": "Lỗi hệ thống", "missing_skills": []}]
        )