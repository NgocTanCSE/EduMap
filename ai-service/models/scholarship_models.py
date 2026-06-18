from pydantic import BaseModel
from typing import Optional, List, Dict

class ScholarshipCheckRequest(BaseModel):
    user_profile: Dict
    scholarship_details: Dict

class EligibilityResult(BaseModel):
    is_eligible: bool
    score: float
    criteria_met: List[str]
    criteria_not_met: List[str]
    recommendations: List[str]

class ScholarshipCheckResponse(BaseModel):
    status: str
    result: EligibilityResult
    timestamp: str
