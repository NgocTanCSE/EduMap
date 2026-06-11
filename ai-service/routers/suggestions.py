from fastapi import APIRouter
from services.llm_service import llm_service

router = APIRouter()

@router.get("/suggestions")
async def get_suggestions():
    """Return AI suggestions.
    If the Gemini API key is configured, the service calls the LLM to generate
    dynamic suggestions; otherwise it falls back to static mock data.
    """
    return await llm_service.get_suggestions()
