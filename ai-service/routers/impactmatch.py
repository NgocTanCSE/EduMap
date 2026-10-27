from fastapi import APIRouter, HTTPException
from typing import List, Optional

from models.impactmatch_models import (
    ImpactMatchRequest,
    ImpactMatchResponse,
    RankedMatch,
)

router = APIRouter(prefix="/api/ai/impactmatch", tags=["9. AI ImpactMatch"])


@router.post("/rank", response_model=ImpactMatchResponse)
async def rank_matches(data: ImpactMatchRequest):
    """Rank need↔sponsor pairs by match quality.

    The backend ImpactMatchService pre-filters at the SQLite layer
    (budget >= cost, optional region/category) and sends at most 15
    candidate pairs. This endpoint asks the LLM to assign a 0-100 score,
    explain why each pair is a good match, and suggest next steps.

    Graceful degradation: if every LLM provider is unreachable, returns
    ``degraded=true`` with an empty ``ranked_matches`` list (never 502).
    """
    from services.llm_service import llm_service

    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")

    try:
        result = await llm_service.rank_impact_matches(data)

        # result is a dict with keys: ranked_matches, degraded, reason
        raw_matches = result.get("ranked_matches", []) if isinstance(result, dict) else []
        degraded = bool(result.get("degraded", False)) if isinstance(result, dict) else False
        reason = result.get("reason") if isinstance(result, dict) else None

        clean = []
        for m in raw_matches:
            if not isinstance(m, dict):
                continue
            try:
                clean.append(RankedMatch(**m))
            except Exception:
                # Skip malformed entries (e.g. fallback placeholders)
                pass

        return ImpactMatchResponse(
            ranked_matches=clean,
            degraded=degraded,
            reason=reason,
        )
    except Exception as e:
        print(f"Error in rank_matches: {e}")
        return ImpactMatchResponse(
            ranked_matches=[],
            degraded=True,
            reason=f"AI ranking failed: {str(e)[:200]}",
        )
