"""
SafeRoute AI explain router — POST /api/ai/route/explain

Receives the scored route alternatives from the backend and uses the LLM
cascade (XKIRO → NVIDIA → Kimi → Cloudflare → HF) to generate a
Vietnamese explanation of why each route was ranked as it was.

Graceful degradation: when every LLM provider is unavailable, a template
explanation is returned with ``degraded=True`` so the frontend always has
something to show.
"""
import asyncio
import json
from fastapi import APIRouter

from models.route_models import (
    RouteExplainRequest,
    RouteExplainResponse,
)

router = APIRouter(prefix="/api/ai/route", tags=["5. SafeRoute AI Explain"])


# ── Lazy service loading (same pattern as routers/talk2map.py) ──────────
_services_loaded = False
_llm_service = None


def _get_llm_service():
    """Return the cached LLMService singleton, or None if not available."""
    global _services_loaded, _llm_service
    if not _services_loaded:
        try:
            from services.llm_service import llm_service
            _llm_service = llm_service
        except Exception:
            _llm_service = None
        _services_loaded = True
    return _llm_service


# ── Fallback (no LLM needed) ────────────────────────────────────────────

def _route_explain_fallback(data: RouteExplainRequest, err: str = "") -> dict:
    """Template-based route explanation when all LLM providers are down."""
    routes = data.routes or []
    best = routes[0] if routes else None

    if best:
        best_str = (
            f"• Lộ trình {best.safetyScore}/100 — "
            f"{best.distance / 1000:.1f} km, "
            f"{best.duration / 60:.0f} phút. "
            f"Rủi ro ngập: {best.safetyFactors.floodRisk}%, "
            f"rủi ro tắc nghẽn: {best.safetyFactors.trafficRisk}%."
        )
    else:
        best_str = "Không có lộ trình khả dụng."

    explanation = (
        "Không thể sử dụng AI để giải thích lộ trình. "
        "Dưỡng tóm tắt dựa trên điểm số an toàn tĩnh:\n"
        + best_str
    )

    route_reasons = []
    for i, r in enumerate(routes):
        route_reasons.append({
            "route_index": i,
            "reason": (
                f"Điểm số an toàn {r.safetyScore}/100. "
                f"Rủi ro ngập {r.safetyFactors.floodRisk}%, "
                f"rủi ro giao thông {r.safetyFactors.trafficRisk}%. "
                f"Quãng đường {r.distance / 1000:.1f} km, "
                f"Thời gian {r.duration / 60:.0f} phút. "
                f"Lý do: {r.explanation or ''}"
            ),
        })

    return {
        "explanation": explanation,
        "route_reasons": route_reasons,
        "degraded": True,
        "reason": f"AI unavailable -- template fallback ({err[:140]})",
        "source": "template",
    }


# ── Main endpoint ──────────────────────────────────────────────────────

@router.post("/explain", response_model=RouteExplainResponse)
async def explain_route(data: RouteExplainRequest):
    """Explain why each SafeRoute alternative was ranked as it was.

    Request body contains the scored routes returned by the backend's
    ``GET /api/map/safe-route``, including safety scores and factors.
    The LLM generates a Vietnamese explanation for the user.

    Always returns a valid ``RouteExplainResponse``. When the LLM is
    unavailable, ``degraded`` is set to ``True`` and a template
    explanation is returned.
    """
    if not data.routes:
        return _route_explain_fallback(data, "Không có tuyến đường để phân tích")

    routes_json = json.dumps(
        [
            {
                "rank": i,
                "safetyScore": r.safetyScore,
                "distance_km": round(r.distance / 1000, 1),
                "duration_minutes": round(r.duration / 60),
                "flood_risk_pct": r.safetyFactors.floodRisk,
                "traffic_risk_pct": r.safetyFactors.trafficRisk,
                "safety_explanation": r.explanation or "",
            }
            for i, r in enumerate(data.routes)
        ],
        ensure_ascii=False,
    )

    prefs_str = json.dumps(
        {
            "avoid_flood": data.preferences.avoidFlood if data.preferences else True,
            "avoid_traffic": data.preferences.avoidTraffic if data.preferences else True,
            "safety_weight": (data.preferences.safetyWeight if data.preferences else 0.3),
        },
        ensure_ascii=False,
    )

    prompt = f"""Bạn là chuyên gia tư vấn lộ trình an toàn cho nền tảng bản đồ giáo dục EduMap tại Việt Nam.

Dưới đây là các tuyến đường đã được chấm điểm an toàn:
{routes_json}

Tùy chọn người dùng:
{prefs_str}

Hãy phân tích:
1. Tại sao tuyến đầu tiên (xếp hạng cao nhất) là lựa chọn an toàn nhất?
2. So sánh ngắn gọn các tuyến còn lại (điểm mạnh/yếu).
3. Đưa ra lời khuyên chung cho người dùng.

Trả về JSON với cấu trúc sau (không thêm văn bản khác):
{{
  "explanation": "Đoạn văn giải thích tổng quan bằng tiếng Việt (2-3 câu).",
  "route_reasons": [
    {{"route_index": 0, "reason": "Lý do tại sao tuyến này xếp hạng cao nhất"}},
    {{"route_index": 1, "reason": "Lý do so sánh"}},
    ...
  ]
}}
"""

    try:
        svc = _get_llm_service()
        if svc is None or not getattr(svc, "is_ready", False):
            raise RuntimeError("AI Service chưa sẵn sàng. Cấu hình XKIRO_API_KEY, NVIDIA_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, HF_TOKEN, hoặc KIMI_API_KEY.")

        response = await asyncio.to_thread(
            svc._generate_text_with_fallback,
            prompt,
            temperature=0.3,
            max_tokens=1500,
            top_p=0.8,
        )
        result = svc._extract_json(response)
        if result is None:
            raise RuntimeError("AI trả về JSON không hợp lệ cho route explain.")

        # Validate required keys
        if "explanation" not in result or "route_reasons" not in result:
            raise RuntimeError("AI response missing required keys (explanation, route_reasons).")

        return {
            "explanation": result.get("explanation", ""),
            "route_reasons": result.get("route_reasons", []),
            "degraded": False,
            "reason": None,
            "source": "llm",
        }
    except Exception as e:
        print(f"Error in explain_route: {e}")
        return _route_explain_fallback(data, str(e))
