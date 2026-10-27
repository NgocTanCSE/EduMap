"""Router for /api/ai/resource/* endpoints.

Idea #1: AI Education Resource Optimizer (MCLP).

POST /api/ai/resource/optimize   →  runs the MCLP solver and returns a
                                    GeoJSON FeatureCollection with three
                                    budget plans (A / B / C) plus gap areas.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/api/ai/resource", tags=["13. AI Resource Optimizer"])

# Lazy-load the solver so a missing scipy dependency does not prevent the
# entire ai-service from importing (mirrors geo.py / predictive.py pattern).
_solver = None
_solver_loaded = False


def _get_solver():
    """Return the ResourceOptimizer singleton, importing it lazily."""
    global _solver, _solver_loaded
    if not _solver_loaded:
        try:
            from services.resource_optimizer import resource_optimizer
            _solver = resource_optimizer
        except Exception as e:
            print(f"[resource] Solver import failed: {e}")
        _solver_loaded = True
    return _solver


class ResourceOptimizeRequest(BaseModel):
    """Request body for the MCLP resource optimisation.

    All fields are optional — when demand_points / candidate_locations are
    omitted the solver generates synthetic data around ``center`` so the API
    is always usable (handy for smoke tests and local dev without a DB).
    """
    budget: float = Field(default=30_000_000, description="Tổng ngân sách (VND)")
    coverage_radius_km: Optional[float] = Field(default=None, description="Bán kính phủ sóng (km) — ghi đè mặc định của từng loại hình")
    facility_types: Optional[Dict[str, Dict[str, Any]]] = Field(
        default=None,
        description="Cấu hình chi phí + bán kính cho từng loại cơ sở: {wifi:{cost,radius_km,label}, ...}"
    )
    demand_points: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Danh sách điểm nhu cầu (lat,lng,weight?) — vị trí người học"
    )
    candidate_locations: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Danh sách điểm ứng cử viên đặt cơ sở (lat,lng,facility_type?,name?)"
    )
    center: Optional[Dict[str, float]] = Field(
        default=None, description="Tâm vùng cho sinh dữ liệu mặc định {lat,lng}"
    )
    region_radius_km: Optional[float] = Field(
        default=10.0, description="Bán kính vùng (km) cho lưới/điểm mặc định"
    )


@router.post("/optimize")
async def optimize_resources(data: ResourceOptimizeRequest):
    """POST /api/ai/resource/optimize

    Runs the MCLP (Maximum Coverage Location Problem) solver to find the
    optimal placement of educational facilities (Wi-Fi, computers, libraries,
    study spaces) within a budget.

    Returns a GeoJSON ``FeatureCollection`` where each ``Feature`` is a
    selected facility tagged with its plan (A/B/C), the unserved learners as
    ``gap`` features, plus ``plans`` and ``summary`` metadata.
    """
    solver = _get_solver()
    if solver is None:
        raise HTTPException(
            status_code=503,
            detail="Resource Optimizer (scipy) chưa sẵn sàng. "
                   "scipy.optimize.milp là bắt buộc."
        )

    try:
        # Convert Pydantic model → plain dict for the solver
        request_data = data.model_dump(exclude_unset=True) if hasattr(data, 'model_dump') else data.dict(exclude_unset=True)

        result = solver.optimize(request_data)

        # The solver always returns a valid dict; surface any embedded error
        # as a degraded 200 (not a 503) so the frontend can still render the
        # map with a fallback message — mirrors the RAG degradation philosophy
        # in AGENTS.md ("answer LLM-only, never crash chat").
        if result.get("summary", {}).get("error"):
            return {
                **result,
                "status": "degraded",
                "reason": result["summary"]["error"],
            }

        return {
            **result,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[resource/optimize] Error: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Lỗi khi tối ưu phân bổ nguồn lực: {str(e)}"
        )
