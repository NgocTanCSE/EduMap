from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os

from models.geo_models import GeoDensityAnalysisRequest, VisionDetectRequest

router = APIRouter(prefix="/api/ai/geo", tags=["8. AI Geo-Education Analysis"])


GEO_VISION_MODEL = os.getenv("GEO_VISION_MODEL", "google/owlv2-base-patch16-ensemble")

_geo_vision_down_until = 0.0
GEO_VISION_TIMEOUT = float(os.getenv("GEO_VISION_TIMEOUT_SECONDS", "25"))
GEO_VISION_DEFAULT_LABELS = [
    "school", "university", "educational institution", "college",
    "building", "campus", "library",
]















def _strip_data_uri(b64: str) -> str:
    """Remove the 'data:image/png;base64,' prefix if present."""
    if not b64:
        return ""
    if "," in b64 and b64.startswith("data:"):
        return b64.split(",", 1)[1]
    return b64


_services_loaded = False
_db_service = None
_clustering_service = None

def _get_services():
    global _services_loaded, _db_service, _clustering_service
    if not _services_loaded:
        try:
            from services.db_service import db_service as db
            _db_service = db
        except:
            pass
        try:
            from services.clustering_service import clustering_service as cs
            _clustering_service = cs
        except:
            pass
        _services_loaded = True
    return _db_service, _clustering_service

class GeoAnalysisRequest(BaseModel):
    region_name: Optional[str] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[float] = None
    school_points: Optional[List[dict]] = None

class GeoRecommendRequest(BaseModel):
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None
    radius_km: float = 5.0
    category: Optional[str] = None
    limit: int = 10

GEO_ANALYSIS_MIN_POINTS = int(os.getenv("GEO_ANALYSIS_MIN_POINTS", "10"))


def _bbox_area_km2(bbox: dict) -> float:
    import math
    lat1, lat2 = bbox["min_lat"], bbox["max_lat"]
    lng1, lng2 = bbox["min_lng"], bbox["max_lng"]
    mid = math.radians((lat1 + lat2) / 2.0)
    height = abs(lat2 - lat1) * 110.574
    width = abs(lng2 - lng1) * 111.320 * max(math.cos(mid), 0.01)
    return max(height * width, 0.01)


def _summarize_points(points: List[dict]) -> dict:
    """Count what is actually in the payload — no estimates, no extrapolation."""
    by_category: dict = {}
    lats: List[float] = []
    lngs: List[float] = []
    for p in points:
        try:
            lat = float(p.get("lat"))
            lng = float(p.get("lng"))
        except (TypeError, ValueError):
            continue
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
            continue
        lats.append(lat)
        lngs.append(lng)
        key = str(p.get("category") or p.get("type") or "other")
        by_category[key] = by_category.get(key, 0) + 1

    stats = {
        "total": len(lats),
        "by_category": by_category,
        "bbox": None,
        "area_km2": None,
        "density_per_km2": None,
    }
    if lats and lngs:
        bbox = {
            "min_lat": min(lats),
            "max_lat": max(lats),
            "min_lng": min(lngs),
            "max_lng": max(lngs),
        }
        area = _bbox_area_km2(bbox)
        stats["bbox"] = bbox
        stats["area_km2"] = round(area, 2)
        stats["density_per_km2"] = round(len(lats) / area, 2)
    return stats


def _data_only_analysis(city: str, stats: dict) -> dict:
    """Analysis built strictly from counted POIs (used when the sample is thin)."""
    total = stats.get("total", 0)
    by_cat = stats.get("by_category", {}) or {}
    top = sorted(by_cat.items(), key=lambda kv: kv[1], reverse=True)[:4]
    detail = ", ".join(f"{name}: {count}" for name, count in top)

    if total == 0:
        summary = (
            f"Chưa có địa điểm nào của EduMap trong khu vực {city}. "
            "Không đủ dữ liệu để phân tích mật độ."
        )
    else:
        summary = (
            f"Khu vực {city} có {total} địa điểm trong dữ liệu EduMap"
            + (f" ({detail})" if detail else "")
            + (
                f", mật độ {stats.get('density_per_km2')} địa điểm/km²."
                if stats.get("density_per_km2") is not None
                else "."
            )
            + " Mẫu còn mỏng nên chưa đủ cơ sở để kết luận về khoảng trống giáo dục."
        )

    recommendations = []
    for name, count in top:
        if count > 0:
            recommendations.append(f"Đã có {count} địa điểm loại {name} trong dữ liệu.")

    return {
        "summary": summary,
        "density_score": stats.get("density_per_km2"),
        "recommendations": recommendations,
    }


