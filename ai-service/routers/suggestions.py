from fastapi import APIRouter

router = APIRouter()

@router.get("/suggestions")
async def get_suggestions():
    try:
        from services.llm_service import llm_service
        
        if llm_service and llm_service.is_ready:
            try:
                return await llm_service.get_suggestions()
            except Exception as e:
                print(f"Error getting AI suggestions: {e}")
    except Exception as e:
        print(f"Error in suggestions import: {e}")
    
    return [
        {"title": "AI Engineer", "description": "Thị trường AI đang phát triển mạnh mẽ.", "match_score": 95},
        {"title": "Frontend Developer", "description": "Nhu cầu cao với UI/UX.", "match_score": 85},
        {"title": "Data Scientist", "description": "Kỹ năng tương lai.", "match_score": 80}
    ]