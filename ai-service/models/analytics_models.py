from pydantic import BaseModel
from typing import Optional, List, Dict

class DailyInsightRequest(BaseModel):
    user_id: str
    dashboard_data: Optional[Dict] = None

class DailyInsightResponse(BaseModel):
    insight: str
    recommendations: List[str]
    mood: Optional[str] = None

class StatsRequest(BaseModel):
    year: Optional[int] = 2025
    region: Optional[str] = None

class StatsResponse(BaseModel):
    total_enrollment: float
    growth_rate: float
    prediction_2025: float
    trends: List[Dict]

class TrendAnalysisRequest(BaseModel):
    keywords: List[str]
    time_period: Optional[str] = "30d"

class TrendAnalysisResponse(BaseModel):
    trends: List[Dict]
    ai_analysis: str
    time_period: str
