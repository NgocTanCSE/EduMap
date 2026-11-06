

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Optional
import time

from services.auto_scheduler import (
    auto_scheduler,
    AutoCache,
    TASK_REGISTRY,
    AUTO_REGIONS,
    AUTO_ENABLED,
)
from services.auto_scheduler import _run_chroma_seed

router = APIRouter(prefix="/api/ai/auto", tags=["Auto Scheduler"])


@router.get("/health")
async def get_auto_scheduler_health():
    """Trạng thái tổng thể của auto-scheduler: scheduler có chạy không,
    mỗi task chạy lần cuối khi nào, cache hit/miss counts."""
    return auto_scheduler.health()




@router.get("/chroma/seed-status")
async def get_chroma_seed_status(refresh: Optional[bool] = False):
    """Trạng thái re-seed ChromaDB. Set ?refresh=true để trigger ngay."""
    result = auto_scheduler.get_result("chroma_seed")
    if (not result or refresh) and AUTO_ENABLED:

        import threading
        t = threading.Thread(target=auto_scheduler.run_once, args=("chroma_seed",), daemon=True)
        t.start()
        if not result:
            return JSONResponse(
                status_code=202,
                content={"status": "warming", "message": "ChromaDB re-seed đang chạy...", "task": "chroma_seed"},
            )
    if not result:
        return JSONResponse(
            status_code=202,
            content={"status": "warming", "message": "Chưa có dữ liệu. Scheduler sẽ tự động re-seed.", "task": "chroma_seed"},
        )
    return result




@router.get("/question-gaps")
async def get_cached_question_gaps(refresh: Optional[bool] = False):
    """Báo cáo khoảng trống câu hỏi — auto-tính toán."""
    result = auto_scheduler.get_result("question_gaps")
    if (not result or refresh) and AUTO_ENABLED:
        import threading
        t = threading.Thread(target=auto_scheduler.run_once, args=("question_gaps",), daemon=True)
        t.start()
        if not result:
            return JSONResponse(
                status_code=202,
                content={"status": "warming", "message": "Đang phân tích khoảng trống câu hỏi...", "task": "question_gaps"},
            )
    if not result:
        return JSONResponse(
            status_code=202,
            content={"status": "warming", "message": "Chưa có báo cáo. Scheduler sẽ tính toán.", "task": "question_gaps"},
        )
    return result




@router.get("/resource-exchange/matches")
async def get_cached_resource_exchange(refresh: Optional[bool] = False):
    """Kết quả ghép nối nguồn lực ↔ yêu cầu — auto tính toán."""
    result = auto_scheduler.get_result("resource_exchange")
    if (not result or refresh) and AUTO_ENABLED:
        import threading
        t = threading.Thread(target=auto_scheduler.run_once, args=("resource_exchange",), daemon=True)
        t.start()
        if not result:
            return JSONResponse(
                status_code=202,
                content={
                    "status": "warming",
                    "message": "Đang tính toán ghép nối nguồn lực...",
                    "task": "resource_exchange",
                    "ranked_matches": [], "transport_plan": [],
                },
            )
    if not result:
        return JSONResponse(
            status_code=202,
            content={
                "status": "warming",
                "message": "Chưa có kết quả. Scheduler sẽ tự động chạy.",
                "task": "resource_exchange",
                "ranked_matches": [], "transport_plan": [],
            },
        )
    return result




@router.get("/impact-match/rankings")
async def get_cached_impact_match(refresh: Optional[bool] = False):
    """Kết quả ghép nối nhu cầu ↔ nhà tài trợ — auto tính toán."""
    result = auto_scheduler.get_result("impact_match")
    if (not result or refresh) and AUTO_ENABLED:
        import threading
        t = threading.Thread(target=auto_scheduler.run_once, args=("impact_match",), daemon=True)
        t.start()
        if not result:
            return JSONResponse(
                status_code=202,
                content={
                    "status": "warming",
                    "message": "Đang tính toán ghép nối tác động...",
                    "task": "impact_match",
                    "ranked_matches": [],
                },
            )
    if not result:
        return JSONResponse(
            status_code=202,
            content={
                "status": "warming",
                "message": "Chưa có kết quả. Scheduler sẽ tự động chạy.",
                "task": "impact_match",
                "ranked_matches": [],
            },
        )
    return result




@router.get("/impact-measurement/{region_id}")
async def get_cached_impact_measure(region_id: str, refresh: Optional[bool] = False):
    """Báo cáo đo lường tác động cho một vùng."""

    cached_overall = auto_scheduler.get_result("impact_measure")
    if cached_overall and cached_overall.get("data", {}).get("regions", {}).get(region_id):
        return _make_impact_result(cached_overall["data"]["regions"][region_id],
                                   region_id, refresh)

    if not cached_overall and AUTO_ENABLED:
        import threading
        t = threading.Thread(target=auto_scheduler.run_once, args=("impact_measure",), daemon=True)
        t.start()

    return JSONResponse(
        status_code=202,
        content={
            "status": "warming",
            "message": f"Chưa có báo cáo tác động cho {region_id}. Scheduler đang tính toán.",
            "task": "impact_measure",
            "region_id": region_id,
        },
    )


def _make_impact_result(region_data: dict, region_id: str, refresh: bool):
    if refresh and AUTO_ENABLED:
        import threading
        t = threading.Thread(target=auto_scheduler.run_once, args=("impact_measure",), daemon=True)
        t.start()
    return region_data




@router.get("/climate-risk/{region_id}")
async def get_cached_climate_risk(region_id: str, refresh: Optional[bool] = False):
    """Bản đồ rủi ro khí hậu cho một vùng đã được auto-tính toán."""
    cached_overall = auto_scheduler.get_result("climate_risk")
    if cached_overall and cached_overall.get("data", {}).get("regions", {}).get(region_id):
        return _make_impact_result(cached_overall["data"]["regions"][region_id],
                                   region_id, refresh)

    if not cached_overall and AUTO_ENABLED:
        import threading
        t = threading.Thread(target=auto_scheduler.run_once, args=("climate_risk",), daemon=True)
        t.start()

    return JSONResponse(
        status_code=202,
        content={
            "status": "warming",
            "message": f"Chưa có dữ liệu rủi ro khí hậu cho {region_id}. Scheduler đang tính toán.",
            "task": "climate_risk",
            "region_id": region_id,
        },
    )




@router.get("/daily-insight")
async def get_cached_daily_insight(refresh: Optional[bool] = False):
    """Gợi ý hàng ngày cho dashboard."""
    result = auto_scheduler.get_result("daily_insight")
    if (not result or refresh) and AUTO_ENABLED:
        import threading
        t = threading.Thread(target=auto_scheduler.run_once, args=("daily_insight",), daemon=True)
        t.start()
        if not result:
            return JSONResponse(
                status_code=202,
                content={"status": "warming", "message": "Đang tạo gợi ý hàng ngày...", "task": "daily_insight"},
            )
    if not result:
        return JSONResponse(
            status_code=202,
            content={"status": "warming", "message": "Chưa có gợi ý. Scheduler sẽ tự động chạy.", "task": "daily_insight"},
        )
    return result




@router.get("/regions")
async def get_auto_regions():
    """Danh sách vùng được auto-tính toán (cho climate + impact measure)."""
    return AUTO_REGIONS
