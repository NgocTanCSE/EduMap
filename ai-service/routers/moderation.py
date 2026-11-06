from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
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
    moderation_message: Optional[str] = None




BAD_WORDS_PATTERN = re.compile(
    r'\b('
    r'chửi thều|đm|vkl|lừa đảm|đánh bạc|đéo|dm|đcm|cc|loạn|chết|mẹ|con '
    r'lòn|tạc hại|xúc phạm|phẩm h hoặc|đồ chơi bậy|đụ|mẹ mày|chó|khị bẩn'
    r')\b',
    re.IGNORECASE,
)

PHONE_PATTERN = re.compile(r'\b(0[35789])(\d{8})\b')

@router.post("/", response_model=ModerationResult)
async def moderate_content(request: ContentRequest):


    flags: List[str] = []
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
            action_taken="AUTO_REJECTED",
            moderation_message=None,
        )





    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")

    try:
        ai_result = await llm_service.moderate_text(request.text)

        is_safe = ai_result.get("is_safe", False)
        confidence = float(ai_result.get("confidence", 0.0))
        ai_flags = ai_result.get("flags", [])
        ai_reason = ai_result.get("reason", "")



        action_taken = "APPROVED" if is_safe else "AUTO_REJECTED"



        degraded = bool(ai_reason) and ("unavailable" in ai_reason.lower() or "regex pre-filter" in ai_reason.lower())
        status = "Processed via AI Service (degraded — regex fallback)" if degraded else "Processed via AI Service"

        return ModerationResult(
            status=status,
            is_safe=is_safe,
            confidence=confidence,
            flags=ai_flags,
            action_taken=action_taken,
            moderation_message=ai_reason or None,
        )
    except Exception as e:



        print(f"Error in moderation route: {str(e)}")
        raise HTTPException(status_code=503, detail="AI kiểm duyệt lỗi, vui lòng thử lại sau.")
