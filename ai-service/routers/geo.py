from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from services.llm_service import llm_service
from services.clustering_service import clustering_service
from services.db_service import db_service
from models.geo_models import Point, GeoDensityAnalysisRequest

router = APIRouter(prefix="/api/ai/geo", tags=["8. AI Geo-Education Analysis"])

@router.post("/analyze")
async def analyze_geo_density(request: GeoDensityAnalysisRequest):
    try:
        points = request.points if request.points else db_service.get_locations_for_analysis()
        hubs = clustering_service.identify_education_hubs(points)
        analysis = await llm_service.analyze_geo_density(request, hubs)
        return {
            "hubs": hubs,
            "ai_analysis": analysis
        }
    except Exception as e:
        print(f"Error in analyze_geo_density: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class GeoAnalysisRequest(BaseModel):
    region_name: Optional[str] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[float] = None
    school_points: Optional[List[dict]] = None

@router.post("/analyze-gaps")
async def analyze_education_gaps(request: GeoAnalysisRequest):
    try:
        points = request.school_points or db_service.get_locations_for_analysis()
        center = {"lat": request.center_lat or 10.9567, "lng": request.center_lng or 107.1825}
        gaps = clustering_service.identify_gaps(points, center)
        return {"status": "success", "gaps": gaps}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/heatmap")
async def get_geo_heatmap(request: GeoAnalysisRequest):
    try:
        points = request.school_points or db_service.get_locations_for_analysis()
        region_center = {
            "lat": request.center_lat or 10.9567,
            "lng": request.center_lng or 107.1825
        }
        
        heatmap_data = clustering_service.generate_heatmap_data(
            points, 
            region_center,
            request.radius_km or 5.0
        )
        
        return {
            "status": "success", 
            "heatmap": heatmap_data,
            "center": region_center,
            "radius_km": request.radius_km or 5.0,
            "total_points": len(heatmap_data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class GeoRecommendRequest(BaseModel):
    user_lat: float
    user_lng: float
    radius_km: float = 5.0
    category: Optional[str] = None
    limit: int = 10

@router.post("/recommend")
async def recommend_nearby_opportunities(request: GeoRecommendRequest):
    try:
        nearby_data = []
        locations = db_service.get_nearby_locations(
            request.user_lat, 
            request.user_lng, 
            request.radius_km, 
            request.category, 
            request.limit * 3
        )
        
        for i, loc in enumerate(locations):
            loc_lat = loc.get('lat')
            loc_lng = loc.get('lng')
            
            if loc_lat is None or loc_lng is None:
                continue
            
            distance = clustering_service._haversine_distance(
                request.user_lat, request.user_lng,
                float(loc_lat), float(loc_lng)
            )
            
            if distance <= request.radius_km:
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
        nearby_data = nearby_data[:request.limit]
        
        if not nearby_data:
            return {
                "status": "success",
                "recommendations": [],
                "total_found": 0,
                "search_radius_km": request.radius_km,
                "center": {"lat": request.user_lat, "lng": request.user_lng},
                "message": "Không tìm thấy địa điểm nào trong bán kính."
            }
        
        return {
            "status": "success",
            "recommendations": nearby_data,
            "total_found": len(nearby_data),
            "search_radius_km": request.radius_km,
            "center": {"lat": request.user_lat, "lng": request.user_lng}
        }
    except Exception as e:
        print(f"Error in recommend_nearby_opportunities: {e}")
        raise HTTPException(status_code=500, detail=str(e))