from pydantic import BaseModel, Field
from typing import List

class MentorProfile(BaseModel):
    mentor_id: str
    name: str
    skills: List[str]
    mbti: str
    available_days: List[str]

class MatchRequest(BaseModel):
    student_id: str
    student_skills_needed: List[str]
    student_mbti: str
    preferred_days: List[str]
    available_mentors: List[MentorProfile]

class MatchResult(BaseModel):
    mentor_id: str
    name: str
    match_score: float = Field(..., description="Điểm tương thích (0-100)")
    match_reasons: List[str] = Field(..., description="Lý do tại sao hợp")

class MentorMatchResponse(BaseModel):
    student_id: str
    top_matches: List[MatchResult]
