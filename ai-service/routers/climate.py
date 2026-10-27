"""Router for /api/ai/climate/* endpoints — Idea #11: AI Climate Learning
Guardian.

Exposes the flood/weather risk heatmap and safe-alternative recommendations
produced by ``services/climate_guardian.py``:

* ``POST /api/ai/climate/risk``      — compute a fresh risk heatmap GeoJSON
  for a bounding box (with optional date).
* ``POST /api/ai/climate/alternatives`` — recommend safe alternative learning
  locations near a point, ranked by safety.

Both return a GeoJSON ``FeatureCollection`` with ``heat_points`` (for
leaflet.heat), ``risk_ranking`` / ``nearest_safe`` and ``metadata`` (which
carries the ``degraded`` flag used by the frontend to show the
"dữ liệu hiếm → degraded" warning).

Like forecast.py, both endpoints use ``asyncio.to_thread`` to run the
CPU-bound risk computation off the FastAPI event loop, and a 24-hour
in-process TTL cache so repeated requests hit memory, not the model.
"""

from datetime import date as _date
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Tuple, List
import asyncio
import logging
import time

logger = logging.getLogger("climate")

router = APIRouter(prefix="/api/ai/climate", tags=["11. AI Climate Learning Guardian"])


# ── Request models ───────────────────────────────────────────────────────────

class ClimateRiskRequest(BaseModel):
    """POST body for /api/ai/climate/risk.

    Either a bounding box (``bbox``) or a center point + radius is accepted.
    When only a point is given, a default 10 km bbox around it is used.
    """
    min_lat: Optional[float] = Field(default=None, ge=-90, le=90,
                                     description="Minimum latitude")
    max_lat: Optional[float] = Field(default=None, ge=-90, le=90,
                                     description="Maximum latitude")
    min_lng: Optional[float] = Field(default=None, ge=-180, le=180,
                                     description="Minimum longitude")
    max_lng: Optional[float] = Field(default=None, ge=-180, le=180,
                                     description="Maximum longitude")
    lat: Optional[float] = Field(default=None, ge=-90, le=90,
                                 description="Center latitude (if no bbox)")
    lng: Optional[float] = Field(default=None, ge=-180, le=180,
                                 description="Center longitude (if no bbox)")
    radius_km: float = Field(default=15.0, ge=1, le=50,
                             description="Radius in km (used with lat/lng)")
    date: Optional[str] = Field(default=None, description="ISO date (e.g. 2025-06-15)")


class ClimateAlternativesRequest(BaseModel):
    """POST body for /api/ai/climate/alternatives."""
    lat: float = Field(..., ge=-90, le=90, description="Center latitude")
    lng: float = Field(..., ge=-180, le=180, description="Center longitude")
    min_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    max_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    min_lng: Optional[float] = Field(default=None, ge=-180, le=180)
    max_lng: Optional[float] = Field(default=None, ge=-180, le=180)
    radius_km: float = Field(default=10.0, ge=0.5, le=50,
                             description="Search radius in km")
    category: Optional[str] = Field(default=None, description="Filter by category (school, university, library, wifi_hotspot, ...)")


# ── In-process 24 h cache (HF Spaces: no Redis) ──────────────────────────────
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


