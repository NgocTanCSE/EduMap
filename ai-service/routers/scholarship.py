import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from services.llm_service import llm_service


class ScholarshipCheckRequest(BaseModel):
    user_data: Optional[dict] = Field(None, description="Thông tin sinh viên/người dùng")
    scholarship_data: Optional[dict] = Field(None, description="Thông tin học bổng cần kiểm tra")
    transcript_data: Optional[dict] = Field(None, description="Dữ liệu bảng điểm PDF (gpa, overall_grade, courses) — trích xuất từ PDF transcript")


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
    transcript_data = data.transcript_data or {}

    # Chỉ trả về kết quả THẬT từ AI — nếu chưa có provider, trả về degraded 200
    # thay vì 503 (per AGENTS.md "never 502s/503s" graceful-degradation policy).
    if not llm_service or not llm_service.is_ready:
        return {
            "is_eligible": False,
            "message": "Hiện dịch vụ AI chưa sẵn sàng để đánh giá tự động. "
                       "Vui lòng kiểm tra điều kiện học bổng và liên hệ phòng tư vấn.",
            "degraded": True,
        }

    try:
        gpa_info = ""
        if transcript_data:
            gpa = transcript_data.get('gpa')
            grade = transcript_data.get('overall_grade')
            courses = transcript_data.get('courses', [])
            if gpa:
                gpa_info = f"\nĐiểm GPA từ bảng điểm PDF: {gpa}/4.0 (xếp loại: {grade or 'N/A'}, {len(courses)} môn học)."
            elif grade:
                gpa_info = f"\nXếp loại từ bảng điểm PDF: {grade} ({len(courses)} môn học)."

        prompt = f"""
        Bạn là chuyên gia tư vấn học bổng. Hãy đánh giá:
        - Người dùng: {user_data.get('full_name', 'Chưa cung cấp')}
        - Học bổng: {scholarship_data.get('title', 'Unknown')}
        - Yêu cầu: {scholarship_data.get('requirements', 'Không có')}{gpa_info}
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
