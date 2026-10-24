import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from services.llm_service import llm_service


class ScholarshipCheckRequest(BaseModel):
    user_data: Optional[dict] = Field(None, description="Thông tin sinh viên/người dùng")
    scholarship_data: Optional[dict] = Field(None, description="Thông tin học bổng cần kiểm tra")


router = APIRouter(prefix="/api/ai/scholarship", tags=["AI Scholarship"])


def _parse_json_object(text: str) -> Optional[dict]:
    """Extract a JSON object from an LLM reply.

    LLMs often wrap JSON in ```json fences or add a sentence before/after it.
    Returns None when no object can be parsed so the caller can fall back to a
    valid eligibility payload instead of raising (which used to surface as a
    502 "Expecting value: line 1 column 1").
    """
    if not text:
        return None

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            parsed = json.loads(cleaned[start:end + 1])
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    return None


@router.post("/check")
async def check_scholarship_eligibility(data: ScholarshipCheckRequest):
    user_data = data.user_data or {}
    scholarship_data = data.scholarship_data or {}

    # Chỉ trả về kết quả THẬT từ AI — bỏ thông báo "xin chúc mừng" mẫu
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")

    try:
        prompt = f"""
        Bạn là chuyên gia tư vấn học bổng. Hãy đánh giá:
        - Người dùng: {user_data.get('full_name', 'Chưa cung cấp')}
        - Học bổng: {scholarship_data.get('title', 'Unknown')}
        Trả về JSON: {{"is_eligible": boolean, "message": string}}
        """
        response = await llm_service.chat_with_rag(prompt, [], {})
        reply = response.get("reply", "") if isinstance(response, dict) else str(response)

        result = _parse_json_object(reply)
        if result is None:
            # chat_with_rag falls back to a plain-text template when every LLM
            # provider is unreachable. That is not an error — return a valid
            # eligibility payload so the UI can render a message instead of a
            # 502 from this endpoint.
            return {
                "is_eligible": False,
                "message": (reply.strip() or "Không thể đánh giá tự động lúc này. Vui lòng thử lại sau.")[:1000],
            }

        result.setdefault("is_eligible", False)
        result.setdefault("message", "Không thể đánh giá tự động lúc này.")
        return result
    except Exception as e:
        print(f"Scholarship check error: {e}")
        raise HTTPException(status_code=502, detail=f"Lỗi đánh giá học bổng: {str(e)}")
