from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from models.geo_models import GeoDensityAnalysisRequest

router = APIRouter(prefix="/api/ai/geo", tags=["8. AI Geo-Education Analysis"])

# Lazy load services
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

@router.post("/analyze")
async def analyze_geo_density(data: GeoDensityAnalysisRequest):
    try:
        db, cs = _get_services()
        if cs is None:
            raise HTTPException(status_code=503, detail="Clustering service không khả dụng.")
        points = data.points or []
        hubs = cs.identify_education_hubs(points) if points else []

        from services.llm_service import llm_service
        if not llm_service:
            raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")
        analysis = await llm_service.analyze_geo_density(data, hubs)

        # Pass through degraded status if the AI method returned a fallback
        degraded = analysis.pop("_degraded", False) if isinstance(analysis, dict) else False
        reason = analysis.pop("_reason", None) if isinstance(analysis, dict) else None

        return {"hubs": hubs, "ai_analysis": analysis, "degraded": degraded, "reason": reason}
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
