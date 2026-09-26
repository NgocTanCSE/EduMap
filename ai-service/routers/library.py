from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/ai/library", tags=["9. AI Library Assistant"])

class KeyConcept(BaseModel):
    concept: str
    explanation: str

class MaterialSummaryResponse(BaseModel):
    summary: str
    key_concepts: List[KeyConcept] = []
    study_tips: List[str] = []

@router.post("/summarize")
async def summarize_material(request_data: dict):
    # Chỉ trả về tóm tắt THẬT từ AI — bỏ fallback thông điệp "bảo trì"/"lỗi" mẫu
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")

    class FakeRequest:
        title = request_data.get('title', '')
        description = request_data.get('description', '')
        category = request_data.get('category', '')
        tags = request_data.get('tags', [])
        type = request_data.get('type', '')

    try:
        analysis = await llm_service.summarize_material(FakeRequest())
        if analysis:
            return analysis
        raise HTTPException(status_code=502, detail="AI trả về kết quả tóm tắt không hợp lệ.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in summarize_material: {e}")
        raise HTTPException(status_code=502, detail=f"Lỗi tóm tắt tài liệu: {str(e)}")
