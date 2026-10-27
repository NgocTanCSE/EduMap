"""Router for /api/ai/forecast/* endpoints — Idea #3: AI Educational Gap
Predictor.

Exposes the Holt's Linear + DBSCAN risk heatmap produced by
``predictive_service.predict_educational_gaps``:

* ``POST /api/ai/forecast/gaps`` — compute a fresh risk heatmap for a region.
* ``GET /api/ai/forecast/gaps/{region}`` — cached shortcut (24 h in-process
  LRU on the ai-service). The NestJS backend additionally caches the POST
  result for 24 h, so repeated region lookups hit memory, not the model.

Both return the GeoJSON FeatureCollection verbatim (the predictive service
already shapes the payload), plus ``heat_points`` for leaflet.heat,
``risk_ranking`` and ``metadata`` (which carries the ``degraded`` flag used by
the frontend to show the "dữ liệu hiếm → degraded" warning).
"""

from datetime import date as _date
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Tuple
import asyncio
import logging
import time

logger = logging.getLogger("forecast")

router = APIRouter(prefix="/api/ai/forecast", tags=["13. AI Educational Gap Forecast"])


class GapForecastRequest(BaseModel):
    """POST body for /api/ai/forecast/gaps."""
    region: Optional[str] = None
    steps_ahead: int = Field(default=3, ge=1, le=10,
                             description="Số năm dự báo tới (1-10)")


# ── In-process 24 h cache for the GET shortcut (HF Spaces: no Redis) ──────────
# Maps "region:steps" -> (expiry_epoch, result_dict). Eviction is lazy; the
# ai-service is a single-process FastAPI, so a plain dict + TTL is sufficient
# and avoids pulling in a cache dependency.
_GAP_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 24 * 3600


def _cache_get(key: str):
    entry = _GAP_CACHE.get(key)
    if not entry:
        return None
    expiry, value = entry
    if time.time() > expiry:
        _GAP_CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Dict[str, Any]):
    _GAP_CACHE[key] = (time.time() + _CACHE_TTL_SECONDS, value)


def _cache_key(region: Optional[str], steps_ahead: int) -> str:
    return f"{(region or 'all').strip().lower()}:{int(steps_ahead)}"


def _empty_degraded_geojson(region: Optional[str], reason: str, steps_ahead: int) -> Dict[str, Any]:
    """A valid-but-degraded GeoJSON returned only when the service itself is
    broken (not when the data is merely sparse — sparse data is handled inside
    the service with degraded=True)."""
    centroid = {"lat": 10.9567, "lng": 107.1825}
    return {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [centroid["lng"], centroid["lat"]]},
            "properties": {
                "region": region or "toàn quốc",
                "risk_score": 0.0,
                "risk_level": "low",
                "trend": "Chưa có dữ liệu",
                "needs_survey": False,
                "gap_type": "no_data",
            },
        }],
        "heat_points": [],
        "risk_ranking": [],
        "trends": [],
        "feature_importance": {"growth_risk": 0.4, "density_gap": 0.3, "access_risk": 0.3},
        "metadata": {
            "region": region or "toàn quốc",
            "method": "holt_linear_exponential_smoothing + dbscan",
            "degraded": True,
            "reason": reason,
            "data_points": 0,
            "pois_loaded": 0,
            "clusters": 0,
            "steps_ahead": steps_ahead,
            "last_updated": _date.today().isoformat(),
            "forecast_horizon_years": [],
            "holt_alpha": 0.3,
            "holt_beta": 0.1,
        },
    }


@router.post("/gaps")
async def forecast_educational_gaps(request_data: GapForecastRequest):
    """POST /api/ai/forecast/gaps → GeoJSON risk heatmap.

    Body: ``{"region": "Đồng Nai", "steps_ahead": 3}`` (``region`` optional).
    Returns a GeoJSON ``FeatureCollection`` with ``heat_points`` (for
    leaflet.heat), ``risk_ranking`` and per-metric Holt's forecasts. The
    response is marked ``metadata.degraded = true`` when data is sparse so the
    frontend can warn the user instead of silently showing a confident-looking
    prediction.
    """
    region = request_data.region
    steps_ahead = request_data.steps_ahead
    cache_key = _cache_key(region, steps_ahead)

    # 1. Cached shortcut (24 h in-process).
    cached = _cache_get(cache_key)
    if cached is not None:
        cached = dict(cached)
        cached["metadata"] = {**cached.get("metadata", {}), "cached": True}
        logger.info("gap forecast cache hit: %s", cache_key)
        return cached

    try:
        from services.predictive_service import predictive_service

        # Run the (CPU-bound) Holt + DBSCAN pipeline off the event loop so a
        # slow DBSCAN run can never stall other FastAPI requests. Mirrors the
        # asyncio.to_thread pattern used by analytics.py's /stats endpoint.
        result = await asyncio.to_thread(
            predictive_service.predict_educational_gaps, region, steps_ahead
        )

        # Cache the successful result (including degraded-but-valid results).
        _cache_set(cache_key, result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in forecast/gaps: %s", e)
        # Graceful degradation: a broken AI must never tear down the map.
        return _empty_degraded_geojson(region, f"Dự báo thất bại: {e}", steps_ahead)


@router.get("/gaps/{region}")
async def forecast_educational_gaps_get(region: str, steps_ahead: int = Query(default=3, ge=1, le=10)):
    """GET /api/ai/forecast/gaps/{region} — cached shortcut for a region.

    Convenience endpoint that delegates to the same Holt's + DBSCAN pipeline as
    ``POST /gaps`` and reuses the 24 h in-process cache. The NestJS backend's
    ``GET /api/map/gap-forecast`` is the primary entry point from the frontend;
    this GET form exists for direct curl/debugging and lightweight clients.
    """
    region = region.strip() or None
    cache_key = _cache_key(region, steps_ahead)
    cached = _cache_get(cache_key)
    if cached is not None:
        cached = dict(cached)
        cached["metadata"] = {**cached.get("metadata", {}), "cached": True}
        logger.info("gap forecast (GET) cache hit: %s", cache_key)
        return cached

    try:
        from services.predictive_service import predictive_service
        result = await asyncio.to_thread(
            predictive_service.predict_educational_gaps, region, steps_ahead
        )
        _cache_set(cache_key, result)
        return result
    except Exception as e:
        logger.exception("Error in forecast/gaps/%s: %s", region, e)
        return _empty_degraded_geojson(region, f"Dự báo thất bại: {e}", steps_ahead)
