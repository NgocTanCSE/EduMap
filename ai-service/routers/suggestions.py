from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/suggestions")
async def get_suggestions():
    # Chỉ trả về gợi ý THẬT từ AI — bỏ danh sách gợi ý mẫu (AI Engineer/Frontend/Data Scientist)
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình GEMINI_API_KEY.")
    try:
        return await llm_service.get_suggestions()
    except Exception as e:
        print(f"Error getting AI suggestions: {e}")
        raise HTTPException(status_code=502, detail=f"Lỗi khi lấy gợi ý AI: {str(e)}")
