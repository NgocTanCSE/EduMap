from fastapi import APIRouter, HTTPException
from models.learning_models import LearningPathRequest, LearningPathResponse, PathStep
from services.llm_service import llm_service

router = APIRouter(prefix="/api/ai/learning-path", tags=["4. Personalized Learning Path"])

@router.post("/", response_model=LearningPathResponse)
async def generate_path(request: LearningPathRequest):
    try:
        # Gọi "Bộ não" Gemini để phân rã mục tiêu thành các bước nhỏ
        ai_data = await llm_service.generate_learning_path(request)
        
        if not ai_data:
            raise ValueError("LLM returned empty data")

        # Ép kiểu dữ liệu an toàn qua Pydantic
        steps = []
        for step in ai_data.get("steps", []):
            steps.append(PathStep(**step))

        return LearningPathResponse(
            target_role=ai_data.get("target_role", request.target_role),
            total_estimated_months=ai_data.get("total_estimated_months", 0.0),
            steps=steps
        )
    except Exception as e:
        print(f"Error generating learning path: {str(e)}")
        raise HTTPException(status_code=500, detail="Lỗi khi tạo lộ trình học tập cá nhân hóa.")
