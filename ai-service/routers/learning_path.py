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
    try:
        from services.llm_service import llm_service
        if not llm_service or not llm_service.is_ready:
            return LearningPathResponse(
                target_role=request_data.get('target_role', 'Unknown'),
                total_estimated_months=6.0,
                steps=[
                    PathStep(step_number=1, title="Khám phá kỹ năng cơ bản", estimated_weeks=4, description="Học các kỹ năng cần thiết."),
                    PathStep(step_number=2, title="Thực hành dự án", estimated_weeks=6, description="Làm dự án thực tế."),
                ]
            ).dict()

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
        return LearningPathResponse(
            target_role=request_data.get('target_role', 'Unknown'),
            total_estimated_months=6.0,
            steps=[PathStep(step_number=1, title="Liên hệ hỗ trợ", estimated_weeks=1, description="Dịch vụ đang bảo trì.")]
        ).dict()