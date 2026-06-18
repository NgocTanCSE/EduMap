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

@router.post("/heatmap")
async def get_geo_heatmap(request: GeoAnalysisRequest):
    """
    Tạo dữ liệu heatmap cho visualization bản đồ giáo dục.
    """
    try:
        points = request.school_points or []
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
    """
    Gợi ý các cơ sở giáo dục và cơ hội gần vị trí người dùng.
    """
    try:
        # Giả lập dữ liệu nearby (trong thực tế sẽ query từ PostgreSQL/PostGIS)
        nearby_data = []
        
        # Tạo dữ liệu mẫu dựa trên vị trí người dùng
        sample_locations = [
            {"name": "Thư viện Công cộng Biên Hòa", "category": "library", "lat_offset": 0.005, "lng_offset": 0.003},
            {"name": "Trường THPT Biên Hòa", "category": "school", "lat_offset": -0.003, "lng_offset": 0.004},
            {"name": "Quan Cafe Study Plus", "category": "cafe", "lat_offset": 0.002, "lng_offset": -0.002},
            {"name": "Công viên Thành phố", "category": "park", "lat_offset": -0.004, "lng_offset": -0.003},
            {"name": "Trung tâm STEM DNTU", "category": "education", "lat_offset": 0.001, "lng_offset": 0.001},
            {"name": "WiFi Zone - McDonald's", "category": "wifi", "lat_offset": 0.003, "lng_offset": -0.001},
            {"name": "Nhà sách Fahasa", "category": "bookstore", "lat_offset": -0.002, "lng_offset": 0.002},
            {"name": "Trung tâm Tâm lý Giáo dục", "category": "education", "lat_offset": 0.004, "lng_offset": 0.002},
        ]
        
        for i, loc in enumerate(sample_locations):
            # Lọc theo category nếu có
            if request.category and loc['category'] != request.category:
                continue
            
            loc_lat = request.user_lat + loc['lat_offset']
            loc_lng = request.user_lng + loc['lng_offset']
            
            # Tính khoảng cách thực tế
            distance = clustering_service._haversine_distance(
                request.user_lat, request.user_lng,
                loc_lat, loc_lng
            )
            
            if distance <= request.radius_km:
                nearby_data.append({
                    "id": str(i + 1),
                    "name": loc['name'],
                    "category": loc['category'],
                    "lat": float(loc_lat),
                    "lng": float(loc_lng),
                    "distance_km": round(distance, 2),
                    "rating": round(4.0 + (i % 10) / 10, 1),
                    "is_free": loc['category'] in ['park', 'library', 'wifi']
                })
        
        # Sắp xếp theo khoảng cách
        nearby_data.sort(key=lambda x: x['distance_km'])
        
        # Giới hạn số kết quả
        nearby_data = nearby_data[:request.limit]
        
        return {
            "status": "success",
            "recommendations": nearby_data,
            "total_found": len(nearby_data),
            "search_radius_km": request.radius_km,
            "center": {"lat": request.user_lat, "lng": request.user_lng}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
