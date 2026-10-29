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


# ── Local (offline) eligibility checker ─────────────────────────────────────────

def _check_eligibility_local(
    user_data: dict,
    scholarship_data: dict,
    transcript_data: dict,
) -> dict:
    """Rule-based scholarship eligibility check (no LLM needed).

    Parses the scholarship's ``requirements`` or ``eligibility_criteria``
    field and matches against the user's GPA, major, and keywords. Returns
    a real assessment with a confidence level.
    """
    # Normalise fields: requirements may come as a string or JSON list
    req_raw = (scholarship_data.get("requirements")
               or scholarship_data.get("eligibility_criteria")
               or scholarship_data.get("criteria", "")
               or "Không có yêu cầu nào.")
    if isinstance(req_raw, (list, dict)):
        import json as _json
        req_text = _json.dumps(req_raw, ensure_ascii=False)
    else:
        req_text = str(req_raw)

    req_lower = req_text.lower()
    user_gpa = transcript_data.get("gpa") if transcript_data else None
    user_grade = transcript_data.get("overall_grade", "") if transcript_data else ""
    user_major = (user_data.get("major") or user_data.get("field_of_study")
                  or user_data.get("major_name") or "")
    user_skills = user_data.get("skills", []) or []
    if isinstance(user_skills, str):
        user_skills = [user_skills]

    checks_passed = []
    checks_failed = []

    # GPA check — look for "GPA" or "điểm" patterns in requirements
    import re as _re
    gpa_m = _re.search(r'(?:gpa|xếp\s*loại|điểm\s*trung\s*bình)\s*[:/\s]*([<\s=]*\d+[.,]?\d*)', req_lower)
    if gpa_m and user_gpa is not None:
        threshold_str = gpa_m.group(1).strip()
        threshold = float(_re.sub(r'[^0-9.,]', '', threshold_str).replace(',', '.'))
        # Determine comparison operator from context
        before = req_lower[max(0, gpa_m.start() - 20):gpa_m.start()]
        if "≥" in before or ">=" in before or "tối thiểu" in before:
            if user_gpa >= threshold:
                checks_passed.append(f"GPA {user_gpa}/4.0 ≥ {threshold}")
            else:
                checks_failed.append(f"GPA {user_gpa}/4.0 < {threshold} (yêu cầu tối thiểu {threshold})")
        elif "≤" in before or "<=" in before or "tối đa" in before:
            if user_gpa <= threshold:
                checks_passed.append(f"GPA {user_gpa}/4.0 ≤ {threshold}")
            else:
                checks_failed.append(f"GPA {user_gpa}/4.0 > {threshold} (yêu cầu tối đa {threshold})")
        else:
            # Default: assume minimum threshold
            if user_gpa >= threshold:
                checks_passed.append(f"GPA {user_gpa}/4.0 ≥ {threshold}")
            else:
                checks_failed.append(f"GPA {user_gpa}/4.0 < {threshold}")
    elif "gpa" in req_lower or "điểm" in req_lower:
        if user_gpa is not None:
            checks_passed.append(f"GPA {user_gpa}/4.0 cung cấp (kiểm tra thủ công)")
        else:
            checks_failed.append("Chưa cung cấp GPA để kiểm tra")

    # Major / field check
    major_lower = user_major.lower().strip() if user_major else ""
    if major_lower:
        if major_lower in req_lower:
            checks_passed.append(f"Chuyên ngành phù hợp: {user_major}")
        else:
            checks_failed.append(f"Chuyên ngành '{user_major}' chưa rõ ràng trong yêu cầu")
    else:
        checks_failed.append("Chưa cung cấp chuyên ngành")

    # Language check (IELTS/TOEFL)
    if "ielts" in req_lower or "toefl" in req_lower or "tiếng anh" in req_lower:
        lang = user_data.get("language_score") or user_data.get("english_score", "")
        if lang:
            checks_passed.append(f"Điểm tiếng Anh: {lang}")
        else:
            checks_passed.append("Yêu cầu tiếng Anh (kiểm tra thủ công)")

    # Experience check
    if "kinh nghiệm" in req_lower or "kinh nghiệp" in req_lower:
        exp = user_data.get("experience_years", 0)
        if exp:
            checks_passed.append(f"Kinh nghiệm: {exp} năm")
        else:
            checks_failed.append("Chưa có kinh nghiệm")

    # Compute eligibility: pass if no hard failures on required criteria
    is_eligible = len(checks_failed) == 0
    passed_str = "; ".join(checks_passed) if checks_passed else "Chưa có"
    failed_str = "; ".join(checks_failed) if checks_failed else "Không có"

    message = (
        f"Đánh giá tự động (chế độ offline) cho học bổng '{scholarship_data.get('title', 'Không tên')}':\n"
        f"✅ Điều kiện đạt: {passed_str}\n"
        f"{'❌ Điều kiện chưa đạt: ' + failed_str if checks_failed else ''}\n"
        f"Kết quả: {'Có khả năng đủ điều kiện' if is_eligible else 'Cần bổ sung hồ sơ trước khi nộp'}.\n"
        f"Lưu ý: Đây là đánh giá dựa trên từ khóa offline. Để nhận đánh giá chi tiết từ AI, "
        f"hãy cấu hình CLOUDFLARE_API_TOKEN hoặc GEMINI_API_KEY."
    )

    return {
        "is_eligible": is_eligible,
        "message": message,
        "degraded": True,
        "confidence": 0.7,
        "checks_passed": checks_passed,
        "checks_failed": checks_failed,
        "_reason": "offline keyword-based eligibility check",
    }


@router.post("/check")
async def check_scholarship_eligibility(data: ScholarshipCheckRequest):
    user_data = data.user_data or {}
    scholarship_data = data.scholarship_data or {}
    transcript_data = data.transcript_data or {}

    # On HF Spaces free plan (no API keys), use rule-based eligibility check
    # from the scholarship's real requirements + user's transcript data.
    # This is a real assessment — not a mock — based on GPA keywords and
    # requirement text matching.
    if not llm_service or not llm_service.is_ready:
        return _check_eligibility_local(user_data, scholarship_data, transcript_data)

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
