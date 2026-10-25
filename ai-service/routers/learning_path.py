from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from models.learning_models import LearningPathRequest

router = APIRouter(prefix="/api/ai/learning-path", tags=["3. Personalized Learning Path"])

class PathStep(BaseModel):
    step_number: int
    title: str = Field(..., description="Tên môn học / Kỹ năng cần học")
    estimated_weeks: int = Field(..., description="Thời gian dự kiến (tuần)")
    description: str

class LearningPathResponse(BaseModel):
    target_role: str
    total_estimated_months: float
    steps: List[PathStep]
    degraded: Optional[bool] = False
    reason: Optional[str] = None

@router.post("/")
async def generate_path(data: LearningPathRequest):
    from services.llm_service import llm_service
    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")

    try:
        ai_data = await llm_service.generate_learning_path(data)
        # Check degraded flag before constructing the model (pop extra keys)
        degraded = ai_data.pop("_degraded", False) if isinstance(ai_data, dict) else False
        reason = ai_data.pop("_reason", None) if isinstance(ai_data, dict) else None
        steps = []
        for step in ai_data.get("steps", []):
            steps.append(PathStep(**step))
        return LearningPathResponse(
            target_role=ai_data.get("target_role", data.target_role),
            total_estimated_months=ai_data.get("total_estimated_months", 0.0),
            steps=steps,
            degraded=degraded,
            reason=reason,
        ).dict()
    except Exception as e:
        print(f"Error generating learning path: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Lỗi tạo lộ trình học: {str(e)}")