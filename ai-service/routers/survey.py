"""Router for /api/ai/survey/* — Idea #20: AI Active Learning for Field Survey.

Exposes the entropy + information-value / cost prioritiser from
``services/survey_optimizer.py``. **No LLM is called** — the ranking is pure
server-side scoring (binary facility-existence entropy), which keeps the whole
computation cheap and fast on the HF Spaces free (1-vCPU) container.

Endpoints:

* ``POST /api/ai/survey/priorities`` — rank candidate survey cells by
  ``info_value / cost`` and return up to ``top_n`` of them as a GeoJSON
  ``FeatureCollection`` plus a ``next_point`` and ``metadata``.
* ``POST /api/ai/survey/next``       — return the single best next survey point.

Both accept the same request body (POIs + current location + bbox + tunables).

Response shape (``/priorities``):
{
  "type": "FeatureCollection",
  "features": [ { "type":"Feature", "geometry":{"type":"Point","coordinates":[lng,lat]},
                  "properties":{ "rank", "lat", "lng", "priority_score",
                                 "uncertainty", "info_value", "cost",
                                 "distance_km", "nearest_poi_distance_km",
                                 "points_in_cell", "p_exist", "reason",
                                 "priority_label", "source"?, "verification_date"? } }
  ],
  "next_point": {"lat", "lng", "rank"},
  "summary": { "total_cells", "evaluated_cells", "considered",
               "grid_size_km", "poi_count", "points_used", "current_location",
               "bbox", "influence_radius_km", "spatial_weight",
               "survey_time_hours", "surveyor_speed_kmh", "top_n", "max_results" },
  "metadata": { "method", "degraded", "reason", "last_updated", "elapsed_ms", "cached"? }
}

Architecture notes (HF Spaces Free plan — AGENTS.md):
  - 24 h in-process TTL cache keyed by the input hash so repeated identical
    surveys hit memory, not the CPU-bound grid.
  - Degrades gracefully: any failure returns a valid ``FeatureCollection``
    with ``metadata.degraded = True`` — the frontend map never 502s.
  - No external HTTP calls → the ``curl --ipv4 --insecure`` circuit-breaker rules
    do not apply to this endpoint.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from services.survey_optimizer import survey_optimizer

router = APIRouter(
    prefix="/api/ai/survey",
    tags=["20. AI Active Learning Survey"],
)

logger = logging.getLogger("survey")

# ── In-process 24 h cache (HF Spaces: no Redis) ──────────────────────────────
_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL_SECONDS = 24 * 3600


# ── Request model (inline — mirrors routers/climate.py) ─────────────────────

class SurveyRequest(BaseModel):
    """POST body for /api/ai/survey/priorities and /next.

    Attributes:
        points: danh sách POI (mỗi POI có lat/lng + tuỳ chọn name/category...).
        current_location: vị trí hiện tại của nhóm khảo sát {lat, lng}.
        bbox: giới hạn vùng {min_lat, max_lat, min_lng, max_lng}.
        grid_size_km: kích thước ô lưới vuông (km), mặc định 1.0.
        top_n: số ứng cử viên trả về (mặc định 15, max 50).
        survey_time_hours: thời gian cố định mỗi điểm khảo sát (giờ).
        surveyor_speed_kmh: tốc độ di chuyển (km/h).
        influence_radius_km: bán kính ảnh hưởng POI (km).
        spatial_weight: trọng số liên kết không gian (0 = không liên kết).
    """
    points: List[Dict[str, Any]] = Field(
        default_factory=list, description="Danh sách POI (lat, lng, + tuỳ chọn)",
    )
    current_location: Optional[Dict[str, float]] = Field(
        default=None, description="Vị trí hiện tại {lat, lng}",
    )
    bbox: Optional[Dict[str, float]] = Field(
        default=None, description="Bounding box {min_lat, max_lat, min_lng, max_lng}",
    )
    grid_size_km: float = Field(
        default=1.0, ge=0.1, le=50.0, description="Kích thước ô lưới (km)",
    )
    top_n: int = Field(
        default=15, ge=1, le=50, description="Số ứng cử viên trả về (max 50)",
    )
    survey_time_hours: float = Field(
        default=1.0, ge=0.0, le=24.0, description="Thời gian cố định khảo sát (giờ)",
    )
    surveyor_speed_kmh: float = Field(
        default=30.0, ge=1.0, le=200.0, description="Tốc độ di chuyển (km/h)",
    )
    influence_radius_km: float = Field(
        default=2.0, ge=0.2, le=20.0, description="Bán kính ảnh hưởng POI (km)",
    )
    spatial_weight: float = Field(
        default=0.25, ge=0.0, le=2.0, description="Trọng số liên kết không gian",
    )


def _cache_key(body: SurveyRequest, is_next: bool = False) -> str:
    """Deterministic cache key from the request payload + endpoint variant."""
    payload = {
        "points": sorted(body.points, key=lambda p: (p.get("lat", 0), p.get("lng", 0))),
        "current_location": body.current_location,
        "bbox": body.bbox,
        "grid_size_km": body.grid_size_km,
        "top_n": 1 if is_next else body.top_n,
        "survey_time_hours": body.survey_time_hours,
        "surveyor_speed_kmh": body.surveyor_speed_kmh,
        "influence_radius_km": body.influence_radius_km,
        "spatial_weight": body.spatial_weight,
        "endpoint": "next" if is_next else "priorities",
    }
    raw = json.dumps(payload, default=str, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    entry = _CACHE.get(key)
    if not entry:
        return None
    if time.time() > entry["expires"]:
        _CACHE.pop(key, None)
        return None
    return entry["value"]


def _cache_set(key: str, value: Dict[str, Any]) -> None:
    _CACHE[key] = {"expires": time.time() + _CACHE_TTL_SECONDS, "value": value}


def _degraded_priorities(reason: str) -> Dict[str, Any]:
    """Valid-but-degraded response used only when the service itself is broken."""
    return {
        "type": "FeatureCollection",
        "features": [],
        "next_point": None,
        "summary": {
            "total_cells": 0, "evaluated_cells": 0, "considered": 0,
            "grid_size_km": 1.0, "poi_count": 0, "points_used": 0,
            "current_location": {"lat": 10.9567, "lng": 107.1825},
            "bbox": {"min_lat": 10.75, "max_lat": 11.20, "min_lng": 106.60, "max_lng": 107.20},
            "top_n": 15, "max_results": 15,
        },
        "metadata": {
            "method": "entropy_infovalue_cost_v1",
            "degraded": True,
            "reason": reason,
            "last_updated": __import__("datetime").date.today().isoformat(),
            "elapsed_ms": 0,
        },
    }


# ── Endpoints ───────────────────────────────────────────────────────────────


@router.post("/priorities")
async def survey_priorities(request_data: SurveyRequest):
    """POST /api/ai/survey/priorities — rank next survey candidates.

    Computes (off the event loop via ``asyncio.to_thread``) an entropy-based
    uncertainty score, an expected information value (entropy reduction, with a
    small spatial-neighbourhood coupling term) and a survey cost (travel time
    + fixed overhead), then returns cells ranked by ``info_value / cost``.

    Body: ``SurveyRequest`` (POIs + current_location + bbox + tunables).
    Returns a GeoJSON ``FeatureCollection`` + ``next_point`` + ``metadata``.
    """
    key = _cache_key(request_data, is_next=False)
    cached = _cache_get(key)
    if cached is not None:
        cached = dict(cached)
        cached["metadata"] = {**(cached.get("metadata", {})), "cached": True}
        logger.info("survey/priorities cache hit")
        return cached

    try:
        result = await asyncio.to_thread(
            survey_optimizer.compute_priorities,
            points=request_data.points,
            current_location=request_data.current_location,
            bbox=request_data.bbox,
            grid_size_km=request_data.grid_size_km,
            top_n=request_data.top_n,
            survey_time_hours=request_data.survey_time_hours,
            surveyor_speed_kmh=request_data.surveyor_speed_kmh,
            influence_radius_km=request_data.influence_radius_km,
            spatial_weight=request_data.spatial_weight,
        )
        _cache_set(key, result)
        return result
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 — graceful degradation
        logger.exception("survey/priorities failed: %s", e)
        return _degraded_priorities(f"Lỗi tính toán khảo sát ưu tiên: {e}")


@router.post("/next")
async def survey_next(request_data: SurveyRequest):
    """POST /api/ai/survey/next — return the single best next survey point.

    Same payload as ``/priorities`` but ``top_n`` is forced to 1 and the
    response is shaped as a single ``feature`` + ``next_point``.
    """
    key = _cache_key(request_data, is_next=True)
    cached = _cache_get(key)
    if cached is not None:
        cached = dict(cached)
        cached["metadata"] = {**(cached.get("metadata", {})), "cached": True}
        logger.info("survey/next cache hit")
        return cached

    try:
        result = await asyncio.to_thread(
            survey_optimizer.compute_next,
            points=request_data.points,
            current_location=request_data.current_location,
            bbox=request_data.bbox,
            top_n=request_data.top_n,
            grid_size_km=request_data.grid_size_km,
            survey_time_hours=request_data.survey_time_hours,
            surveyor_speed_kmh=request_data.surveyor_speed_kmh,
            influence_radius_km=request_data.influence_radius_km,
            spatial_weight=request_data.spatial_weight,
        )
        _cache_set(key, result)
        return result
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 — graceful degradation
        logger.exception("survey/next failed: %s", e)
        return {
            "feature": None,
            "next_point": None,
            "metadata": {
                "method": "entropy_infovalue_cost_v1",
                "degraded": True,
                "reason": f"Lỗi xác định điểm khảo sát tiếp theo: {e}",
                "last_updated": __import__("datetime").date.today().isoformat(),
            },
        }
