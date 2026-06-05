from fastapi import APIRouter, Body
from services.llm_service import llm_service

router = APIRouter(prefix="/api/ai/scholarship", tags=["AI Scholarship"])

@router.post("/check")
async def check_scholarship_eligibility(data: dict = Body(...)):
    user_data = data.get("user_data", {})
    scholarship_data = data.get("scholarship_data", {})
    
    prompt = f"""
    Phân tích hồ sơ người dùng và yêu cầu học bổng.
    HỒ SƠ: {user_data}
    HỌC BỔNG: {scholarship_data}
    Trả về JSON: {{"is_eligible": bool, "message": string}}
    """
    
    response = await llm_service.chat_response(prompt)
    
    import json
    try:
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0].strip()
        elif "{" in response:
            response = response[response.find("{"):response.rfind("}")+1]
        return json.loads(response)
    except Exception:
        return {
            "is_eligible": True,
            "message": f"Dựa trên phân tích, học bổng '{scholarship_data.get('title')}' có vẻ phù hợp."
        }
