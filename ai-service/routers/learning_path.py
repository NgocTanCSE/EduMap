from fastapi import APIRouter, HTTPException
from models.learning_models import LearningPathRequest, LearningPathResponse, PathStep

router = APIRouter(prefix="/api/ai/learning-path", tags=["3. Personalized Learning Path"])

@router.post("/")
async def generate_path(data: LearningPathRequest):
    # Chỉ trả về lộ trình THẬT từ AI — bỏ fallback bước mẫu "Liên hệ hỗ trợ"
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")

    try:
        ai_data = await llm_service.generate_learning_path(data)
        steps = []
        for step in ai_data.get("steps", []):
            steps.append(PathStep(**step))
        return LearningPathResponse(
            target_role=ai_data.get("target_role", data.target_role),
            total_estimated_months=ai_data.get("total_estimated_months", 0.0),
            steps=steps
        ).dict()
    except Exception as e:
        print(f"Error generating learning path: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Lỗi tạo lộ trình học: {str(e)}")
