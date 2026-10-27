"""
Talk2Map router — POST /api/ai/map/query

Converts a Vietnamese natural-language query into a structured GIS search
object (facility types, conditions, radius, location reference, etc.).

The parser (``NLQueryParser``) runs regex first (always works, zero
dependencies) and optionally enriches with LLM when providers are available.
This mirrors the graceful-degradation pattern used across all ai-service
routers: never return 503 just because the LLM is down — return a valid
``degraded`` result instead.
"""
from fastapi import APIRouter, HTTPException
from models.talk2map_models import Talk2MapQueryRequest

from services.nl_query_parser import NLQueryParser

router = APIRouter(prefix="/api/ai/map", tags=["4. Talk2Map (NLP → GIS)"])

# ── Lazy service loading (same pattern as routers/geo.py) ─────────────────
_services_loaded = False
_parser: NLQueryParser | None = None


def _get_parser() -> NLQueryParser:
    """Return a cached :class:`NLQueryParser`, lazily wiring the LLM service."""
    global _services_loaded, _parser
    if not _services_loaded:
        llm_service = None
        try:
            from services.llm_service import llm_service as llm
            llm_service = llm
        except Exception:
            # LLM service not available — parser will run in regex-only mode
            pass
        _parser = NLQueryParser(llm_service=llm_service)
        _services_loaded = True
    return _parser


@router.post("/query")
async def parse_map_query(request: Talk2MapQueryRequest):
    """Parse a Vietnamese query into a structured GIS search object.

    **Always returns 200** with a valid structured payload. When the LLM is
    unavailable the ``degraded`` flag is set to ``True`` and the regex-only
    result is returned. This ensures Talk2Map keeps working on HF Spaces
    even when every AI provider is unreachable.

    Example response::

        {
          "status": "success",
          "degraded": false,
          "parsed_query": {
            "location": "Biên Hòa",
            "radius_km": 5.0,
            "facility_types": ["library"],
            "conditions": ["wifi"],
            "reference_location": null,
            "confidence": 0.8,
            "method": "regex",
            "suggestions": [],
            "raw_text": "Tìm thư viện gần trường có wifi ở Biên Hòa"
          },
          "explanation": "Tìm library gần Biên Hòa trong bán kính 5.0km, với điều kiện: wifi."
        }
    """
    text = (request.text or "").strip()
    if not text:
        return {
            "status": "success",
            "degraded": True,
            "parsed_query": {
                "location": None,
                "radius_km": None,
                "facility_types": [],
                "conditions": [],
                "reference_location": None,
                "confidence": 0.0,
                "method": "regex",
                "suggestions": [],
                "raw_text": "",
            },
            "explanation": "Vui lòng nhập câu hỏi. Ví dụ: 'Tìm thư viện gần trường có wifi'",
        }

    try:
        parser = _get_parser()
        parsed = await parser.parse_async(text)
        explanation = parser.generate_explanation(parsed)

        return {
            "status": "success",
            "degraded": parsed.get("method") == "regex",
            "parsed_query": parsed,
            "explanation": explanation,
        }
    except HTTPException:
        raise
    except Exception as e:
        # Never crash — return a minimal degraded result so the chat / map
        # feature still responds. The backend caller checks ``degraded``
        # and surfaces a hint to the user if needed.
        return {
            "status": "success",
            "degraded": True,
            "parsed_query": {
                "location": None,
                "radius_km": 5.0,
                "facility_types": [],
                "conditions": [],
                "reference_location": None,
                "confidence": 0.0,
                "method": "regex",
                "suggestions": [],
                "raw_text": text,
            },
            "explanation": f"Không thể phân tích câu hỏi. Vui lòng thử lại.\n(Lỗi: {str(e)[:140]})",
        }
