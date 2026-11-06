

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from services.data_quality import data_quality_service
from services.clustering_service import clustering_service

router = APIRouter(prefix="/api/ai/data", tags=["✅ AI Data Trust & Anomaly Detector"])


class QualityReportRequest(BaseModel):
    """Payload cho POST /api/ai/data/quality/report.

    Tất cả trường đều OPTIONAL — chúng chỉ lọc thu hẹp tập dữ liệu, không
    bắt buộc. Server luôn trả về báo cáo đầy đủ nếu có dữ liệu.
    """
    category: Optional[str] = Field(
        None,
        description="Lọc theo category (university, school, library, ...). "
                    "Nếu để trống, kiểm tra toàn bộ.",
    )
    limit: Optional[int] = Field(
        500,
        ge=1,
        le=50000,
        description="Giới hạn số POI kiểm tra. Mặc định 500 để tránh timeout "
                    "trên HF Spaces. Tăng lên để kiểm tra toàn bộ.",
    )
    include_clean: Optional[bool] = Field(
        False,
        description="Nếu true, báo cáo kể cả POI không anomaly (dùng để debug).",
    )


class QualityReportResponse(BaseModel):
    summary: Dict[str, Any]
    anomalies: List[Dict[str, Any]]
    source_counts: Dict[str, int]


@router.post("/quality/report", response_model=QualityReportResponse)
async def data_quality_report(request: QualityReportRequest):
    """Tạo báo cáo chất lượng dữ liệu POI (AI Data Trust & Anomaly Detector).

    Kết hợp **rule-based checks** + **IsolationForest** (scikit-learn) để
    phát hiện:
      - Tọa độ thiếu / sai (ngoài biên giới VN)
      - Điểm ngoại lệ địa lý (IsolationForest, chunk 1000 hàng)
      - Trùng tên / trùng vị trí
      - Thiếu trường bắt buộc (name, address)
      - Dữ liệu lỗi thời
      - Trạng thái / nguồn không hợp lệ

    Kết quả được xếp thứ hạng ưu tiên (high > medium > low) với confidence
    min 0.7 cho IsolationForest-only anomalies (giảm false positive).
    """
    try:
        result = data_quality_service.report(
            category=request.category,
            limit=request.limit,
            include_clean=request.include_clean,
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        logger = __import__("logging").getLogger("data_quality")
        logger.error(f"data_quality_report failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi khi tạo báo cáo chất lượng dữ liệu: {str(e)}",
        )


@router.get("/quality/report", response_model=QualityReportResponse)
async def data_quality_report_get(
    category: Optional[str] = None,
    limit: Optional[int] = 500,
    include_clean: Optional[bool] = False,
):
    """GET variant — tiện cho testing / bookmarkable URL."""
    return await data_quality_report(QualityReportRequest(
        category=category,
        limit=limit,
        include_clean=include_clean,
    ))


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
    logger = logging.getLogger("data_quality")

    try:
        cs = clustering_service
        points = data.points or []


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
                pass


        if data.categories and points:
            cats_lower = {c.lower().strip() for c in data.categories}
            points = [
                p for p in points
                if str(p.get("category", "")).lower().strip() in cats_lower
            ]

        result = cs.identify_data_gaps(points, data.grid_size_km)


        if data.top_n and len(result.get("features", [])) > data.top_n:
            result["features"] = result["features"][:data.top_n]

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("data_quality/gaps failed: %s", e)

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
