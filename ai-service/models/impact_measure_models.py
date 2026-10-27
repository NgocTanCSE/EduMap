"""
Pydantic models for the AI Impact Measurement endpoint (Idea #19).

Flow:
  The backend ``ImpactMeasurementService`` pre-computes a before/after diff
  from the ``map_points`` table (facility counts, access rate, coverage
  improvement — T1), then sends the region + deployment cut-off to the AI
  service. This endpoint enriches the diff with:

    * a people-in-5 km-radius diff (before vs. after deployment),
    * trend analysis over the monthly deployment timeline (growth rate),
    * an impact score (weighted composite, 0–100) + Wilson-score confidence
      interval (reflecting the synthetic-baseline caveat when "before" data
      is missing),
    * an LLM narrative (causal-inference caveat + RCT recommendation),
      with a template fallback so the feature never 502s when every provider
      is down.

The request is self-sufficient: when called directly (curl smoke test) the
service loads ``map_points`` from SQLite itself, so the backend proxy is an
optimization, not a hard dependency.
"""

from __future__ import annotations

from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field


class ImpactMeasureRequest(BaseModel):
    """POST body for /api/ai/impact/measure.

    Either a bounding box (``min_lat``/``max_lat``/``min_lng``/``max_lng``)
    or a center point (``lat``/``lng`` + ``radius_km``) selects the region.
    ``deployment_date`` is the cut-off that splits facilities into a "before"
    (pre-deployment baseline) and "after" (post-deployment) cohort.
    """
    # Region selector — bbox OR center+lat/lng.
    min_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    max_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    min_lng: Optional[float] = Field(default=None, ge=-180, le=180)
    max_lng: Optional[float] = Field(default=None, ge=-180, le=180)
    lat: Optional[float] = Field(default=None, ge=-90, le=90,
                                 description="Trung tâm nếu không có bbox")
    lng: Optional[float] = Field(default=None, ge=-180, le=180,
                                 description="Trung tâm nếu không có bbox")
    radius_km: float = Field(default=15.0, ge=1, le=100,
                             description="Bán kính tính (km) khi dùng lat/lng")

    # Before/after cut-off. Facilities created_at < deployment_date are "before".
    deployment_date: Optional[str] = Field(
        default=None,
        description="ISO date (e.g. 2025-01-01) chia trước/sau triển khai. "
                    "Nếu để trống, dùng median created_at của facilities."
    )
    region: Optional[str] = Field(default=None, description="Tên khu vực (nếu có)")

    # Optional override: which facility types count as "educational access".
    facility_types: Optional[List[str]] = Field(
        default=None,
        description="Danh sách type_id/tên loại cơ sở (wifi, library, school, university, lab). "
                    "Mặc định: ['wifi','library','school','university','lab']."
    )


class PeriodMetrics(BaseModel):
    """Before/after period summary."""
    period: str
    access_rate: float = Field(..., description="Tỉ lệ tiếp cận [0,1]")
    user_count: int = Field(..., description="Số người được tiếp cận")
    facility_count: int = Field(..., description="Số cơ sở giáo dục trong vùng")
    usage_count: int = Field(..., description="Số lần sử dụng (ước tính)")
    synthetic_baseline: bool = Field(default=False,
                                     description="True khi 'before' dùng chuẩn mực tổng dân × 0.7")


class DiffMetrics(BaseModel):
    access_rate_delta: float
    user_count_delta: int
    usage_count_delta: int
    coverage_improvement_pct: float


class PeopleRadius(BaseModel):
    before: int
    after: int
    delta: int
    radius_km: float


class TrendPoint(BaseModel):
    month: str
    facilities_added: int
    cumulative: int


class TrendAnalysis(BaseModel):
    monthly: List[TrendPoint]
    growth_rate_pct: float
    trend: str  # "tăng" | "giảm" | "ổn định"


class ConfidenceInterval(BaseModel):
    lower: float
    upper: float
    level: float
    method: str


class ImpactMeasureResponse(BaseModel):
    """Full response for POST /api/ai/impact/measure."""
    region: str
    bbox: List[float]
    population_estimate: int
    before: PeriodMetrics
    after: PeriodMetrics
    diff: DiffMetrics
    people_in_radius: PeopleRadius
    trend: TrendAnalysis
    impact_score: float = Field(..., description="Điểm tác động 0-100")
    confidence_interval: ConfidenceInterval
    causal_notes: List[str]
    narrative: str
    degraded: bool = False
    reason: Optional[str] = None
    metadata: Dict[str, Any] = Field(default={})
