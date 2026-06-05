from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from services.llm_service import LLMService

router = APIRouter(prefix="/api/ai/geo", tags=["8. AI Geo-Education Analysis"])
llm_service = LLMService()

class Point(BaseModel):
    name: str
    type: str
    lat: float
    lng: float

class GeoDensityAnalysisRequest(BaseModel):
    city: str
    points: List[Point]

@router.post("/analyze")
async def analyze_geo_density(request: GeoDensityAnalysisRequest):
    """
    Phân tích mật độ cơ sở giáo dục bằng AI Gemini.
    Giúp phát hiện vùng 'khát' tri thức và gợi ý đầu tư.
    """
    try:
        analysis = await llm_service.analyze_geo_density(request)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class GeoAnalysisRequest(BaseModel):
...
    school_points: List[Point]

# --- API Phân tích vùng thiếu hụt (Đã làm ở bài trước) ---
@router.post("/analyze-gaps")
async def analyze_education_gaps(request: GeoAnalysisRequest):
    # (Giữ nguyên logic cũ)
    return {"status": "success", "message": "Phát hiện 2 khu vực nguy cấp."}

@router.get("/heatmap")
async def get_geo_heatmap():
    # (Giữ nguyên logic cũ)
    return {"type": "FeatureCollection", "features": []}

# --- MỚI: API Gợi ý theo vị trí người dùng (Mục 6 Sheet 16) ---
class GeoRecommendRequest(BaseModel):
    user_lat: float
    user_lng: float
    radius_km: float = 5.0

@router.post("/recommend")
async def recommend_nearby_opportunities(request: GeoRecommendRequest):
    """
    AI nhận tọa độ User và quét Radar trong bán kính 5km.
    Thực tế: Dùng PostGIS ST_DWithin query database.
    Mock: Trả về dữ liệu giả lập để hiển thị UI.
    """
    try:
        # Giả lập AI tìm thấy 2 Mentor gần vị trí của User
        nearby_mentors = [
            {
                "id": "mentor_01",
                "name": "Nguyễn Văn A (Senior Backend)",
                "distance_km": 1.2,
                "lat": request.user_lat + 0.01,
                "lng": request.user_lng + 0.01,
                "ai_reason": "Mentor này ở rất gần bạn và có chuyên môn về NestJS mà bạn đang tìm kiếm."
            },
            {
                "id": "mentor_02",
                "name": "Trần Thị B (Data Scientist)",
                "distance_km": 3.5,
                "lat": request.user_lat - 0.02,
                "lng": request.user_lng + 0.02,
                "ai_reason": "Phù hợp với mục tiêu học Data của bạn trong bán kính 5km."
            }
        ]

        return {
            "status": "success",
            "user_location": {"lat": request.user_lat, "lng": request.user_lng},
            "radius_scanned": request.radius_km,
            "recommendations": nearby_mentors
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
