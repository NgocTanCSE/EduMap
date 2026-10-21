from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from services.llm_service import llm_service


class ScholarshipCheckRequest(BaseModel):
    user_data: Optional[dict] = Field(None, description="Thông tin sinh viên/người dùng")
    scholarship_data: Optional[dict] = Field(None, description="Thông tin học bổng cần kiểm tra")


router = APIRouter(prefix="/api/ai/scholarship", tags=["AI Scholarship"])


@router.post("/check")
async def check_scholarship_eligibility(data: ScholarshipCheckRequest):
    user_data = data.user_data or {}
    scholarship_data = data.scholarship_data or {}

    # Chỉ trả về kết quả THẬT từ AI — bỏ thông báo "xin chúc mừng" mẫu
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")

    import json
    try:
        prompt = f"""
        Bạn là chuyên gia tư vấn học bổng. Hãy đánh giá:
        - Người dùng: {user_data.get('full_name', 'Chưa cung cấp')}
        - Học bổng: {scholarship_data.get('title', 'Unknown')}
        Trả về JSON: {{"is_eligible": boolean, "message": string}}
        """
        response = await llm_service.chat_with_rag(prompt, [], {})
        result = json.loads(response.get('reply', '{}'))
        return result
    except Exception as e:
        print(f"Scholarship check error: {e}")
        raise HTTPException(status_code=502, detail=f"Lỗi đánh giá học bổng: {str(e)}")
