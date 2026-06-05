from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from services.llm_service import llm_service
from models.geo_models import Point, GeoDensityAnalysisRequest # Import from models

router = APIRouter(prefix="/api/ai/geo", tags=["8. AI Geo-Education Analysis"])

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
        # Defensive Programming: Log and raise HTTPException
        print(f"Error in analyze_geo_density endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred during geo density analysis: {e}")

class GeoAnalysisRequest(BaseModel):
    # This model needs to be defined more thoroughly if it's used elsewhere
    # For now, it's just a placeholder as its usage is static/mocked below.
    # Assuming it takes lat/lng for a region or similar.
    # For this task, we will just keep it simple.
    region_name: Optional[str] = None
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_km: Optional[float] = None
    school_points: Optional[List[Point]] = None


# --- NEW: Function to simulate PostGIS query ---
async def get_nearby_mentors_from_db(user_lat: float, user_lng: float, radius_km: float) -> List[dict]:
    """
    Placeholder for actual PostGIS query.
    In a real implementation, this would connect to PostgreSQL with PostGIS extension
    and execute a query like:
    SELECT id, name, lat, lng, ST_DistanceSphere(ST_MakePoint(lng, lat), ST_MakePoint(:user_lng, :user_lat)) / 1000 AS distance_km
    FROM mentors
    WHERE ST_DWithin(ST_MakePoint(lng, lat)::geography, ST_MakePoint(:user_lng, :user_lat)::geography, :radius_km * 1000)
    ORDER BY distance_km
    LIMIT 10;

    For now, returning mock data that simulates fetching from DB based on request.
    This mock logic should be replaced by actual DB call.
    """
    
    # Simulate finding some mentors (simplified mock logic)
    mock_mentors = [
        {"id": "db_mentor_1", "name": "Nguyễn Thị C (DevOps)", "lat": user_lat + 0.005, "lng": user_lng - 0.005, "distance_km": 0.5},
        {"id": "db_mentor_2", "name": "Lê Văn D (Frontend)", "lat": user_lat - 0.01, "lng": user_lng + 0.008, "distance_km": 1.2},
        {"id": "db_mentor_3", "name": "Phạm Thị E (QA)", "lat": user_lat + 0.015, "lng": user_lng + 0.012, "distance_km": 1.8},
    ]
    
    # Filter based on radius_km (simplified, real PostGIS does this spatially)
    results = [
        m for m in mock_mentors if m["distance_km"] <= radius_km
    ]
    
    return results


# --- API Phân tích vùng thiếu hụt (Đã làm ở bài trước) ---
@router.post("/analyze-gaps")
async def analyze_education_gaps(request: GeoAnalysisRequest):
    """
    Phân tích vùng thiếu hụt giáo dục.
    Cần tích hợp với cơ sở dữ liệu để lấy dữ liệu thực về các cơ sở giáo dục.
    """
    # Defensive Programming: Add input validation if request is complex
    if not request.region_name and not request.school_points:
        raise HTTPException(status_code=400, detail="Either 'region_name' or 'school_points' must be provided for gap analysis.")

    # Hiện tại vẫn giữ phản hồi tĩnh, cần triển khai logic thực tế ở đây
    print(f"Analyze education gaps requested for region: {request.region_name} with {len(request.school_points) if request.school_points else 0} points.")
    return {"status": "success", "message": "Phân tích vùng thiếu hụt cần được triển khai với dữ liệu thực."}

@router.get("/heatmap")
async def get_geo_heatmap():
    """
    Lấy dữ liệu heatmap địa lý.
    Cần tích hợp với cơ sở dữ liệu để lấy dữ liệu thực về mật độ/thông tin địa lý.
    """
    # Hiện tại vẫn giữ phản hồi tĩnh, cần triển khai logic thực tế ở đây
    print("Geo heatmap data requested. Returning static response.")
    return {"type": "FeatureCollection", "features": [], "message": "Dữ liệu heatmap cần được triển khai với dữ liệu thực."}

# --- MỚI: API Gợi ý theo vị trí người dùng (Mục 6 Sheet 16) ---
class GeoRecommendRequest(BaseModel):
    user_lat: float
    user_lng: float
    radius_km: float = 5.0

@router.post("/recommend")
async def recommend_nearby_opportunities(request: GeoRecommendRequest):
    """
    AI nhận tọa độ User và quét Radar trong bán kính.
    Thực tế: Dùng PostGIS ST_DWithin query database.
    """
    try:
        # Defensive Programming: Validate radius_km
        if not (0 < request.radius_km <= 100): # Example range, adjust as needed
            raise HTTPException(status_code=400, detail="radius_km must be between 0 and 100.")

        # Get real data from the database (simulated for now)
        nearby_mentors_data = await get_nearby_mentors_from_db(
            request.user_lat, request.user_lng, request.radius_km
        )

        recommendations = []
        for mentor in nearby_mentors_data:
            # For ai_reason, a simple placeholder or call to LLM_service for more detailed reasoning
            # Defensive Programming: Ensure all expected keys exist in mentor dict
            mentor_name = mentor.get("name", "Unknown Mentor")
            distance = mentor.get("distance_km", 0.0)
            ai_reason_placeholder = f"Mentor này ({mentor_name}) ở gần bạn ({distance:.1f} km) và phù hợp với lĩnh vực của bạn."
            
            recommendations.append({
                "id": mentor.get("id", "no_id"),
                "name": mentor_name,
                "distance_km": distance,
                "lat": mentor.get("lat", 0.0),
                "lng": mentor.get("lng", 0.0),
                "ai_reason": ai_reason_placeholder
            })
        
        # If no mentors found, provide a message
        if not recommendations:
            return {
                "status": "success",
                "message": "Không tìm thấy mentor nào trong bán kính quy định. Vui lòng thử lại với bán kính lớn hơn.",
                "user_location": {"lat": request.user_lat, "lng": request.user_lng},
                "radius_scanned": request.radius_km,
                "recommendations": []
            }

        return {
            "status": "success",
            "user_location": {"lat": request.user_lat, "lng": request.user_lng},
            "radius_scanned": request.radius_km,
            "recommendations": recommendations
        }
    except HTTPException as e:
        raise e # Re-raise HTTP exceptions caught from validation
    except Exception as e:
        # Defensive Programming: Log and return error
        print(f"Error in recommend_nearby_opportunities: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")
