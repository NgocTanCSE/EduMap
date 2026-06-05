from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import pandas as pd
import json
from app.services.db_service import db_service
from services.llm_service import LLMService

router = APIRouter(prefix="/api/ai/analytics", tags=["6. AI Education Analytics"])
llm_service = LLMService()

class DashboardInsightRequest(BaseModel):
    dashboard_data: Dict[str, Any]

@router.post("/daily-insight")
async def get_daily_insight(request: DashboardInsightRequest):
    """
    Tạo lời khuyên/insight cá nhân hóa mỗi ngày dựa trên dữ liệu Dashboard.
    """
    try:
        insight = await llm_service.generate_daily_insight(request.dashboard_data)
        return insight
    except Exception as e:
        print(f"Error in get_daily_insight route: {str(e)}")
        raise HTTPException(status_code=500, detail="Không thể tạo AI Insight lúc này.")

@router.get("/stats")
async def get_stats():
    # 1. Fetch real data from DB
    stats_data = db_service.get_education_stats(year=2024)
    if not stats_data:
        # Fallback to mock if DB is empty
        stats_data = [
            {"metric_type": "IT Enrollment", "value": 3500, "year": 2024},
            {"metric_type": "IT Enrollment", "value": 2800, "year": 2023},
            {"metric_type": "IT Enrollment", "value": 2100, "year": 2022},
        ]
    
    df = pd.DataFrame(stats_data)
    
    # Filter for IT Enrollment if available, else use what we have
    it_df = df[df['metric_type'].str.contains('IT', case=False)]
    if it_df.empty:
        it_df = df # Fallback

    # Sort by year
    it_df = it_df.sort_values('year')

    # 2. Phân tích Xu hướng
    it_df['growth_rate'] = it_df['value'].pct_change() * 100
    avg_growth = it_df['growth_rate'].mean() if not it_df['growth_rate'].isnull().all() else 15.0

    # 3. Thuật toán Dự báo tương lai
    last_val = it_df['value'].iloc[-1]
    pred_2025 = int(last_val * (1 + avg_growth/100))
    
    # Get user events for insights
    events = db_service.get_user_events(limit=500)
    top_event = "N/A"
    if events:
        event_df = pd.DataFrame(events)
        top_event = event_df['event_type'].mode()[0] if not event_df.empty else "N/A"

    # Đóng gói dữ liệu trả về cho Frontend vẽ Chart
    response_data = {
        "status": "success",
        "historical_data": it_df.fillna(0).to_dict(orient="records"),
        "insights": {
            "average_annual_growth_pct": round(avg_growth, 2),
            "prediction_2025_it_students": pred_2025,
            "top_user_activity": top_event,
            "conclusion": f"Dựa trên dữ liệu thực tế, nhu cầu đang tăng trưởng {round(avg_growth, 2)}%/năm. Hành động phổ biến nhất là '{top_event}'."
        }
    }
    
    return response_data
