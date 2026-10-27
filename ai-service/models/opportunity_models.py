"""Pydantic models for the Opportunity Radar (F-16b) matching endpoint.

These models travel from the NestJS backend (which has already pre-filtered
the candidate set against SQLite) to the ai-service, which performs NLP-based
criteria extraction + semantic scoring on top of the budget / deadline
hard-filters applied upstream.
"""

from typing import List, Optional, Any
from pydantic import BaseModel, Field


class OpportunityCandidate(BaseModel):
    """A single opportunity normalised by the backend pre-filter (T1)."""
    id: str = ""
    title: str = ""
    description: str = ""
    type: str = "other"            # scholarship | internship | job | hackathon | ...
    organization: str = ""
    requirements: str = ""
    benefits: str = ""
    url: str = ""
    field_tags: List[str] = Field(default_factory=list)
    region: str = ""
    deadline: Optional[str] = None  # ISO date string or None
    source_table: str = "opportunities"
    status: str = "active"


class UserProfile(BaseModel):
    """Subset of the user profile used for matching."""
    id: str = ""
    full_name: str = ""
    major: str = ""
    skills: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    location: str = ""
    role: str = "student"
    gpa: Optional[float] = None


class OpportunityMatchRequest(BaseModel):
    """Request body for POST /api/ai/opportunity/match."""
    user_profile: UserProfile
    opportunities: List[OpportunityCandidate] = Field(default_factory=list)


class ExtractedCriteria(BaseModel):
    required_gpa: Optional[float] = None
    required_major: Optional[str] = None
    required_skills: List[str] = Field(default_factory=list)
    required_language: Optional[str] = None
    required_experience: Optional[str] = None
    is_team_based: Optional[bool] = None


class ChecklistItem(BaseModel):
    label: str
    required: bool = True


class MatchItem(BaseModel):
    id: str
    title: str
    organization: str
    type: str
    url: Optional[str] = None
    deadline: Optional[str] = None
    region: str
    match_score: float
    confidence: float
    confidence_level: str  # 'high' | 'medium' | 'low'
    is_eligible: bool
    extracted_criteria: dict = Field(default_factory=dict)
    match_reasons: List[str] = Field(default_factory=list)
    checklist: List[str] = Field(default_factory=list)


class OpportunityMatchResponse(BaseModel):
    """Response body for POST /api/ai/opportunity/match."""
    user_id: str
    matches: List[MatchItem] = Field(default_factory=list)
    total: int = 0
    filtered_count: int = 0
    degraded: bool = False
    reason: Optional[str] = None
