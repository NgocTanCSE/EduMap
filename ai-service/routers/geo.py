from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
try:
    import numpy as np
    NUMPY_OK = True
except ImportError:
    NUMPY_OK = False

router = APIRouter(prefix="/api/ai/geo", tags=["8. AI Geo-Education Analysis"])

@router.post("/analyze")
async def analyze_geo_density(request_data: dict):
    try:
        from services.llm_service import llm_service
        from services.clustering_service import clustering_service
        from services.db_service import db_service
        points = request_data.get('points', [])
        hubs = clustering_service.identify_education_hubs(points) if points else []
        analysis = await llm_service.analyze_geo_density(request_data, hubs) if llm_service else {"summary": "AI unavailable"}
        return {"hubs": hubs, "ai_analysis": analysis}
    except Exception as e:
        print(f"Error in analyze_geo_density: {e}")
        return {"hubs": [], "ai_analysis": {"summary": "Geo analysis service temporarily unavailable"}}

class GeoAnalysisRequest(BaseModel):
    region_name: Optional[str] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[float] = None
    school_points: Optional[List[dict]] = None

@router.post("/analyze-gaps")
async def analyze_education_gaps(request_data: dict):
    try:
        from services.clustering_service import clustering_service
        from services.db_service import db_service
        points = request_data.get('school_points') or []
        center = {"lat": request_data.get('center_lat') or 10.9567, "lng": request_data.get('center_lng') or 107.1825}
        gaps = clustering_service.identify_gaps(points, center) if points else []
        return {"status": "success", "gaps": gaps}
    except Exception as e:
        print(f"Error in analyze_education_gaps: {e}")
        return {"status": "error", "gaps": []}

@router.post("/heatmap")
async def get_geo_heatmap(request_data: dict):
    try:
        from services.clustering_service import clustering_service
        points = request_data.get('school_points') or []
        region_center = {
            "lat": request_data.get('center_lat') or 10.9567,
            "lng": request_data.get('center_lng') or 107.1825
        }
        heatmap_data = clustering_service.generate_heatmap_data(points, region_center, request_data.get('radius_km') or 5.0)
        return {
            "status": "success", 
            "heatmap": heatmap_data,
            "center": region_center,
            "radius_km": request_data.get('radius_km') or 5.0,
            "total_points": len(heatmap_data)
        }
    except Exception as e:
        print(f"Error in get_geo_heatmap: {e}")
        return {"status": "error", "heatmap": []}

class GeoRecommendRequest(BaseModel):
    user_lat: float
    user_lng: float
    radius_km: float = 5.0
    category: Optional[str] = None
    limit: int = 10

@router.post("/recommend")
async def recommend_nearby_opportunities(request_data: dict):
    try:
        from services.clustering_service import clustering_service
        from services.db_service import db_service
        if db_service is None:
            return {"status": "success", "recommendations": [], "total_found": 0, "search_radius_km": 5.0, "center": {}}
            
        locations = db_service.get_nearby_locations(
            request_data.get('user_lat'), 
            request_data.get('user_lng'), 
            request_data.get('radius_km') or 5.0,
            request_data.get('category'),
            (request_data.get('limit') or 10) * 3
        ) or []

        nearby_data = []
        for i, loc in enumerate(locations):
            loc_lat = loc.get('lat')
            loc_lng = loc.get('lng')
            if loc_lat is None or loc_lng is None:
                continue
            distance = clustering_service._haversine_distance(
                request_data.get('user_lat'), request_data.get('user_lng'),
                float(loc_lat), float(loc_lng)
            )
            if distance <= (request_data.get('radius_km') or 5.0):
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
        nearby_data = nearby_data[:request_data.get('limit') or 10]
        return {
            "status": "success",
            "recommendations": nearby_data,
            "total_found": len(nearby_data),
            "search_radius_km": request_data.get('radius_km') or 5.0,
            "center": {"lat": request_data.get('user_lat'), "lng": request_data.get('user_lng')}
        }
    except Exception as e:
        print(f"Error in recommend_nearby_opportunities: {e}")
        return {"status": "error", "recommendations": []}