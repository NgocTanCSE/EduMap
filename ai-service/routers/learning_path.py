from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/ai/learning-path", tags=["4. Personalized Learning Path"])

class PathStep(BaseModel):
    step_number: int
    title: str
    estimated_weeks: int
    description: str

class LearningPathResponse(BaseModel):
    target_role: str
    total_estimated_months: float
    steps: List[PathStep] = []

@router.post("/")
async def generate_path(request_data: dict):
    # Chỉ trả về lộ trình THẬT từ AI — bỏ fallback bước mẫu "Liên hệ hỗ trợ"
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình OPENROUTER_API_KEY.")

    try:
        ai_data = await llm_service.generate_learning_path(type('obj', (object,), request_data)())
        steps = []
        for step in ai_data.get("steps", []):
            steps.append(PathStep(**step))
        return LearningPathResponse(
            target_role=ai_data.get("target_role", request_data.get("target_role", "Unknown")),
            total_estimated_months=ai_data.get("total_estimated_months", 0.0),
            steps=steps
        ).dict()
    except Exception as e:
        print(f"Error generating learning path: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Lỗi tạo lộ trình học: {str(e)}")
