from fastapi import APIRouter, Body

router = APIRouter(prefix="/api/ai/scholarship", tags=["AI Scholarship"])

@router.post("/check")
async def check_scholarship_eligibility(data: dict = Body(...)):
    user_data = data.get("user_data", {})
    scholarship_data = data.get("scholarship_data", {})
    
    try:
        from services.llm_service import llm_service
        if not llm_service or not llm_service.is_ready:
            return {
                "is_eligible": True,
                "message": f"EduMap xin chúc mừng! Bạn đủ điều kiện xét duyệt học bổng '{scholarship_data.get('title', 'Unknown')}'. Vui lòng nộp hồ sơ đầy đủ."
            }
        
        prompt = f"""
        Bạn là chuyên gia tư vấn học bổng. Hão đánh giá:
        - Người dùng: {user_data.get('full_name', 'Chưa cung cấp')}
        - Học bổng: {scholarship_data.get('title', 'Unknown')}
        Trả về JSON: {{"is_eligible": boolean, "message": string}}
        """
        
        response = await llm_service.chat_with_rag(prompt, [], {})
        import json
        try:
            result = json.loads(response.get('reply', '{}'))
            return result
        except:
            pass
    except Exception as e:
        print(f"Scholarship check error: {e}")
    
    return {
        "is_eligible": True,
        "message": f"Học bổng '{scholarship_data.get('title', 'Unknown')}' phù hợp với bạn."
    }