from fastapi import APIRouter

router = APIRouter()

@router.get("/suggestions")
async def get_suggestions():
    """Return a static list of AI suggestions – placeholder implementation.
    The design sheet expects GET /api/ai/suggestions and returns a list of
    objects conforming to the AISuggestion schema.
    """
    mock = [
        {"title": "Cải thiện kỹ năng lập trình", "description": "Tham gia các khóa học Python/JavaScript.", "match_score": 85},
        {"title": "Khám phá AI & Data Science", "description": "Bắt đầu với các bài học về Machine Learning.", "match_score": 78},
    ]
    return mock
