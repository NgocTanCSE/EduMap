"""
Pydantic models for the ImpactMatch ranking endpoint (Idea #9).

Flow:
  Backend ImpactMatchService pre-filters need×sponsor pairs at the SQLite
  layer (cost, location, category — LIMIT 15) and sends the survivors here.
  The LLM then assigns a 0-100 match score + explanations + next steps.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class NeedInfo(BaseModel):
    """A single sponsor_need, denormalised for the LLM prompt."""
    id: str
    title: str
    description: Optional[str] = None
    category: str
    urgency: str
    cost_estimate: float
    location: Optional[str] = None
    tags: List[str] = Field(default=[])


class SponsorInfo(BaseModel):
    """A single sponsor_profile, denormalised for the LLM prompt."""
    id: str
    name: str
    description: Optional[str] = None
    focus_areas: List[str] = Field(default=[])
    budget_amount: float
    budget_currency: str = "VND"
    location: Optional[str] = None


class NeedSponsorPair(BaseModel):
    """A pre-filtered candidate pair sent to the LLM for ranking."""
    need_id: str
    sponsor_id: str
    need: NeedInfo
    sponsor: SponsorInfo
    category_match: bool = False


class ImpactMatchRequest(BaseModel):
    """Request body for POST /api/ai/impactmatch/rank.

    ``pairs`` is expected to be **pre-filtered** by the backend before
    being sent to the LLM (SQLite cost/location/category filter, LIMIT 15).
    """
    pairs: List[NeedSponsorPair] = Field(default=[])
    region: Optional[str] = Field(default=None, description="Khu vực lọc (nếu có)")
    category: Optional[str] = Field(default=None, description="Danh mục lọc (nếu có)")
    max_results: Optional[int] = Field(default=15, ge=1, le=30,
                                       description="Số cặp tối đa gửi vào LLM")


class RankedMatch(BaseModel):
    need_id: str
    sponsor_id: str
    match_score: float = Field(..., description="Điểm tương thích (0-100)")
    match_reasons: List[str] = Field(default=[])
    next_steps: List[str] = Field(default=[])


class ImpactMatchResponse(BaseModel):
    ranked_matches: List[RankedMatch] = Field(default=[])
    degraded: bool = False
    reason: Optional[str] = None
