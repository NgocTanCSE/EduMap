"""Router for /api/ai/impact/* endpoints — Idea #19: AI Impact Measurement.

Exposes the before/after impact measurement produced by
``services/impact_measure.py``:

* ``POST /api/ai/impact/measure`` — compute a full impact report for a region:
  before/after diff (access_rate, usage_count, coverage_improvement),
  people-in-5 km-radius diff, trend analysis with growth rate, an impact
  score (0–100) + Wilson confidence interval, causal-inference notes, and an
  LLM narrative (template fallback when no provider is configured).

Like forecast.py / climate.py, the endpoint runs the (CPU-bound) computation
off the FastAPI event loop via ``asyncio.to_thread`` and keeps a 24-hour
in-process TTL cache so repeated requests hit memory, not the model.

The request is self-sufficient: when called directly (e.g. the curl smoke
test) the service loads ``map_points`` from SQLite itself, so the backend
proxy is an optimization rather than a hard dependency.
"""

from datetime import date as _date
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Tuple, List
import asyncio
import logging
import time

from models.impact_measure_models import (
    ImpactMeasureRequest,
    ImpactMeasureResponse,
)

logger = logging.getLogger("impact_measure")

router = APIRouter(prefix="/api/ai/impact", tags=["19. AI Impact Measurement"])


# ── In-process 24 h cache (HF Spaces: no Redis) ────────────────────────────────
_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 24 * 3600


def _cache_get(key: str):
    entry = _CACHE.get(key)
    if not entry:
        return None
    expiry, value = entry
    if time.time() > expiry:
        _CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Dict[str, Any]):
    _CACHE[key] = (time.time() + _CACHE_TTL_SECONDS, value)


def _default_bbox(lat: float, lng: float, radius_km: float) -> Tuple[float, float, float, float]:
    """Build a bounding box around a center point. ~111 km per degree."""
    d = radius_km / 111.0
    return (lat - d, lat + d, lng - d, lng + d)


def _empty_degraded_report(region: str, reason: str, bbox: List[float]) -> Dict[str, Any]:
    """A valid-but-degraded report returned only when the service is broken —
    not when data is merely sparse (sparse data is flagged with
    ``degraded=True`` inside the service with a real baseline)."""
    return {
        "region": region,
        "bbox": bbox,
        "population_estimate": 0,
        "before": {
            "period": "trước triển khai",
            "access_rate": 0.0,
            "user_count": 0,
            "facility_count": 0,
            "usage_count": 0,
            "synthetic_baseline": True,
        },
        "after": {
            "period": "sau triển khai",
            "access_rate": 0.0,
            "user_count": 0,
            "facility_count": 0,
            "usage_count": 0,
            "synthetic_baseline": False,
        },
        "diff": {
            "access_rate_delta": 0.0,
            "user_count_delta": 0,
            "usage_count_delta": 0,
            "coverage_improvement_pct": 0.0,
        },
        "people_in_radius": {"before": 0, "after": 0, "delta": 0, "radius_km": 5.0},
        "trend": {"monthly": [], "growth_rate_pct": 0.0, "trend": "ổn định"},
        "impact_score": 0.0,
        "confidence_interval": {"lower": 0.0, "upper": 0.0, "level": 0.95, "method": "none"},
        "causal_notes": [
            "Dịch vụ đo lường tác động đang gián đoạn — kết quả trống.",
            "Để khẳng định nguyên nhân, đề xuất nghiên cứu RCT.",
        ],
        "narrative": "Hiện chưa thể tính toán tác động (dịch vụ đang giảm tốc). "
                     "Vui lòng thử lại sau hoặc liên hệ quản trị viên.",
        "degraded": True,
        "reason": reason,
        "metadata": {
            "method": "impact_measure_v1",
            "data_source": "none",
            "degraded": True,
            "reason": reason,
            "last_updated": _date.today().isoformat(),
        },
    }


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/measure", response_model=ImpactMeasureResponse)
async def measure_impact(request_data: ImpactMeasureRequest):
    """POST /api/ai/impact/measure → before/after impact report.

    Body:
        ``{"lat": 10.9525, "lng": 106.8778, "radius_km": 15,
           "deployment_date": "2025-01-01", "region": "Biên Hòa, Đồng Nai"}``

    or a bounding box:
        ``{"min_lat": ..., "max_lat": ..., "min_lng": ..., "max_lng": ...,
           "deployment_date": "2025-01-01"}``

    Returns the full impact-measurement report (see
    ``ImpactMeasureResponse``). The whole computation runs off the event loop
    via ``asyncio.to_thread`` and is cached for 24 h.
    """
    # Resolve the report bbox for the degraded fallback.
    if request_data.min_lat is not None and request_data.max_lat is not None \
       and request_data.min_lng is not None and request_data.max_lng is not None:
        mn_lat, mx_lat = min(request_data.min_lat, request_data.max_lat), max(request_data.min_lat, request_data.max_lat)
        mn_lng, mx_lng = min(request_data.min_lng, request_data.max_lng), max(request_data.min_lng, request_data.max_lng)
        bbox = [round(mn_lat, 5), round(mx_lat, 5), round(mn_lng, 5), round(mx_lng, 5)]
    elif request_data.lat is not None and request_data.lng is not None:
        mn_lat, mx_lat, mn_lng, mx_lng = _default_bbox(
            request_data.lat, request_data.lng, request_data.radius_km
        )
        bbox = [round(mn_lat, 5), round(mx_lat, 5), round(mn_lng, 5), round(mx_lng, 5)]
    else:
        bbox = [10.75, 11.20, 106.60, 107.20]

    cache_key = (
        f"impact:{bbox[0]}:{bbox[1]}:{bbox[2]}:{bbox[3]}:"
        f"{request_data.deployment_date or ''}:"
        f"{'-'.join(sorted(request_data.facility_types or []))}"
    )

    cached = _cache_get(cache_key)
    if cached is not None:
        cached = dict(cached)
        cached["metadata"] = {**cached.get("metadata", {}), "cached": True}
        logger.info("impact measure cache hit: %s", cache_key)
        return cached

    try:
        from services.impact_measure import impact_measure

        result = await asyncio.to_thread(impact_measure.measure, request_data)

        _cache_set(cache_key, result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in impact/measure: %s", e)
        return _empty_degraded_report(
            request_data.region or "Biên Hòa, Đồng Nai",
            f"Tính toán đo lường tác động thất bại: {e}",
            bbox,
        )
