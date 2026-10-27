"""
Pydantic models for the Resource Exchange AI matching endpoint (Idea #18).

Flow:
  Backend ResourceMatchService pre-filters resource×request pairs at the SQLite
  layer (type match, condition >= min, status available/open) and sends at most
  15 candidate pairs with a SQLite-side score. This endpoint asks the LLM to:
    1. Re-rank pairs by semantic fit and assign a 0–100 score.
    2. Explain WHY each resource is a good match for the request.
    3. Run a greedy scheduling algorithm to build a transport/pickup plan,
       avoiding time-slot conflicts across the ranked matches.

Graceful degradation: if every LLM provider is unreachable, returns
``degraded=true`` with a template-based cost-fit ranking + simple schedule.
"""

from __future__ import annotations

from typing import List, Optional, Any

from pydantic import BaseModel, Field


class ResourceInfo(BaseModel):
    """A single `resources` row, denormalised for the LLM prompt."""
    id: str
    type: str
    title: str
    description: Optional[str] = None
    condition: int = 5          # 0–5 sao
    location: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    available_from: Optional[str] = None
    cost: float = 0
    contact_method: Optional[str] = None
    is_verified: bool = False
    tags: List[str] = Field(default=[])
    metadata: dict = Field(default={})


class RequestInfo(BaseModel):
    """A single `resource_requests` row, denormalised for the LLM prompt."""
    id: str
    need_type: str
    title: str
    description: Optional[str] = None
    urgency: str
    location: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    deadline: Optional[str] = None
    preferred_min_condition: int = 0
    contact_method: Optional[str] = None
    tags: List[str] = Field(default=[])


class MatchCandidate(BaseModel):
    """A pre-filtered candidate pair (resource ↔ request) + SQLite score."""
    resource_id: str
    request_id: str
    resource: ResourceInfo
    request: RequestInfo
    match_score: float
    match_reasons: List[str] = Field(default=[])


class ResourceExchangeRequest(BaseModel):
    """Request body for POST /api/ai/resource-exchange/match-rank.

    ``pairs`` is expected to be **pre-filtered** by the backend before
    being sent to the LLM (SQLite type/condition/location filter, LIMIT 15).
    Each pair already carries a `match_score` from the SQLite scorer; the LLM
    may re-rank but the fallback uses this score directly.
    """
    pairs: List[MatchCandidate] = Field(default=[])
    region: Optional[str] = Field(default=None, description="Khu vực lọc (nếu có)")
    type: Optional[str] = Field(default=None, description="Loại nguồn lực lọc (nếu có)")
    max_results: Optional[int] = Field(default=15, ge=1, le=30,
                                       description="Số cặp tối đa gửi vào LLM")


class RankedResourceMatch(BaseModel):
    resource_id: str
    request_id: str
    match_score: float = Field(..., description="Điểm tương thích (0-100)")
    explanation: Optional[str] = Field(default=None, description="LLM giải thích tại sao match")
    match_reasons: List[str] = Field(default=[])
    next_steps: List[str] = Field(default=[])
    scheduled_pickup: Optional[str] = Field(default=None, description="Lịch giao nhận đề xuất (ISO)")


class TransportSlot(BaseModel):
    """Một slot lịch trình giao nhận do greedy scheduler tạo ra."""
    resource_id: str
    request_id: str
    pickup_datetime: str
    pickup_order: int = 0


class ResourceExchangeResponse(BaseModel):
    ranked_matches: List[RankedResourceMatch] = Field(default=[])
    transport_plan: List[TransportSlot] = Field(default=[])
    degraded: bool = False
    reason: Optional[str] = None
