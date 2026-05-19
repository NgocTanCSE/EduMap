from fastapi import APIRouter
from pydantic import BaseModel
import re

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

# Từ điển Regex cơ bản (Mock)
BAD_WORDS_PATTERN = re.compile(r'\b(chửi thề|đm|vkl|lừa đảo|đánh bạc)\b', re.IGNORECASE)
PHONE_PATTERN = re.compile(r'\b(0[3|5|7|8|9])+([0-9]{8})\b')

@router.post("/", response_model=ModerationResult)
async def moderate_content(request: ContentRequest):
    flags = []
    
    # Lớp 1: Lọc bằng Regex (Tốc độ siêu nhanh 0.01s)
    if BAD_WORDS_PATTERN.search(request.text):
        flags.append("Profanity")
    
    if PHONE_PATTERN.search(request.text):
        flags.append("PII_Phone_Number")

    if flags:
        # Nếu dính Regex -> Chặn ngay lập tức không cần tốn tiền gọi LLM
        return ModerationResult(
            status="Processed via Regex",
            is_safe=False,
            confidence=1.0,
            flags=flags,
            action_taken="AUTO_REJECTED"
        )

    # Lớp 2: Gọi LLM phân tích ngữ nghĩa ngầm (Mock logic)
    # Trong thực tế, chỗ này sẽ gọi model PhoBERT hoặc Gemini
    toxicity_score = 0.1 # Giả lập điểm độc hại (0.0 -> 1.0)
    
    if "đồ ngu" in request.text.lower() or "chết đi" in request.text.lower():
        toxicity_score = 0.9

    if toxicity_score > 0.8:
        return ModerationResult(
            status="Processed via AI NLP",
            is_safe=False,
            confidence=toxicity_score,
            flags=["Toxic_Language", "Harassment"],
            action_taken="AUTO_REJECTED"
        )
    elif toxicity_score > 0.4:
        return ModerationResult(
            status="Processed via AI NLP",
            is_safe=True,
            confidence=toxicity_score,
            flags=["Suspicious"],
            action_taken="SEND_TO_HUMAN_REVIEW"
        )
    else:
        return ModerationResult(
            status="Processed via AI NLP",
            is_safe=True,
            confidence=toxicity_score,
            flags=[],
            action_taken="APPROVED"
        )
