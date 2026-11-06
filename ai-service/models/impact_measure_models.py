

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


    deployment_date: Optional[str] = Field(
        default=None,
        description="ISO date (e.g. 2025-01-01) chia trước/sau triển khai. "
                    "Nếu để trống, dùng median created_at của facilities."
    )
    region: Optional[str] = Field(default=None, description="Tên khu vực (nếu có)")


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
    trend: str


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
