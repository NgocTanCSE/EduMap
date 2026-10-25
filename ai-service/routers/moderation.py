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

# Banned-word regex used by the fast Layer-1 pre-filter.
# Kept short and targeted so false positives on legitimate study discussion
# remain near zero — Layer 2 (AI) handles the nuanced stuff.
BAD_WORDS_PATTERN = re.compile(
    r'\b('
    r'chửi thều|đm|vkl|lừa đảm|đánh bạc|đéo|dm|đcm|cc|loạn|chết|mẹ|con '
    r'lòn|tạc hại|xúc phạm|phẩm h hoặc|đồ chơi bậy|đụ|mẹ mày|chó|khị bẩn'
    r')\b',
    re.IGNORECASE,
)
# Phone-number pattern (Vietnam mobile prefixes 03/05/07/08/09 + 8 digits).
PHONE_PATTERN = re.compile(r'\b(0[35789])(\d{8})\b')

@router.post("/", response_model=ModerationResult)
async def moderate_content(request: ContentRequest):
    # Layer 1: lọc thực (regex) — chạy luôn, không cần AI
    # Catches the highest-confidence violations instantly, with zero latency.
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

    # Layer 2: phân tích ngữ nghĩa sâu (cần kết nối AI/Cloudflare)
    # ``moderate_text`` degrades gracefully: when every AI provider is
    # unreachable it returns is_safe=True with low confidence instead of
    # raising, so community posting is never fully blocked by an AI outage.
    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")

    try:
        ai_result = await llm_service.moderate_text(request.text)

        is_safe = ai_result.get("is_safe", False)
        confidence = float(ai_result.get("confidence", 0.0))
        ai_flags = ai_result.get("flags", [])
        ai_reason = ai_result.get("reason", "")

        # AI is the final moderator: unsafe content is rejected immediately.
        # There is no manual review queue in EduMap.
        action_taken = "APPROVED" if is_safe else "AUTO_REJECTED"

        # Detect the graceful-degradation fallback and surface it in the
        # status + moderation_message so callers know AI was unavailable.
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
        # This only fires if moderate_text itself raises (e.g. llm_service
        # is None, or an unexpected internal error). The normal all-providers-
        # down case is already handled by the graceful fallback above.
        print(f"Error in moderation route: {str(e)}")
        raise HTTPException(status_code=503, detail="AI kiểm duyệt lỗi, vui lòng thử lại sau.")
