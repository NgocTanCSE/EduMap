
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/api/ai/learning-space", tags=["13. AI Learning Space Recommender"])


class LearnSpot(BaseModel):
    id: Optional[str] = None
    name: str
    type: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    has_wifi: Optional[bool] = True
    has_power_outlets: Optional[bool] = True
    rating_avg: Optional[float] = 0
    quietness: Optional[int] = None
    amenities: List[str] = Field(default_factory=list)
    opening_hours: Optional[Dict[str, Any]] = None
    total_capacity: Optional[int] = 50
    distance_km: Optional[float] = None
    open_now: Optional[bool] = None
    matching_criteria: Dict[str, float] = Field(default_factory=dict)


class ExplainRequest(BaseModel):
    spot: LearnSpot
    preferences: Dict[str, Any] = Field(default_factory=dict)


class ExplainResponse(BaseModel):
    explanation: str
    degraded: bool = False
    reason: Optional[str] = None


@router.post("/explain", response_model=ExplainResponse)
async def explain_learning_space(data: ExplainRequest):
    """Generate an explanation for why a learning spot was recommended.

    24h cache is handled inside the LLM service. Falls back to a static
    template if the AI service / all providers are unavailable — the endpoint
    never 500s for a normal request.
    """
    from services.llm_service import llm_service
    if not llm_service:

        from services.llm_service import LLMService


        spot = data.spot
        dist = spot.distance_km or 0
        explanation = (
            f"{spot.name} được đề xuất vì gần bạn ({dist} km) và phù hợp với "
            f"tiêu chí tìm kiếm."
        )
        return ExplainResponse(
            explanation=explanation,
            degraded=True,
            reason="AI service chưa được khởi tạo — sử dụng mẫu giải thích tĩnh.",
        )

    try:
        result = await llm_service.explain_learning_space_recommendation(
            data.spot.model_dump(),
            data.preferences,
        )


        return ExplainResponse(
            explanation=result.get("explanation", ""),
            degraded=bool(result.get("degraded", False) or result.get("_degraded", False)),
            reason=result.get("reason"),
        )
    except Exception as e:
        print(f"[learning_space.explain] error: {e}")

        spot = data.spot
        return ExplainResponse(
            explanation=f"{spot.name} được đề xuất vì phù hợp với tiêu chí tìm kiếm của bạn. (Lỗi hệ thống, dùng mẫu tĩnh.)",
            degraded=True,
            reason=f"Lỗi hệ thống ({str(e)[:150]})",
        )
