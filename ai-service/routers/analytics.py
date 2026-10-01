from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import logging
import traceback

router = APIRouter(prefix="/api/ai/analytics", tags=["6. AI Education Analytics"])

class DashboardInsightRequest(BaseModel):
    dashboard_data: Dict[str, Any]

logger = logging.getLogger("analytics")

@router.post("/daily-insight")
async def get_daily_insight(request_data: dict):
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
    try:
        insight = await llm_service.generate_daily_insight(request_data.get('dashboard_data', {}))
        return insight
    except Exception as e:
        logger.error(f"Error in get_daily_insight route: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=503, detail="Hệ thống AI tạm thời không khả dụng.")

@router.get("/stats")
async def get_stats():
    stats_data = []

    # Chỉ nhận dữ liệu THẬT từ CSDL — bỏ mọi dữ liệu mẫu fallback
    try:
        from services.db_service import db_service
        stats_data = db_service.get_education_stats(year=2024) or []
        logger.info(f"Fetched {len(stats_data)} education stats records")
        if not stats_data:
            raise HTTPException(status_code=503, detail="Không có dữ liệu thống kê từ CSDL.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DB error fetching education stats: {e}")
        raise HTTPException(status_code=503, detail="Không kết nối được tới CSDL để lấy thống kê.")

    avg_growth = 0.0
    pred_2025 = 0
    top_event = "N/A"
    it_df = None

    try:
        import pandas as pd
        df = pd.DataFrame(stats_data)
        if df.empty:
            raise HTTPException(status_code=503, detail="Dữ liệu thống kê rỗng.")

        if 'metric_type' in df.columns:
            it_df = df[df['metric_type'].str.contains('IT|Enrollment', case=False, na=False)]
            if it_df.empty:
                all_types = df['metric_type'].unique()[:3].tolist()
                it_df = df[df['metric_type'].isin(all_types)]
        else:
            it_df = df

        it_df = it_df.sort_values('year')
        it_df['metric_value'] = pd.to_numeric(it_df['metric_value'], errors='coerce')
        it_df['growth_rate'] = it_df['metric_value'].pct_change() * 100
        avg_growth = it_df['growth_rate'].mean() if not it_df['growth_rate'].isnull().all() else 15.0
        avg_growth = float(avg_growth) if not pd.isna(avg_growth) else 15.0
        last_val = float(it_df['metric_value'].iloc[-1]) if len(it_df) > 0 else 100
        if pd.isna(last_val):
            last_val = 100
        pred_2025 = int(last_val * (1 + avg_growth/100)) if avg_growth else int(last_val * 1.15)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing stats data: {e}")
        raise HTTPException(status_code=500, detail="Lỗi khi xử lý dữ liệu thống kê.")

    try:
        from services.db_service import db_service
        events = db_service.get_user_events(limit=500)
        if events:
            import pandas as pd
            event_df = pd.DataFrame(events)
            if not event_df.empty and 'event_type' in event_df.columns:
                mode_val = event_df['event_type'].mode()
                top_event = mode_val[0] if len(mode_val) > 0 else "N/A"
    except Exception as e:
        logger.error(f"DB error fetching user events: {e}")
        top_event = "N/A"

    try:
        import pandas as pd
        if isinstance(it_df, pd.DataFrame):
            try:
                it_df = it_df.rename(columns={'metric_value': 'value'})
            except Exception:
                pass
            historical = it_df.fillna(0).to_dict(orient="records")
        else:
            historical = stats_data
    except Exception:
        historical = stats_data

    return {
        "status": "success",
        "historical_data": historical,
        "insights": {
            "average_annual_growth_pct": round(float(avg_growth), 2),
            "prediction_2025_it_students": int(pred_2025),
            "top_user_activity": top_event,
            "conclusion": f"Dựa trên dữ liệu, nhu cầu tăng trưởng {round(float(avg_growth), 2)}%/năm."
        }
    }
