from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from models.mentor_models import MatchRequest

router = APIRouter(prefix="/api/ai/mentor", tags=["5. AI Mentor Matching"])

class MatchResult(BaseModel):
    mentor_id: str
    name: str
    match_score: float
    match_reasons: List[str]

class MentorMatchResponse(BaseModel):
    student_id: str
    top_matches: List[MatchResult]

@router.post("/match", response_model=MentorMatchResponse)
async def match_mentor(data: MatchRequest):
    # Chỉ trả về ghép mentor THẬT từ AI — bỏ fallback danh sách mentor mẫu
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID hoặc HF_TOKEN.")

    try:
        matches = await llm_service.match_mentors(data)
        top_matches = [MatchResult(**m) for m in matches if m and isinstance(m, dict)]
        return MentorMatchResponse(
            student_id=data.student_id,
            top_matches=top_matches
        )
    except Exception as e:
        print(f"Error in match_mentor: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Lỗi ghép mentor: {str(e)}")
