from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging
import traceback

router = APIRouter(prefix="/api/ai/analytics", tags=["6. AI Education Analytics"])

class DashboardInsightRequest(BaseModel):
    dashboard_data: Optional[Dict[str, Any]] = None

logger = logging.getLogger("analytics")

@router.post("/daily-insight")
async def get_daily_insight(request_data: DashboardInsightRequest):
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")
    try:
        insight = await llm_service.generate_daily_insight(request_data.dashboard_data or {})
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
        if db_service is None:
            raise HTTPException(status_code=503, detail="CSDL chưa sẵn sàng (SQLite mode).")
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
        if db_service is None:
            top_event = "N/A"
        else:
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
        df = pd.DataFrame(stats_data)
        if df.empty:
            raise HTTPException(status_code=503, detail="Dữ liệu thống kê rỗng.")

        # --- Group theo từng ngành (sector) để hiển thị nhiều ngành, không chỉ IT ---
        if 'metric_type' in df.columns:
            df['metric_type'] = df['metric_type'].fillna('Khác')
            sector_map = {}
            for mt, group in df.groupby('metric_type'):
                g = group.copy()
                if 'metric_value' in g.columns:
                    g['metric_value'] = pd.to_numeric(g['metric_value'], errors='coerce')
                g = g.sort_values('year') if 'year' in g.columns else g
                growth = float(g['metric_value'].pct_change().mean() * 100) if 'metric_value' in g.columns and not g['metric_value'].isnull().all() else 0.0
                last_val = float(g['metric_value'].iloc[-1]) if len(g) > 0 and 'metric_value' in g.columns and not pd.isna(g['metric_value'].iloc[-1]) else 100.0
                pred_2025 = int(last_val * (1 + growth / 100)) if growth else int(last_val * 1.15)
                sector_map[str(mt)] = {
                    "name": str(mt),
                    "growth_pct": round(growth, 2),
                    "prediction_2025": pred_2025,
                    "historical": g.fillna(0).to_dict(orient="records"),
                }
        else:
            sector_map = {"Khác": {
                "name": "Khác",
                "growth_pct": round(avg_growth, 2),
                "prediction_2025": int(pred_2025),
                "historical": df.fillna(0).to_dict(orient="records"),
            }}

        sectors = list(sector_map.values())

        # Historical data chung (dùng cho biểu đồ tổng quan) = sector đầu tiên hoặc toàn bộ
        primary_sector = sectors[0] if sectors else None
        historical = primary_sector["historical"] if primary_sector else df.fillna(0).to_dict(orient="records")

        # Insights tổng thể: lấy ngành tăng trưởng cao nhất làm đại diện
        top_sector = max(sectors, key=lambda s: s["growth_pct"]) if sectors else None
        conclusion_parts = [f"{s['name']}: {s['growth_pct']}%/năm" for s in sectors[:5]]
        conclusion = "Dựa trên dữ liệu, các ngành có nhu cầu tăng trưởng: " + ", ".join(conclusion_parts) + "." if conclusion_parts else f"Dựa trên dữ liệu, nhu cầu tăng trưởng {round(float(avg_growth), 2)}%/năm."

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing stats data: {e}")
        raise HTTPException(status_code=500, detail="Lỗi khi xử lý dữ liệu thống kê.")

    return {
        "status": "success",
        "historical_data": historical,
        "sectors": sectors,
        "insights": {
            "average_annual_growth_pct": round(float(avg_growth), 2),
            "prediction_2025_it_students": int(pred_2025),
            "top_user_activity": top_event,
            "conclusion": conclusion,
        }
    }
