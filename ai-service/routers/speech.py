"""
Voice-to-Geo AI — Speech-to-Text router (Idea #16, Task 2).

``POST /api/ai/speech/to-text`` is the server-side Whisper fallback. The
frontend prefers the client-side Web Speech API (T1) for privacy, but when
Chrome's Vietnamese recognition is unreliable the browser uploads the
recorded audio here and we transcribe it with OpenRouter Whisper.

OpenRouter STT API (OpenAI-compatible):
  POST https://openrouter.ai/api/v1/audio/transcriptions
  Authorization: Bearer <OPENROUTER_API_KEY>
  Body: {"model", "input_audio": {"data": "<base64>", "format": "..."}, "language": "vi"}

Source: https://openrouter.ai/docs/api/api-reference/stt/create-transcription.md

HF Spaces egress quirk: the SpeechService uses ``curl --ipv4 --insecure``
(see services/speech.py) for the same IPv6/TLS workaround as vector_store.py
and llm_service.py.

Graceful degradation: this endpoint NEVER returns 503. When Whisper cannot
run (no API key, circuit breaker open, network failure) it returns 200 with
``degraded=True`` and an empty ``text`` — the frontend then falls back to the
Web Speech API transcript it already captured.
"""
from fastapi import APIRouter
from models.speech_models import SpeechToTextRequest, SpeechToTextResponse

router = APIRouter(prefix="/api/ai/speech", tags=["16. Voice-to-Geo AI"])

# ── Lazy service loading (same pattern as routers/geo.py, routers/talk2map.py) ──
_services_loaded = False
_speech: object | None = None


def _get_speech_service():
    """Return the cached SpeechService singleton, lazily imported.

    The circular-import-safe lazy import means the router module can be imported
    even if ``services/speech.py`` fails to load (e.g. missing optional deps).
    """
    global _services_loaded, _speech
    if not _services_loaded:
        try:
            from services.speech import speech_service as svc
            _speech = svc
        except Exception:
            _speech = None
        _services_loaded = True
    return _speech


@router.post("/to-text", response_model=SpeechToTextResponse)
async def speech_to_text(request: SpeechToTextRequest):
    """Server-side Speech-to-Text fallback (Whisper via OpenRouter).

    **Always returns 200.** When Whisper is unavailable (``degraded=True``)
    the ``text`` field is empty and ``error`` explains why — the frontend
    falls back to the client-side Web Speech API transcript.

    Request body::

        {
          "audio_base64": "<base64 WAV/MP3 data, no data-URI prefix>",
          "audio_format": "wav",      // optional, default "wav"
          "language": "vi"            // optional, ISO-639-1, default "vi"
        }

    Response::

        {
          "text": "Tìm thư viện gần trường có wifi",
          "language": "vi",
          "method": "whisper",
          "confidence": null,
          "degraded": false,
          "error": null
        }
    """
    svc = _get_speech_service()

    if svc is None:
        return SpeechToTextResponse(
            text="",
            language=request.language or "vi",
            method="fallback",
            degraded=True,
            error="Speech service not initialised",
        )

    # ``transcribe`` never raises — it always returns a valid dict matching
    # the response model. This keeps the endpoint resilient on HF Spaces
    # where the ai-service process may still be cold-starting.
    result = svc.transcribe(
        audio_base64=request.audio_base64,
        audio_format=request.audio_format or "wav",
        language=request.language or "vi",
    )

    return SpeechToTextResponse(**result)
