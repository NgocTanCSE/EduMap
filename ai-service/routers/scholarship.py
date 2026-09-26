from fastapi import APIRouter, Body, HTTPException
from services.llm_service import llm_service

router = APIRouter(prefix="/api/ai/scholarship", tags=["AI Scholarship"])

@router.post("/check")
async def check_scholarship_eligibility(data: dict = Body(...)):
    user_data = data.get("user_data", {})
    scholarship_data = data.get("scholarship_data", {})

    # Chỉ trả về kết quả THẬT từ AI — bỏ thông báo "xin chúc mừng" mẫu
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình OPENROUTER_API_KEY.")

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
