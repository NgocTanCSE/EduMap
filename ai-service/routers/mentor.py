from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
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
    degraded: Optional[bool] = False
    reason: Optional[str] = None

@router.post("/match", response_model=MentorMatchResponse)
async def match_mentor(data: MatchRequest):
    from services.llm_service import llm_service
    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")

    try:
        matches = await llm_service.match_mentors(data)
        degraded = False
        reason = None
        clean = []
        for m in matches:
            if m and isinstance(m, dict):
                if m.get("_degraded"):
                    degraded = True
                if "_reason" in m:
                    reason = m.get("_reason")
                clean.append({k: v for k, v in m.items() if k not in ("_degraded", "_reason")})
        top_matches = []
        for m in clean:
            try:
                top_matches.append(MatchResult(**m))
            except Exception:
                pass  # skip items that don't match the schema (e.g. fallback placeholders)
        return MentorMatchResponse(
            student_id=data.student_id,
            top_matches=top_matches,
            degraded=degraded,
            reason=reason,
        )
    except Exception as e:
        print(f"Error in match_mentor: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Lỗi ghép mentor: {str(e)}")