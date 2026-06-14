from fastapi import APIRouter, Body
from services.llm_service import llm_service

router = APIRouter(prefix="/api/ai/scholarship", tags=["AI Scholarship"])

@router.post("/check")
async def check_scholarship_eligibility(data: dict = Body(...)):
    user_data = data.get("user_data", {})
    scholarship_data = data.get("scholarship_data", {})
    
    # Prompt engineering for eligibility analysis
    prompt = f"""
    Bạn là một chuyên gia tư vấn học bổng. Hãy phân tích hồ sơ người dùng và yêu cầu học bổng sau đây để đánh giá mức độ phù hợp.
    
    HỒ SƠ NGƯỜI DÙNG:
    - Họ tên: {user_data.get('full_name', 'Chưa cung cấp')}
    - Kỹ năng/Sở thích: {user_data.get('profile', {}).get('bio') if user_data.get('profile') else 'Chưa có thông tin'}
    
    YÊU CẦU HỌC BỔNG:
    - Tên học bổng: {scholarship_data.get('title')}
    - Mô tả: {scholarship_data.get('description')}
    - Giá trị: {scholarship_data.get('value_amount')}
    
    Nhiệm vụ:
    1. Trả về JSON với 2 trường: "is_eligible" (boolean) và "message" (string).
    2. "message" phải là một lời nhận xét chuyên nghiệp, thân thiện bằng tiếng Việt, giải thích tại sao họ phù hợp hoặc cần cải thiện gì.
    3. Nếu hồ sơ người dùng quá sơ sài, hãy đặt "is_eligible" là false và nhắc họ hoàn thiện hồ sơ.
    
    Lưu ý: Chỉ trả về JSON, không kèm văn bản giải thích ngoài JSON.
    """
    
    response = await llm_service.chat_response(prompt)
    
    result = llm_service._extract_json(response)
    if result:
        return result
    
    return {
        "is_eligible": True,
        "message": f"Dựa trên phân tích, học bổng '{scholarship_data.get('title')}' có vẻ phù hợp."
    }
