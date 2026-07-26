from fastapi import APIRouter
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
    try:
        from services.llm_service import llm_service
        if not llm_service or not llm_service.is_ready:
            return MaterialSummaryResponse(
                summary="AI trợ lý thư viện đang bảo trì.",
                key_concepts=[KeyConcept(concept="Tài liệu", explanation="Xin vui lòng quay lại sau.")],
                study_tips=["Liên hệ bộ phận hỗ trợ."]
            ).dict()
        
        class FakeRequest:
            title = request_data.get('title', '')
            description = request_data.get('description', '')
            category = request_data.get('category', '')
            tags = request_data.get('tags', [])
            type = request_data.get('type', '')
            
        analysis = await llm_service.summarize_material(FakeRequest())
        if analysis:
            return analysis
        return MaterialSummaryResponse(summary="Không thể tóm tắt tài liệu.", key_concepts=[], study_tips=[]).dict()
    except Exception as e:
        print(f"Error in summarize_material: {e}")
        return MaterialSummaryResponse(summary="Lỗi xử lý tài liệu.", key_concepts=[], study_tips=[]).dict()