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

@router.post("/summarize")
async def summarize_material(data: MaterialSummaryRequest):
    # Chỉ trả về tóm tắt THẬT từ AI — bỏ fallback thông điệp "bảo trì"/"lỗi" mẫu
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")

    try:
        analysis = await llm_service.summarize_material(data)
        if analysis:
            return analysis
        raise HTTPException(status_code=502, detail="AI trả về kết quả tóm tắt không hợp lệ.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in summarize_material: {e}")
        raise HTTPException(status_code=502, detail=f"Lỗi tóm tắt tài liệu: {str(e)}")
