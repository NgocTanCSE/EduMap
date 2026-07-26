from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

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
    user_lat: float
    user_lng: float
    radius_km: float = 5.0
    category: Optional[str] = None
    limit: int = 10

@router.post("/analyze")
async def analyze_geo_density(request_data: dict):
    try:
        db, cs = _get_services()
        points = request_data.get('points', [])
        hubs = cs.identify_education_hubs(points) if cs and points else []
        
        try:
            from services.llm_service import llm_service
            if llm_service and llm_service.is_ready:
                analysis = await llm_service.analyze_geo_density(request_data, hubs)
            else:
                analysis = {"summary": "AI Service available - configure GEMINI_API_KEY for detailed analysis."}
        except:
            analysis = {"summary": "Geo analysis service ready"}
        
        return {"hubs": hubs, "ai_analysis": analysis}
    except Exception as e:
        print(f"Error in analyze_geo_density: {e}")
        return {"hubs": [], "ai_analysis": {"summary": "Geo analysis service temporarily unavailable"}}

@router.post("/analyze-gaps")
async def analyze_education_gaps(request_data: dict):
    try:
        db, cs = _get_services()
        points = request_data.get('school_points') or []
        center = {"lat": request_data.get('center_lat') or 10.9567, "lng": request_data.get('center_lng') or 107.1825}
        gaps = cs.identify_gaps(points, center) if cs else []
        return {"status": "success", "gaps": gaps}
    except Exception as e:
        print(f"Error in analyze_education_gaps: {e}")
        return {"status": "success", "gaps": []}

@router.post("/heatmap")
async def get_geo_heatmap(request_data: dict):
    try:
        db, cs = _get_services()
        points = request_data.get('school_points') or []
        region_center = {
            "lat": request_data.get('center_lat') or 10.9567,
            "lng": request_data.get('center_lng') or 107.1825
        }
        heatmap_data = cs.generate_heatmap_data(points, region_center, request_data.get('radius_km') or 5.0) if cs else []
        return {
            "status": "success", 
            "heatmap": heatmap_data,
            "center": region_center,
            "radius_km": request_data.get('radius_km') or 5.0,
            "total_points": len(heatmap_data)
        }
    except Exception as e:
        print(f"Error in get_geo_heatmap: {e}")
        return {"status": "success", "heatmap": []}

@router.post("/recommend")
async def recommend_nearby_opportunities(request_data: dict):
    try:
        db, cs = _get_services()
        if not db or not cs:
            return {"status": "success", "recommendations": [], "total_found": 0, "search_radius_km": 5.0, "center": {}}
        
        locations = db.get_nearby_locations(
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
            distance = cs._haversine_distance(
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
        return {"status": "success", "recommendations": []}