from fastapi import APIRouter, HTTPException
from models.library_models import MaterialSummaryRequest, MaterialSummaryResponse
from services.llm_service import LLMService

router = APIRouter(prefix="/api/ai/library", tags=["9. AI Library Assistant"])
llm_service = LLMService()

@router.post("/summarize", response_model=MaterialSummaryResponse)
async def summarize_material(request: MaterialSummaryRequest):
    """
    AI sinh tóm tắt và khái niệm chính cho tài liệu học tập dựa trên metadata.
    """
    try:
        analysis = await llm_service.summarize_material(request)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
