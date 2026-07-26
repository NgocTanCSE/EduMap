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
    try:
        from services.llm_service import llm_service
        
        if not llm_service or not llm_service.is_ready:
            default_matches = [
                {"mentor_id": "1", "name": "Nguyễn Văn A", "match_score": 85.0, "match_reasons": ["Kinh nghiệm AI"]},
                {"mentor_id": "2", "name": "Trần Thị B", "match_score": 75.0, "match_reasons": ["Chuyên môn phù hợp"]}
            ]
            return MentorMatchResponse(
                student_id=request_data.get('student_id', 'unknown'),
                top_matches=[MatchResult(**m) for m in default_matches]
            )
        
        matches = await llm_service.match_mentors(type('obj', (object,), request_data)())
        top_matches = [MatchResult(**m) for m in matches if m]
        return MentorMatchResponse(
            student_id=request_data.get('student_id', 'unknown'),
            top_matches=top_matches
        )
    except Exception as e:
        print(f"Error in match_mentor: {str(e)}")
        return MentorMatchResponse(
            student_id=request_data.get('student_id', 'unknown'),
            top_matches=[{"mentor_id": "1", "name": "Mentor mặc định", "match_score": 70.0, "match_reasons": ["Hệ thống đề xuất"}]
        )