"""Pydantic models for SafeRoute AI explain endpoint (Idea #12)."""
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


class SafetyFactors(BaseModel):
    distanceScore: float = 0.0
    durationScore: float = 0.0
    floodRisk: float = 0.0
    trafficRisk: float = 0.0


class SafeRouteSummary(BaseModel):
    """Summarised route info for the LLM explain endpoint."""
    safetyScore: float
    safetyFactors: SafetyFactors
    distance: float
    duration: float
    explanation: str = ""
    isPrimary: bool = False
    floodWarnings: List[dict] = Field(default_factory=list)
    trafficAnalysis: Optional[dict] = None


class RouteExplainPreferences(BaseModel):
    avoidFlood: bool = True
    avoidTraffic: bool = True
    preferPaved: Optional[bool] = None
    maxDistanceKm: Optional[float] = None
    safetyWeight: Optional[float] = 0.3


class RouteExplainRequest(BaseModel):
    """Incoming request from the backend for LLM route explanation."""
    routes: List[SafeRouteSummary] = Field(default_factory=list)
    preferences: RouteExplainPreferences = Field(default_factory=RouteExplainPreferences)
    origin: Optional[Dict[str, Any]] = None
    destination: Optional[Dict[str, Any]] = None
    provider: Optional[str] = None


class RouteReason(BaseModel):
    route_index: int
    reason: str


class RouteExplainResponse(BaseModel):
    """LLM-generated explanation of why each route was ranked as it was."""
    explanation: str = ""
    route_reasons: List[RouteReason] = Field(default_factory=list)
    degraded: Optional[bool] = False
    reason: Optional[str] = None
    source: Optional[str] = None
