"""Router for /api/ai/language/* endpoints — Idea #15: Language Bridge AI.

Exposes three capabilities that make educational documents accessible:

* ``POST /api/ai/language/simplify``  — LLM summarisation by reading level,
  with jargon explanation (difficulty selector).
* ``POST /api/ai/language/translate`` — translation with optional glossary
  so domain terms are preserved (context-aware).
* ``POST /api/ai/language/tts``       — text-to-speech via Google Cloud TTS /
  gTTS / edge-tts; degrades gracefully (frontend falls back to Web Speech API).

All endpoints return a ``degraded`` flag + ``reason`` so the frontend can show
a helpful message instead of a 502.  Results are cached 24 h in-process
(mirrors climate_guardian.py / forecast.py).
"""

from datetime import date as _date
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging
import time

logger = logging.getLogger("language_bridge")

router = APIRouter(prefix="/api/ai/language", tags=["15. AI Language Bridge"])


# ── Request models ───────────────────────────────────────────────────────────

class SimplifyRequest(BaseModel):
    """POST body for /api/ai/language/simplify."""
    text: str = Field(..., min_length=1, max_length=16000,
                      description="Văn bản cần đơn giản hóa (tối đa 16.000 ký tự)")
    difficulty: str = Field(default="middle",
                            description="Trình độ độ khó: elementary | middle | high | college")
    context: Optional[str] = Field(default=None,
                                   description="Bố cục / ngữ cảnh bổ sung (ví dụ: lĩnh vực học tập)")


class TranslateRequest(BaseModel):
    """POST body for /api/ai/language/translate."""
    text: str = Field(..., min_length=1, max_length=16000,
                      description="Văn bản cần dịch")
    target_language: str = Field(default="en",
                                 description="Ngôn ngữ đích (vi, en, fr, ...)")
    source_language: Optional[str] = Field(default=None,
                                           description="Ngôn ngữ nguồn (tự động phát hiện nếu bỏ trống)")
    glossary: Optional[Dict[str, str]] = Field(default=None,
                                               description="Bảng thuật ngữ: {'thuật ngữ': 'giữ nguyên'} — những từ này sẽ KHÔNG được dịch")


class TTSRequest(BaseModel):
    """POST body for /api/ai/language/tts."""
    text: str = Field(..., min_length=1, max_length=5000,
                      description="Văn bản cần chuyển thành giọng nói (tối đa 5.000 ký tự)")
    language: str = Field(default="vi",
                          description="Mã ngôn ngữ: vi (Việt), en (Anh), ...")
    voice: Optional[str] = Field(default=None,
                                   description="Tên giọng (tùy chọn, ví dụ: vi-VN-HoaNeural)")


class SimplifyResponse(BaseModel):
    simplified: str
    explained_terms: Dict[str, str] = Field(default_factory=dict)
    degraded: bool = False
    reason: Optional[str] = None
    difficulty: str
    cached: bool = False
    created_at: str


class TranslateResponse(BaseModel):
    translated: str
    detected_source: Optional[str] = None
    degraded: bool = False
    reason: Optional[str] = None
    target_language: str
    cached: bool = False
    created_at: str


class TTSResponse(BaseModel):
    audio_base64: Optional[str] = None
    audio_format: str = "mp3"
    duration_ms: int = 0
    provider: Optional[str] = None
    degraded: bool = False
    reason: Optional[str] = None
    language: str
    cached: bool = False
    created_at: str


# ── In-process 24 h cache (HF Spaces: no Redis) ──────────────────────────────

_CACHE_TTL_SECONDS = 24 * 3600


def _empty_simplify_degraded(reason: str) -> Dict[str, Any]:
    return {
        "simplified": "",
        "explained_terms": {},
        "degraded": True,
        "reason": reason,
        "difficulty": "middle",
        "cached": False,
        "created_at": _date.today().isoformat(),
    }


def _empty_translate_degraded(reason: str) -> Dict[str, Any]:
    return {
        "translated": "",
        "detected_source": None,
        "degraded": True,
        "reason": reason,
        "target_language": "en",
        "cached": False,
        "created_at": _date.today().isoformat(),
    }


def _empty_tts_degraded(reason: str, language: str) -> Dict[str, Any]:
    return {
        "audio_base64": None,
        "audio_format": "mp3",
        "duration_ms": 0,
        "provider": None,
        "degraded": True,
        "reason": reason,
        "language": language,
        "cached": False,
        "created_at": _date.today().isoformat(),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/simplify", response_model=SimplifyResponse)
async def simplify_text(request_data: SimplifyRequest):
    """POST /api/ai/language/simplify → LLM summarisation by reading level.

    Body: ``{"text": "...", "difficulty": "middle", "context": null}``

    - ``difficulty``: ``elementary`` (lớp 1-3), ``middle`` (lớp 6-9),
      ``high`` (lớp 10-12), ``college`` (đại học).
    - The LLM summarises the text at that grade level and explains every
      technical/jargon term in plain language.
    - Returns ``simplified`` text + ``explained_terms`` dict.
    - Degrades gracefully: if the LLM is down, returns a heuristic
      truncation with ``degraded=True`` (never a 502).
    """
    try:
        from services.language_bridge import language_bridge

        result = language_bridge.simplify_text(
            text=request_data.text,
            difficulty=request_data.difficulty,
            context=request_data.context,
        )
        return SimplifyResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in language/simplify: %s", e)
        return SimplifyResponse(**_empty_simplify_degraded(f"Simplify thất bại: {e}"))


@router.post("/translate", response_model=TranslateResponse)
async def translate_text(request_data: TranslateRequest):
    """POST /api/ai/language/translate → context-aware translation.

    Body: ``{"text": "...", "target_language": "en", "source_language": null,
    "glossary": {"thuật ngữ": "term"}}``

    - The LLM translates the text, preserving terms listed in ``glossary``
      unchanged (so domain-specific vocabulary isn't lost).
    - Returns ``translated`` text + ``detected_source`` (when auto-detected).
    - Degrades gracefully: returns the original text with ``degraded=True``
      if the LLM is down.
    """
    try:
        from services.language_bridge import language_bridge

        result = language_bridge.translate_text(
            text=request_data.text,
            target_language=request_data.target_language,
            source_language=request_data.source_language,
            glossary=request_data.glossary,
        )
        return TranslateResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in language/translate: %s", e)
        return TranslateResponse(**_empty_translate_degraded(f"Translate thất bại: {e}"))


@router.post("/tts", response_model=TTSResponse)
async def synthesize_speech(request_data: TTSRequest):
    """POST /api/ai/language/tts → text-to-speech audio.

    Body: ``{"text": "...", "language": "vi", "voice": null}``

    Provider chain:
      1. Google Cloud TTS (requires ``GOOGLE_TTS_API_KEY``)
      2. ``edge-tts`` (Microsoft Edge online — no key, good Vietnamese voices)
      3. ``gTTS`` (Google Translate TTS — no key, rate-limited)

    Returns ``audio_base64`` (MP3) when a provider succeeds.  If all fail,
    returns ``audio_base64=None`` with ``degraded=True`` — the frontend
    should fall back to the browser's Web Speech API (``speechSynthesis``).
    """
    try:
        from services.language_bridge import language_bridge

        result = language_bridge.synthesize_speech(
            text=request_data.text,
            language=request_data.language,
            voice=request_data.voice,
        )
        return TTSResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in language/tts: %s", e)
        return TTSResponse(**_empty_tts_degraded(f"TTS thất bại: {e}", request_data.language))