@router.post("/analyze")
async def analyze_geo_density(data: GeoDensityAnalysisRequest):
    try:
        points = data.points or []
        stats = _summarize_points(points)

        if stats["total"] < GEO_ANALYSIS_MIN_POINTS:
            return {
                "hubs": [],
                "ai_analysis": _data_only_analysis(data.city or "khu vực này", stats),
                "degraded": True,
                "reason": (
                    f"Chỉ có {stats['total']} địa điểm trong dữ liệu "
                    f"(cần tối thiểu {GEO_ANALYSIS_MIN_POINTS}) — trả về mô tả dữ liệu thật, "
                    "không gọi mô hình ngôn ngữ."
                ),
                "stats": stats,
            }

        db, cs = _get_services()
        if cs is None:
            raise HTTPException(status_code=503, detail="Clustering service không khả dụng.")
        hubs = cs.identify_education_hubs(points) if points else []

        from services.llm_service import llm_service
        if not llm_service:
            raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")
        analysis = await llm_service.analyze_geo_density(data, hubs, stats=stats)

        degraded = analysis.pop("_degraded", False) if isinstance(analysis, dict) else False
        reason = analysis.pop("_reason", None) if isinstance(analysis, dict) else None

        if isinstance(analysis, dict) and analysis.get("density_score") is None:
            analysis["density_score"] = stats.get("density_per_km2")

        return {
            "hubs": hubs,
            "ai_analysis": analysis,
            "degraded": degraded,
            "reason": reason,
            "stats": stats,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in analyze_geo_density: {e}")
        raise HTTPException(status_code=503, detail="Geo analysis service không khả dụng.")

@router.post("/analyze-gaps")
async def analyze_education_gaps(data: GeoAnalysisRequest):
    try:
        db, cs = _get_services()
        if cs is None:
            raise HTTPException(status_code=503, detail="Clustering service không khả dụng.")
        points = data.school_points or []
        center = {"lat": data.center_lat or 10.9567, "lng": data.center_lng or 107.1825}
        gaps = cs.identify_gaps(points, center)
        return {"status": "success", "gaps": gaps}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in analyze_education_gaps: {e}")
        raise HTTPException(status_code=503, detail="Không phân tích được khoảng trống giáo dục.")

@router.post("/heatmap")
async def get_geo_heatmap(data: GeoAnalysisRequest):
    try:
        db, cs = _get_services()
        if cs is None:
            raise HTTPException(status_code=503, detail="Clustering service không khả dụng.")
        points = data.school_points or []
        region_center = {
            "lat": data.center_lat or 10.9567,
            "lng": data.center_lng or 107.1825
        }
        radius_km = data.radius_km or 5.0
        heatmap_data = cs.generate_heatmap_data(points, region_center, radius_km) or []
        return {
            "status": "success",
            "heatmap": heatmap_data,
            "center": region_center,
            "radius_km": radius_km,
            "total_points": len(heatmap_data)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_geo_heatmap: {e}")
        raise HTTPException(status_code=503, detail="Không tạo được bản đồ nhiệt.")

@router.post("/recommend")
async def recommend_nearby_opportunities(data: GeoRecommendRequest):
    try:
        db, cs = _get_services()
        if not db or not cs:
            raise HTTPException(status_code=503, detail="Dịch vụ bản đồ chưa sẵn sàng.")

        locations = db.get_nearby_locations(
            data.user_lat,
            data.user_lng,
            data.radius_km or 5.0,
            data.category,
            (data.limit or 10) * 3
        ) or []

        nearby_data = []
        for i, loc in enumerate(locations):
            loc_lat = loc.get('lat')
            loc_lng = loc.get('lng')
            if loc_lat is None or loc_lng is None:
                continue
            distance = cs._haversine_distance(
                data.user_lat, data.user_lng,
                float(loc_lat), float(loc_lng)
            )
            if distance <= (data.radius_km or 5.0):
                category = loc.get('type', 'other') or loc.get('category_id', 'other')
                nearby_data.append({
                    "id": str(loc.get('id', i)),
                    "name": loc.get('name', 'Unknown'),
                    "category": category,
                    "lat": float(loc_lat),
                    "lng": float(loc_lng),
                    "distance_km": round(distance, 2),
                    "rating": float(loc.get('rating_avg', 4.0)),
                    "is_free": category in ['library', 'wifi', 'green', 'park']
                })

        nearby_data.sort(key=lambda x: x.get('distance_km', 999))
        nearby_data = nearby_data[:data.limit or 10]
        return {
            "status": "success",
            "recommendations": nearby_data,
            "total_found": len(nearby_data),
            "search_radius_km": data.radius_km or 5.0,
            "center": {"lat": data.user_lat, "lng": data.user_lng}
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in recommend_nearby_opportunities: {e}")
        raise HTTPException(status_code=503, detail="Không gợi đề xuất được địa điểm gần bạn.")


@router.post("/vision-detect")
async def vision_detect(request: VisionDetectRequest):
    """
    GeoVision AI (Idea #10) — satellite imagery facility detection.

    Returns detection results: [{score, label, box:{xmin,ymin,xmax,ymax}}].

    Degrades gracefully when no vision provider is configured: on provider
    absence, returns an empty detections list with degraded=True — the
    frontend orchestrator surfaces "AI unavailable, 0 detections found".
    """
    labels = request.labels or GEO_VISION_DEFAULT_LABELS
    image_b64 = _strip_data_uri(request.image_base64)
    used_model = GEO_VISION_MODEL
    detection_source = "hf_api"

    if not image_b64:
        return {
            "detections": [],
            "model": GEO_VISION_MODEL,
            "degraded": True,
            "error": "image_base64 is required and non-empty",
        }

    try:

        # No external vision provider is configured for this host. GeoVision
        # AI degrades gracefully (never 502): the frontend surfaces "AI
        # unavailable, requesting a vision provider" instead of a crash.
        print("[GeoVision] degraded — no vision provider configured for this host")
        return {
            "detections": [],
            "model": GEO_VISION_MODEL,
            "degraded": True,
            "degradation_reason": "No external vision provider configured on this host.",
            "error": None,
            "source": "none",
        }
    except RuntimeError as e:
        print(f"[GeoVision] vision detection degraded: {e}")
        return {
            "detections": [],
            "model": GEO_VISION_MODEL,
            "degraded": True,
            "error": str(e)[:300],
            "source": "none",
        }
    except Exception as e:
        print(f"[GeoVision] Unexpected error: {e}")
        return {
            "detections": [],
            "model": GEO_VISION_MODEL,
            "degraded": True,
            "error": str(e)[:300],
            "source": "none",
        }
