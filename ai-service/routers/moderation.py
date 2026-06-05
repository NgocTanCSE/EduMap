from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import re
from services.llm_service import LLMService

router = APIRouter(prefix="/api/ai/moderate", tags=["7. AI Content Moderation"])
llm_service = LLMService()

class ContentRequest(BaseModel):
    user_id: str
    text: str

class ModerationResult(BaseModel):
    status: str
    is_safe: bool
    confidence: float
    flags: list
    action_taken: str

# Từ điển Regex cơ bản (Lọc siêu tốc ở Layer 1)
BAD_WORDS_PATTERN = re.compile(r'\b(chửi thề|đm|vkl|lừa đảo|đánh bạc)\b', re.IGNORECASE)
PHONE_PATTERN = re.compile(r'\b(0[3|5|7|8|9])+([0-9]{8})\b')

@router.post("/", response_model=ModerationResult)
async def moderate_content(request: ContentRequest):
    flags = []
    
    # Layer 1: Fast Regex Filtering
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

    # Layer 2: Deep Semantic Analysis with Gemini
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
            status="Processed via Gemini AI",
            is_safe=is_safe,
            confidence=confidence,
            flags=ai_flags,
            action_taken=action_taken
        )
    except Exception as e:
        print(f"Error in moderation route: {str(e)}")
        # Fail-safe: Gửi cho người kiểm duyệt nếu AI gặp sự cố
        return ModerationResult(
            status="AI Error - Fallback",
            is_safe=False,
            confidence=0.0,
            flags=["System_Error"],
            action_taken="SEND_TO_HUMAN_REVIEW"
        )
