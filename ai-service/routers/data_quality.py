"""AI Data Trust & Anomaly Detector router.

Endpoint: POST /api/ai/data/quality/report

Phân tích toàn bộ POI (map_points + locations) và trả về danh sách anomaly
được xếp thứ hạng ưu tiên, kèm lý do và mức độ tin cậy.

Response shape:
{
  "summary": {
    "total_checked": int,
    "total_anomalies": int,
    "anomaly_rate": float,          # phần trăm
    "by_category": { <rule_key>: count, ... },
    "priority_breakdown": { "high": n, "medium": n, "low": n },
    "degraded": false
  },
  "anomalies": [
    {
      "id": str,
      "name": str | null,
      "category": str,
      "lat": float | null,
      "lng": float | null,
      "address": str | null,
      "city": str | null,
      "district": str | null,
      "source": str,
      "updated_at": str | null,
      "created_at": str | null,
      "anomaly_types": [str, ...],
      "reasons": [str, ...],
      "confidence": float,          # [0–1], min 0.7 cho IsolationForest-only
      "priority": "high"|"medium"|"low",
      "iforest_score": float | null
    },
    ...
  ],
  "source_counts": { "map_points": n, "locations": n }
}
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from services.data_quality import data_quality_service

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
