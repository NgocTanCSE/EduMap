"""Router for /api/ai/resource-exchange/* endpoints (Idea #18).

POST /api/ai/resource-exchange/match-rank  →  LLM re-ranks resource↔request
                                              pairs, explains each match, and
                                              builds a greedy transport
                                              (pickup) schedule.

The backend ResourceMatchService pre-filters at the SQLite layer (type match,
condition >= min, status available/open) and sends at most 15 candidate pairs
with a SQLite-side score. This endpoint asks the LLM to:
  1. Re-rank pairs by semantic fit (0–100).
  2. Explain why each resource matches the request.
  3. Greedy-schedule pickup slots avoiding time conflicts.

Graceful degradation: if every LLM provider is unreachable, returns
``degraded=true`` with template-based cost-fit scores + a simple schedule
(never 502 — mirrors the ImpactMatch degradation philosophy).
"""

from fastapi import APIRouter, HTTPException
from models.resource_exchange_models import (
    ResourceExchangeRequest,
    ResourceExchangeResponse,
    RankedResourceMatch,
    TransportSlot,
)

router = APIRouter(prefix="/api/ai/resource-exchange", tags=["14. AI Resource Exchange"])


@router.post("/match-rank", response_model=ResourceExchangeResponse)
async def match_rank(data: ResourceExchangeRequest):
    """Rank resource↔request pairs + greedy transport scheduling."""
    from services.llm_service import llm_service

    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")

    try:
        result = await llm_service.rank_resource_matches(data)

        ranked = []
        for m in (result.get("ranked_matches", []) if isinstance(result, dict) else []):
            if not isinstance(m, dict):
                continue
            try:
                ranked.append(RankedResourceMatch(**m))
            except Exception:
                # Skip malformed entries (e.g. fallback placeholders)
                pass

        plan = []
        for slot in (result.get("transport_plan", []) if isinstance(result, dict) else []):
            if not isinstance(slot, dict):
                continue
            try:
                plan.append(TransportSlot(**slot))
            except Exception:
                pass

        return ResourceExchangeResponse(
            ranked_matches=ranked,
            transport_plan=plan,
            degraded=bool(result.get("degraded", False)) if isinstance(result, dict) else False,
            reason=result.get("reason") if isinstance(result, dict) else None,
        )
    except Exception as e:
        print(f"Error in resource_exchange.match_rank: {e}")
        return ResourceExchangeResponse(
            ranked_matches=[],
            transport_plan=[],
            degraded=True,
            reason=f"AI ranking failed: {str(e)[:200]}",
        )
