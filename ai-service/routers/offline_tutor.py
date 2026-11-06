

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/offline", tags=["7. Edge AI Tutor (offline)"])


_offline_tutor = None
_offline_tutor_error: str | None = None


def _get_tutor():
    """Return the OfflineTutor singleton, loading the model on first access."""
    global _offline_tutor, _offline_tutor_error
    if _offline_tutor is None and _offline_tutor_error is None:
        try:



            from offline.tutor import OfflineTutor
            _offline_tutor = OfflineTutor.get_instance()
        except Exception as e:
            _offline_tutor_error = str(e)
            import logging
            logging.getLogger(__name__).error(f"OfflineTutor init failed: {e}")
    return _offline_tutor





class OfflineTutorRequest(BaseModel):
    """Request body for POST /api/offline/tutor."""

    action: str = Field(
        ..., description="One of: 'explain', 'practice', 'suggest'"
    )


    topic: str = Field(
        ..., min_length=1, max_length=200,
        description="Subject/concept to tutor (e.g. 'Đạo hàm', 'Toán')"
    )
    context: Optional[Dict[str, Any]] = Field(
        default=None, description="Bổ sung context (material_context, user_id,...)"
    )


    material_context: Optional[str] = Field(
        default=None, description="Text from learning materials"
    )


    difficulty: str = Field(
        default="medium",
        description="easy | medium | hard"
    )
    num_questions: int = Field(
        default=3, ge=1, le=5,
        description="Số câu hỏi luyện tập (1-5)"
    )


    progression: Optional[Dict[str, Any]] = Field(
        default=None,
        description="User progression: {topics_studied, current_level, weak_areas, goals}"
    )


class OfflineTutorResponse(BaseModel):
    """Unified response for all offline tutor actions."""

    action: str
    topic: str
    degraded: bool = Field(default=False, description="True if using template fallback")
    source: str = Field(default="model", description="model | template")
    model_used: Optional[str] = Field(default=None)


    text: Optional[str] = Field(default=None)


    questions: Optional[List[Dict[str, Any]]] = Field(default=None)


    next_step: Optional[str] = Field(default=None)
    resources: Optional[List[Any]] = Field(default=None)
    estimated_time: Optional[str] = Field(default=None)
    difficulty: Optional[str] = Field(default=None)
    progression: Optional[Dict[str, Any]] = Field(default=None)


    model_status: Optional[Dict[str, Any]] = Field(default=None)





@router.post("/tutor")
async def offline_tutor(request: OfflineTutorRequest) -> OfflineTutorResponse:
    """Proxy a tutoring request to the local Edge AI Tutor.

    The action field selects which method to call:
      - ``explain``   → tutor.explain()
      - ``practice``  → tutor.generate_practice()
      - ``suggest``   → tutor.suggest_next()

    The local model is loaded lazily on the first call.  If it cannot be
    loaded or generation fails, a template-based Vietnamese fallback is
    returned with ``degraded=True`` and HTTP 200 — the client always gets
    a valid answer, just potentially less detailed.
    """
    tutor = _get_tutor()


    if tutor is None:
        return _template_fallback(request)

    action = (request.action or "").lower().strip()

    try:
        if action == "explain":
            result = tutor.explain(
                topic=request.topic,
                material_context=request.material_context,
            )
            return OfflineTutorResponse(
                action="explain",
                topic=request.topic,
                degraded=result.get("degraded", False),
                source=result.get("source", "model"),
                model_used=result.get("model_used"),
                text=result.get("text", ""),
            )

        elif action == "practice":
            result = tutor.generate_practice(
                topic=request.topic,
                difficulty=request.difficulty,
                num_questions=request.num_questions,
            )
            return OfflineTutorResponse(
                action="practice",
                topic=request.topic,
                degraded=result.get("degraded", False),
                source=result.get("source", "model"),
                model_used=result.get("model_used"),
                questions=result.get("questions", []),
                difficulty=request.difficulty,
            )

        elif action == "suggest":
            prog = request.progression or {}
            result = tutor.suggest_next(user_progression=prog)
            return OfflineTutorResponse(
                action="suggest",
                topic=request.topic,
                degraded=result.get("degraded", False),
                source=result.get("source", "model"),
                model_used=result.get("model_used"),
                next_step=result.get("next_step", ""),
                resources=result.get("resources", []),
                estimated_time=result.get("estimated_time", "15-20 phút"),
                difficulty=result.get("difficulty", "medium"),
                progression=result.get("progression"),
            )

        else:

            return _template_fallback(request)

    except Exception as e:

        import logging
        logging.getLogger(__name__).error(
            f"offline_tutor error (action={action}, topic={request.topic}): {e}"
        )
        return _template_fallback(request, error=str(e))




def _template_fallback(
    request: OfflineTutorRequest, error: str | None = None
) -> OfflineTutorResponse:
    """Return a template-based response when the LLM can't generate."""
    from offline.tutor import (
        _template_explain,
        _template_practice,
        _template_suggest,
    )

    action = (request.action or "").lower().strip()
    topic = request.topic or "chương học"

    if action == "explain":
        return OfflineTutorResponse(
            action="explain",
            topic=topic,
            degraded=True,
            source="template",
            text=_template_explain(topic, request.material_context),
        )
    elif action == "practice":
        questions = _template_practice(
            topic, request.difficulty, request.num_questions
        )
        return OfflineTutorResponse(
            action="practice",
            topic=topic,
            degraded=True,
            source="template",
            questions=questions,
            difficulty=request.difficulty,
        )
    elif action == "suggest":
        prog = request.progression or {}
        focus = (prog.get("weak_areas", ["chương tiếp theo"]) or ["chương tiếp theo"])[0]
        if isinstance(focus, list):
            focus = focus[0] if focus else "chương tiếp theo"
        result = _template_suggest(f"Hãy ôn tập lại {focus}", focus)
        return OfflineTutorResponse(
            action="suggest",
            topic=topic,
            degraded=True,
            source="template",
            next_step=result["next_step"],
            resources=result["resources"],
            estimated_time=result["estimated_time"],
            difficulty=prog.get("current_level", "medium"),
            progression=prog,
        )
    else:

        return OfflineTutorResponse(
            action=action or "unknown",
            topic=topic,
            degraded=True,
            source="template",
            text=f"Hành động '{action}' chưa được hỗ trợ. Vui lòng sử dụng: explain, practice, hoặc suggest.",
            model_status={"error": error or "Unknown action"},
        )


@router.get("/status")
async def offline_status() -> Dict[str, Any]:
    """Return the offline tutor status (model loaded, cache, etc.)."""
    tutor = _get_tutor()
    if tutor is None:
        return {
            "model_loaded": False,
            "model_failed": True,
            "error": _offline_tutor_error,
            "source": "template",
        }
    return tutor.status()
