from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

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
async def match_mentor(request_data: dict):
    # Chỉ trả về ghép mentor THẬT từ AI — bỏ fallback danh sách mentor mẫu
    from services.llm_service import llm_service
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình OPENROUTER_API_KEY.")

    class FakeRequest:
        student_id = request_data.get('student_id', '')
        student_skills_needed = request_data.get('student_skills_needed', [])
        student_mbti = request_data.get('student_mbti', '')
        preferred_days = request_data.get('preferred_days', [])
        available_mentors = request_data.get('available_mentors', [])
        json = lambda self: request_data

    try:
        matches = await llm_service.match_mentors(FakeRequest())
        top_matches = [MatchResult(**m) for m in matches if m and isinstance(m, dict)]
        return MentorMatchResponse(
            student_id=request_data.get('student_id', 'unknown'),
            top_matches=top_matches
        )
    except Exception as e:
        print(f"Error in match_mentor: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Lỗi ghép mentor: {str(e)}")
