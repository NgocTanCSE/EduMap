from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from models.career_models import CareerAnalysisRequest

router = APIRouter(prefix="/api/ai/career", tags=["2. Career Recommendation"])

class RecommendedCareer(BaseModel):
    title: str
    match_score: int
    explanation: str
    missing_skills: List[str]

class CareerRecommendationResponse(BaseModel):
    user_id: str
    top_careers: List[RecommendedCareer]
    degraded: Optional[bool] = False
    reason: Optional[str] = None

class SemanticCareerRequest(BaseModel):
    skills: List[str] = []
    interests: Optional[List[str]] = []
    experience_level: Optional[str] = "beginner"
    user_id: Optional[str] = None

class SemanticCareerRecommendation(BaseModel):
    title: str
    match_score: int
    explanation: str
    missing_skills: List[str]
    demand_level: Optional[str] = None
    radar_chart: Optional[dict] = None

class SemanticCareerResponse(BaseModel):
    user_id: Optional[str]
    top_careers: List[SemanticCareerRecommendation]
    degraded: Optional[bool] = False
    reason: Optional[str] = None
    source: Optional[str] = None

@router.post("/recommend", response_model=CareerRecommendationResponse)
async def recommend_career(data: CareerAnalysisRequest):
    from services.llm_service import llm_service
    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")

    try:
        ai_results = await llm_service.recommend_career(data)
        # Detect degraded fallback (fallback items carry _degraded markers)
        degraded = any(
            isinstance(item, dict) and item.get("_degraded", False)
            for item in ai_results
        )
        reason = next(
            (item.get("_reason", "") for item in ai_results
             if isinstance(item, dict) and "_reason" in item),
            None,
        )
        # Strip internal markers before constructing model objects
        clean = [
            {k: v for k, v in item.items() if k not in ("_degraded", "_reason")}
            for item in ai_results if item and isinstance(item, dict)
        ]
        top_careers = [RecommendedCareer(**item) for item in clean]
        return CareerRecommendationResponse(
            user_id=data.user_id,
            top_careers=top_careers,
            degraded=degraded,
            reason=reason,
        )
    except Exception as e:
        print(f"Error in recommend_career: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Lỗi đề xuất cánh hạn: {str(e)}")


@router.post("/recommend-semantic", response_model=SemanticCareerResponse)
async def recommend_career_semantic_endpoint(data: SemanticCareerRequest):
    """Semantic-vector career recommendation via ChromaDB (replaces if-else keyword matching).

    Uses cosine-similarity search in the `edumap_docs` ChromaDB collection instead
    of naive keyword overlap. Falls back to template recommendations when the vector
    store or all LLM providers are unavailable.
    """
    from services.llm_service import llm_service
    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")

    try:
        ai_results = await llm_service.recommend_career_semantic(
            skills=data.skills,
            interests=data.interests,
            experience_level=data.experience_level,
            user_id=data.user_id,
        )

        degraded = any(
            isinstance(item, dict) and item.get("_degraded", False)
            for item in ai_results
        )
        reason = next(
            (item.get("_reason", "") for item in ai_results
             if isinstance(item, dict) and "_reason" in item),
            None,
        )
        clean = [
            {k: v for k, v in item.items() if k not in ("_degraded", "_reason")}
            for item in ai_results if item and isinstance(item, dict)
        ]
        top_careers = [SemanticCareerRecommendation(**item) for item in clean]
        return SemanticCareerResponse(
            user_id=data.user_id,
            top_careers=top_careers,
            degraded=degraded,
            reason=reason,
            source="semantic-chroma" if not degraded else "fallback-template",
        )
    except Exception as e:
        print(f"Error in recommend_career_semantic: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Lỗi đề xuất semantic: {str(e)}")