from fastapi import APIRouter, HTTPException
from models.career_models import CareerQuizRequest, CareerRecommendationResponse, RecommendedCareer
from services.llm_service import LLMService

router = APIRouter(prefix="/api/ai/career", tags=["2. Career Recommendation"])
llm_service = LLMService()

@router.post("/recommend", response_model=CareerRecommendationResponse)
async def recommend_career(request: CareerQuizRequest):
    try:
        # Gọi "bộ não" LLM phân tích hồ sơ
        ai_results = await llm_service.recommend_career(request)
        
        # Ánh xạ kết quả JSON của AI vào Pydantic Output Schema
        top_careers = []
        for item in ai_results:
            career = RecommendedCareer(
                title=item.get("title", "Unknown"),
                match_score=item.get("match_score", 0),
                explanation=item.get("explanation", ""),
                missing_skills=item.get("missing_skills", [])
            )
            top_careers.append(career)

        return CareerRecommendationResponse(
            user_id=request.user_id,
            top_careers=top_careers
        )

    except Exception as e:
        print(f"Error in recommend_career: {str(e)}")
        raise HTTPException(status_code=500, detail="Lỗi khi phân tích nghề nghiệp bằng AI.")
