

from fastapi import APIRouter, HTTPException
from typing import List, Optional

from models.opportunity_models import (
    OpportunityMatchRequest,
    OpportunityMatchResponse,
    MatchItem,
)

router = APIRouter(prefix="/api/ai/opportunity", tags=["F-16b. Opportunity Radar"])


@router.post("/match", response_model=OpportunityMatchResponse)
async def match_opportunities(data: OpportunityMatchRequest):
    """Match scholarships / jobs / competitions against the user profile.

    Delegates to the LLM cascade (Cloudflare Workers AI → Google Gemini)
    for NLP criteria extraction + semantic scoring. Returns
    ``degraded=True`` with a reason when falling back to the keyword heuristic.
    """
    from services.llm_service import llm_service

    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")

    try:
        result = await llm_service.match_opportunities(data)

        degraded = False
        reason = None
        clean_matches: List[dict] = []
        for m in result.get("matches", []):
            if m.get("_degraded"):
                degraded = True
            if "_reason" in m:
                reason = m.get("_reason")

            clean = {k: v for k, v in m.items() if k not in ("_degraded", "_reason")}
            try:
                clean_matches.append(MatchItem(**clean))
            except Exception:


                continue

        return OpportunityMatchResponse(
            user_id=result.get("user_id", data.user_profile.id if data.user_profile else "unknown"),
            matches=clean_matches,
            total=result.get("total", len(clean_matches)),
            filtered_count=result.get("filtered_count", 0),
            degraded=degraded or result.get("degraded", False),
            reason=reason or result.get("reason"),
        )
    except Exception as e:
        print(f"Error in opportunity match: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Lỗi ghép cơ hộp: {str(e)}")
