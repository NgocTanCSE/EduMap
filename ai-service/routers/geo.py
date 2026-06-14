from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from services.llm_service import llm_service
from services.clustering_service import clustering_service
from models.geo_models import Point, GeoDensityAnalysisRequest

router = APIRouter(prefix="/api/ai/geo", tags=["8. AI Geo-Education Analysis"])

@router.post("/analyze")
async def analyze_geo_density(request: GeoDensityAnalysisRequest):
    """
    Phân tích mật độ cơ sở giáo dục bằng AI Gemini kết hợp với Clustering.
    """
    try:
        # 1. Tìm các cụm thực tế trước
        hubs = clustering_service.identify_education_hubs(request.points)
        
        # 2. Gửi dữ liệu cụm sang Gemini để nhận xét chuyên sâu
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
    """
    Phân tích vùng thiếu hụt giáo dục.
    """
    gaps = clustering_service.identify_gaps(request.school_points or [], {"lat": request.center_lat, "lng": request.center_lng})
    return {"status": "success", "gaps": gaps}

@router.get("/heatmap")
async def get_geo_heatmap():
    return {"status": "success", "message": "Heatmap logic integrated via ClusteringService."}

class GeoRecommendRequest(BaseModel):
    user_lat: float
    user_lng: float
    radius_km: float = 5.0

@router.post("/recommend")
async def recommend_nearby_opportunities(request: GeoRecommendRequest):
    try:
        # Giả lập lấy dữ liệu gần đây
        nearby_data = [
            {"id": "1", "name": "Hub Học thuật Trung tâm", "lat": request.user_lat + 0.002, "lng": request.user_lng + 0.002, "distance_km": 0.3}
        ]
        return {"status": "success", "recommendations": nearby_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
