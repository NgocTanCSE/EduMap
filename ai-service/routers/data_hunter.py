"""Router for /api/ai/data/* — Idea #6: Missing Data Hunter.

Endpoint: POST /api/ai/data/gaps

Phân tích độ bao phủ địa lý (grid-based coverage analysis) và phát hiện
thiếu hụt thuộc tính (attribute gap detection) trên tập hợp POI đã cho.

Response shape:
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {"type": "Polygon", "coordinates": [[[lng, lat], ...]]},
      "properties": {
        "cell_id": "row:col",
        "center": {"lat": float, "lng": float},
        "gap_type": "spatial",
        "gap_score": float,          # [0–1], higher = bigger gap
        "nearest_poi_distance_km": float,
        "points_in_cell": 0,
        "priority": "high"|"medium"|"low",
        "reason": str,
        "area": str
      }
    },
    ...
  ],
  "summary": {
    "total_cells": int,
    "gap_cells": int,
    "gap_rate": float,              # percentage
    "total_points": int,
    "grid_size_km": float,
    "attribute_gaps": { attr: {missing, total, pct} }
  },
  "attribute_gaps": {...},
  "metadata": {
    "method": "grid_based_coverage_analysis",
    "degraded": bool,
    "reason": str | None
  }
}
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from services.clustering_service import clustering_service

router = APIRouter(prefix="/api/ai/data", tags=["14. AI Missing Data Hunter"])


class DataGapsRequest(BaseModel):
    """Payload cho POST /api/ai/data/gaps.

    Attributes:
        points: danh sách POI, mỗi POI phải có lat/lng, các thuộc tính
                tuỳ chọn (name, address, city, district, description,
                category, source, verified, updated_at, rating_avg, ...)
                được dùng cho attribute-gap detection.
        grid_size_km: kích thước ô lưới vuông (km). Mặc định 1.0 km.
        bounds: bounding box lọc {minLat, maxLat, minLng, maxLng}.
        categories: lọc POI theo danh sách category (tuỳ chọn).
        top_n: số lượng ô gap trả về (mặc định 50, max 500).
    """
    points: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Danh sách POI (lat, lng, + thuộc tính tuỳ chọn)",
    )
    grid_size_km: float = Field(
        default=1.0, ge=0.1, le=50.0,
        description="Kích thước ô lưới vuông (km).",
    )
    bounds: Optional[Dict[str, float]] = Field(
        default=None,
        description="Bounding box lọc {minLat, maxLat, minLng, maxLng}",
    )
    categories: Optional[List[str]] = Field(
        default=None,
        description="Lọc POI theo category (tuỳ chọn).",
    )
    top_n: int = Field(
        default=50, ge=1, le=500,
        description="Số lượng ô gap trả về.",
    )


class DataGapsResponse(BaseModel):
    type: str
    features: List[Dict[str, Any]]
    summary: Dict[str, Any]
    attribute_gaps: Dict[str, Any]
    metadata: Dict[str, Any]


@router.post("/gaps", response_model=DataGapsResponse)
async def data_gaps(data: DataGapsRequest):
    """POST /api/ai/data/gaps — Missing Data Hunter.

    Thực hiện:
      1. **Grid-based coverage analysis**: chia vùngBoundingBox thành lưới ô
         vuông ``grid_size_km`` × ``grid_size_km``, đếm số POI trong mỗi ô.
         Các ô có 0 POI được đánh dấu là **spatial gap** — ứng cử viên khảo sát
         ưu tiên.
      2. **Attribute gap detection**: tổng hợp các thuộc tính POI bị thiếu
         (name, address, city, district, description, rating, website, hours,
         …) để đưa ra danh sách thông tin cần bổ sung.

    Trả về GeoJSON ``FeatureCollection`` với các ô gap (Polygon) được sắp xếp
    theo ``gap_score`` giảm dần, kèm ``summary`` và ``attribute_gaps``.

    Graceful degradation: nếu scikit-learn không khả dụng hoặc không có POI,
    trả về FeatureCollection rỗng với ``metadata.degraded = True`` — frontend
    luôn nhận được một đối tượng GeoJSON hợp lệ.
    """
    import logging
    logger = logging.getLogger("data_hunter")

    try:
        cs = clustering_service
        points = data.points or []

        # Áp dụng bounds filter nếu có
        if data.bounds and points:
            b = data.bounds
            try:
                points = [
                    p for p in points
                    if p.get("lat") is not None and p.get("lng") is not None
                    and float(p["lat"]) >= b.get("minLat", -90)
                    and float(p["lat"]) <= b.get("maxLat", 90)
                    and float(p["lng"]) >= b.get("minLng", -180)
                    and float(p["lng"]) <= b.get("maxLng", 180)
                ]
            except (TypeError, ValueError):
                pass  # bounds parse lỗi → không lọc

        # Áp dụng category filter nếu có
        if data.categories and points:
            cats_lower = {c.lower().strip() for c in data.categories}
            points = [
                p for p in points
                if str(p.get("category", "")).lower().strip() in cats_lower
            ]

        result = cs.identify_data_gaps(points, data.grid_size_km)

        # Giới hạn số lượng features trả về (trừ summary/attribute_gaps).
        if data.top_n and len(result.get("features", [])) > data.top_n:
            result["features"] = result["features"][:data.top_n]

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("data_hunter/gaps failed: %s", e)
        # Graceful degradation — luôn trả về GeoJSON hợp lệ.
        return {
            "type": "FeatureCollection",
            "features": [],
            "summary": {
                "total_cells": 0,
                "gap_cells": 0,
                "gap_rate": 0.0,
                "total_points": 0,
                "grid_size_km": data.grid_size_km,
                "attribute_gaps": {},
            },
            "attribute_gaps": {},
            "metadata": {
                "method": "grid_based_coverage_analysis",
                "degraded": True,
                "reason": f"Lỗi phân tích khoảng trống dữ liệu: {e}",
            },
        }


@router.get("/gaps", response_model=DataGapsResponse)
async def data_gaps_get(
    grid_size_km: float = 1.0,
    top_n: int = 50,
    min_lat: Optional[float] = None,
    max_lat: Optional[float] = None,
    min_lng: Optional[float] = None,
    max_lng: Optional[float] = None,
):
    """GET /api/ai/data/gaps — shortcut tiện cho testing / bookmarkable URL.

    Chỉ trả về một GeoJSON rỗng vì endpoint này không nhận POI qua query string.
    Để phân tích thực sự, dùng POST /api/ai/data/gaps với body chứa points.
    (Đây là convenience endpoint — backend sẽ gọi POST này với POIs từ DB.)
    """
    return {
        "type": "FeatureCollection",
        "features": [],
        "summary": {
            "total_cells": 0,
            "gap_cells": 0,
            "gap_rate": 0.0,
            "total_points": 0,
            "grid_size_km": grid_size_km,
            "attribute_gaps": {},
        },
        "attribute_gaps": {},
        "metadata": {
            "method": "grid_based_coverage_analysis",
            "degraded": True,
            "reason": "GET shortcut không nhận POI. Dùng POST /api/ai/data/gaps với body chứa points.",
        },
    }