def _empty_degraded_heatmap(reason: str) -> Dict[str, Any]:
    """A valid-but-degraded GeoJSON returned only when the service itself is
    broken — not when data is sparse (sparse data is handled inside the
    service with ``degraded=True``)."""
    centroid = {"lat": 10.9567, "lng": 107.1825}  # Biên Hòa / Đồng Nai centroid
    return {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [centroid["lng"], centroid["lat"]]},
            "properties": {
                "lat": centroid["lat"],
                "lng": centroid["lng"],
                "risk_score": 0.0,
                "risk_level": "rất thấp",
                "nearest_facility": "Không có",
                "flood_risk": 0.0,
                "weather_risk": 0.0,
                "access_risk": 0.0,
            },
        }],
        "heat_points": [],
        "risk_ranking": [],
        "risk_weights": {
            "flood_risk": 0.35,
            "weather_risk": 0.35,
            "access_risk": 0.30,
        },
        "metadata": {
            "method": "climate_guardian_v1",
            "degraded": True,
            "reason": reason,
            "data_source": "none",
            "date": _date.today().isoformat(),
            "last_updated": _date.today().isoformat(),
        },
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/risk")
async def climate_risk_heatmap(request_data: ClimateRiskRequest):
    """POST /api/ai/climate/risk → flood/weather risk heatmap GeoJSON.

    Body: ``{"min_lat": ..., "max_lat": ..., "min_lng": ..., "max_lng": ...,
    "date": "2025-09-15"}`` or ``{"lat": ..., "lng": ..., "radius_km": 15}``.

    Returns a GeoJSON ``FeatureCollection`` with ``heat_points`` (for
    leaflet.heat), ``risk_ranking`` and ``metadata.degraded``. The
    ``metadata.degraded`` flag is set when weather API keys are missing
    (static flood hazard map fallback) or data is sparse.
    """
    # Resolve bbox.
    if request_data.min_lat is not None and request_data.max_lat is not None \
       and request_data.min_lng is not None and request_data.max_lng is not None:
        min_lat, max_lat = request_data.min_lat, request_data.max_lat
        min_lng, max_lng = request_data.min_lng, request_data.max_lng
    elif request_data.lat is not None and request_data.lng is not None:
        min_lat, max_lat, min_lng, max_lng = _default_bbox(
            request_data.lat, request_data.lng, request_data.radius_km
        )
    else:
        # Default to Đồng Nai province (Biên Hòa centroid).
        min_lat, max_lat, min_lng, max_lng = 10.75, 11.20, 106.60, 107.20

    if min_lat > max_lat:
        min_lat, max_lat = max_lat, min_lat
    if min_lng > max_lng:
        min_lng, max_lng = max_lng, min_lng

    date_str = request_data.date
    cache_key = f"risk:{min_lat:.4f}:{max_lat:.4f}:{min_lng:.4f}:{max_lng:.4f}:{date_str or ''}"

    # Cached shortcut (24 h in-process).
    cached = _cache_get(cache_key)
    if cached is not None:
        cached = dict(cached)
        cached["metadata"] = {**cached.get("metadata", {}), "cached": True}
        logger.info("climate risk cache hit: %s", cache_key)
        return cached

    try:
        from services.climate_guardian import climate_guardian

        result = await asyncio.to_thread(
            climate_guardian.get_risk_heatmap,
            min_lat, max_lat, min_lng, max_lng, date_str,
        )

        _cache_set(cache_key, result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in climate/risk: %s", e)
        return _empty_degraded_heatmap(f"Tính toán bản đồ rủi ro thất bại: {e}")


@router.post("/alternatives")
async def climate_alternatives(request_data: ClimateAlternativesRequest):
    """POST /api/ai/climate/alternatives → safe learning-location recommendations.

    Body: ``{"lat": 10.9525, "lng": 106.8778, "radius_km": 10,
    "category": "school"}`` (``category`` optional).

    Returns a GeoJSON ``FeatureCollection`` of safe alternative locations
    ranked by safety + distance, plus ``nearest_safe`` / ``nearest_unsafe``
    and ``metadata``.
    """
    lat, lng = request_data.lat, request_data.lng
    if request_data.min_lat is not None and request_data.max_lat is not None \
       and request_data.min_lng is not None and request_data.max_lng is not None:
        bbox = (request_data.min_lat, request_data.max_lat,
                request_data.min_lng, request_data.max_lng)
    else:
        bbox = _default_bbox(lat, lng, request_data.radius_km)

    cache_key = f"alt:{round(lat,6)}:{round(lng,6)}:{round(request_data.radius_km,1)}:{request_data.category or ''}"
    cached = _cache_get(cache_key)
    if cached is not None:
        cached = dict(cached)
        cached["metadata"] = {**cached.get("metadata", {}), "cached": True}
        logger.info("climate alternatives cache hit: %s", cache_key)
        return cached

    try:
        from services.climate_guardian import climate_guardian

        result = await asyncio.to_thread(
            climate_guardian.get_alternatives,
            lat, lng, bbox, request_data.radius_km, request_data.category,
        )

        _cache_set(cache_key, result)
        return result
    except Exception as e:
        logger.exception("Error in climate/alternatives: %s", e)
        # Graceful degradation: empty but valid GeoJSON.
        return {
            "type": "FeatureCollection",
            "features": [],
            "nearest_safe": None,
            "nearest_unsafe": None,
            "safe_count": 0,
            "unsafe_count": 0,
            "total_nearby": 0,
            "metadata": {
                "method": "climate_guardian_alternatives_v1",
                "degraded": True,
                "reason": f"Tính toán phương án thay thế thất bại: {e}",
                "center_lat": lat,
                "center_lng": lng,
                "radius_km": request_data.radius_km,
                "category_filter": request_data.category or "all",
                "last_updated": _date.today().isoformat(),
            },
        }
