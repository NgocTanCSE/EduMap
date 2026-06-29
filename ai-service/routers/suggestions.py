from fastapi import APIRouter
from services.llm_service import llm_service

router = APIRouter()

@router.get("/suggestions")
async def get_suggestions():
    if llm_service.is_ready:
        try:
            return await llm_service.get_suggestions()
        except Exception as e:
            print(f"Error getting AI suggestions: {e}")
    
    default_suggestions = [
        {"title": "AI Engineer", "description": "Thị trường AI đang phát triển mạnh mẽ.", "match_score": 95},
        {"title": "Frontend Developer", "description": "Nhu cầu cao với xu hướng thiết kế UI/UX.", "match_score": 85},
        {"title": "Data Scientist", "description": "Phân tích dữ liệu là kỹ năng tương lai.", "match_score": 80}
    ]
    return default_suggestions
