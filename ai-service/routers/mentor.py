from fastapi import APIRouter, HTTPException
from models.mentor_models import MatchRequest, MentorMatchResponse, MatchResult
from services.llm_service import llm_service

router = APIRouter(prefix="/api/ai/mentor", tags=["5. AI Mentor Matching"])

@router.post("/match", response_model=MentorMatchResponse)
async def match_mentor(request: MatchRequest):
    """
    AI nhận hồ sơ Mentee và danh sách Mentor khả dụng, sau đó phân tích
    và trả về Top 3 Mentor phù hợp nhất cùng lý do chi tiết.
    """
    try:
        matches = await llm_service.match_mentors(request)
        
        top_matches = []
        for m in matches:
            top_matches.append(MatchResult(
                mentor_id=m.get("mentor_id", ""),
                name=m.get("name", "Unknown"),
                match_score=float(m.get("match_score", 0.0)),
                match_reasons=m.get("match_reasons", [])
            ))

        return MentorMatchResponse(
            student_id=request.student_id,
            top_matches=top_matches
        )
    except Exception as e:
        print(f"Error in match_mentor: {str(e)}")
        raise HTTPException(status_code=500, detail="Lỗi khi ghép nối Mentor bằng AI.")
