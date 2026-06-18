from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class ModerationAction(str, Enum):
    APPROVED = "approved"
    AUTO_REJECTED = "auto_rejected"
    SEND_TO_HUMAN_REVIEW = "send_to_human_review"

class ModerationRequest(BaseModel):
    content: str
    content_type: Optional[str] = "text"
    user_id: Optional[str] = None

class ModerationResult(BaseModel):
    action: ModerationAction
    confidence: float
    flags: List[str]
    explanation: Optional[str] = None

class ModerationResponse(BaseModel):
    status: str
    result: ModerationResult
    timestamp: str
