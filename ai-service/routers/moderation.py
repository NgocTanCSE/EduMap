from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import re
from services.llm_service import llm_service

router = APIRouter(prefix="/api/ai/moderate", tags=["7. AI Content Moderation"])

class ContentRequest(BaseModel):
    user_id: str
    text: str

class ModerationResult(BaseModel):
    status: str
    is_safe: bool
    confidence: float
    flags: list
    action_taken: str

# Từ điển Regex cơ bản (Lọc siêu tốc ở Layer 1 — không phụ thuộc AI)
BAD_WORDS_PATTERN = re.compile(r'\b(chửi thều|đm|vkl|lừa đảo|đánh bạc)\b', re.IGNORECASE)
PHONE_PATTERN = re.compile(r'\b(0[3|5|7|8|9])+([0-9]{8})\b')

@router.post("/", response_model=ModerationResult)
async def moderate_content(request: ContentRequest):
    # Layer 1: lọc thực (regex) — chạy luôn, không cần AI
    flags = []
    if BAD_WORDS_PATTERN.search(request.text):
        flags.append("Profanity")
    if PHONE_PATTERN.search(request.text):
        flags.append("PII_Phone_Number")

    if flags:
        return ModerationResult(
            status="Processed via Regex",
            is_safe=False,
            confidence=1.0,
            flags=flags,
            action_taken="AUTO_REJECTED"
        )

    # Layer 2: phân tích ngữ nghĩa sâu (cần kết nối AI/Gemini)
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")

    try:
        ai_result = await llm_service.moderate_text(request.text)

        is_safe = ai_result.get("is_safe", False)
        confidence = float(ai_result.get("confidence", 0.0))
        ai_flags = ai_result.get("flags", [])

        action_taken = "APPROVED"
        if not is_safe:
            if confidence > 0.8:
                action_taken = "AUTO_REJECTED"
            else:
                action_taken = "SEND_TO_HUMAN_REVIEW"

        return ModerationResult(
            status="Processed via AI Service",
            is_safe=is_safe,
            confidence=confidence,
            flags=ai_flags,
            action_taken=action_taken
        )
    except Exception as e:
        print(f"Error in moderation route: {str(e)}")
        raise HTTPException(status_code=503, detail="AI kiểm duyệt lỗi, vui lòng thử lại sau.")
