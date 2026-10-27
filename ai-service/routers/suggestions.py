from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/ai")

class SuggestionResponse(BaseModel):
    title: str
    description: str
    match_score: int

class SuggestionsResponse(BaseModel):
    suggestions: List[SuggestionResponse]
    degraded: Optional[bool] = False
    reason: Optional[str] = None

@router.get("/suggestions")
async def get_suggestions():
    from services.llm_service import llm_service
    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")
    try:
        result = await llm_service.get_suggestions()
        # Detect degraded fallback
        degraded = any(
            isinstance(item, dict) and item.get("_degraded", False)
            for item in result
        ) if isinstance(result, list) else False
        reason = next(
            (item.get("_reason", "") for item in result
             if isinstance(item, dict) and "_reason" in item),
            None,
        ) if isinstance(result, list) else None
        # Strip internal markers
        clean = [
            {k: v for k, v in item.items() if k not in ("_degraded", "_reason")}
            for item in result if item and isinstance(item, dict)
        ] if isinstance(result, list) else []
        return SuggestionsResponse(
            suggestions=clean,
            degraded=degraded,
            reason=reason,
        )
    except Exception as e:
        print(f"Error getting AI suggestions: {e}")
        raise HTTPException(status_code=502, detail=f"Lỗi khi lấy gợi ý AI: {str(e)}")