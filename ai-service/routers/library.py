from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from models.library_models import MaterialSummaryRequest

router = APIRouter(prefix="/api/ai/library", tags=["9. AI Library Assistant"])

class KeyConcept(BaseModel):
    concept: str
    explanation: str

class MaterialSummaryResponse(BaseModel):
    summary: str
    key_concepts: List[KeyConcept] = []
    study_tips: List[str] = []
    degraded: Optional[bool] = False
    reason: Optional[str] = None

@router.post("/summarize")
async def summarize_material(data: MaterialSummaryRequest):
    from services.llm_service import llm_service
    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")

    try:
        analysis = await llm_service.summarize_material(data)
        if analysis:
            # Pass through degraded status if present
            degraded = analysis.pop("_degraded", False) if isinstance(analysis, dict) else False
            reason = analysis.pop("_reason", None) if isinstance(analysis, dict) else None
            # Re-wrap in the Pydantic model for clean output
            key_concepts = analysis.get("key_concepts", [])
            if key_concepts and not isinstance(key_concepts[0], dict):
                key_concepts = [{"concept": str(k), "explanation": ""} for k in key_concepts]
            return MaterialSummaryResponse(
                summary=analysis.get("summary", ""),
                key_concepts=key_concepts,
                study_tips=analysis.get("study_tips", []),
                degraded=degraded,
                reason=reason,
            ).dict()
        raise HTTPException(status_code=502, detail="AI trả về kết quả tóm tắt không hợp lệ.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in summarize_material: {e}")
        raise HTTPException(status_code=502, detail=f"Lỗi tóm tắt tài liệu: {str(e)}")