from pydantic import BaseModel, Field
from typing import List, Optional

# --- INPUT STRUCTURE ---
class CareerAnalysisRequest(BaseModel):
    user_id: str = Field(..., description="ID of the user")
    full_name: Optional[str] = Field(None, description="User's full name")
    mbti_type: Optional[str] = Field(None, description="MBTI personality type (e.g., INTJ, ENFP)")
    skills: List[str] = Field(default_factory=list, description="List of user skills (e.g., Python, Java)")
    career_aspirations: List[str] = Field(default_factory=list, description="List of career goals or aspirations")
    recent_keywords: Optional[str] = Field(None, description="Recent search keywords related to career")
    holland_code: Optional[str] = Field(None, description="Holland code results (e.g., RIA, SEC)")

# --- OUTPUT STRUCTURE ---
class RecommendedCareer(BaseModel):
    title: str = Field(..., description="Job title or career path name")
    match_score: int = Field(..., description="Suitability score (0-100%)")
    explanation: str = Field(..., description="AI's explanation for this recommendation")
    missing_skills: List[str] = Field(..., description="Skills the user needs to acquire for this career")

class CareerRecommendationResponse(BaseModel):
    user_id: str
    top_careers: List[RecommendedCareer]
