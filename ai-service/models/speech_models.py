"""
Pydantic models for the Voice-to-Geo AI speech endpoints (Idea #16).

These models describe the request/response shape for the server-side
Speech-to-Text fallback (``POST /api/ai/speech/to-text``).

Client-side STT via the Web Speech API (T1) is preferred for privacy; this
endpoint is the Whisper-via-OpenRouter fallback used when the browser cannot
recognise Vietnamese reliably.

OpenRouter STT API reference:
https://openrouter.ai/docs/api/api-reference/stt/create-transcription.md
"""
from pydantic import BaseModel, Field
from typing import Optional


class SpeechToTextRequest(BaseModel):
    """Incoming audio from the frontend.

    ``audio_base64`` is raw base64 (NOT a data-URI prefix) of the recorded
    audio chunk. ``audio_format`` must be one of the formats Whisper accepts
    (``wav``, ``mp3``, ``flac``, ``m4a``, ``ogg``, ``webm``, ``aac``).
    ``language`` is an ISO-639-1 code; ``"vi"`` is Vietnamese.
    """
    audio_base64: str = Field(default="",
                              description="Base64-encoded audio bytes (no data-URI prefix)")
    audio_format: str = Field(default="wav",
                              description="Audio container format (wav/mp3/flac/...)")
    language: str = Field(default="vi",
                          description="ISO-639-1 language code; 'vi' = Vietnamese")


class SpeechToTextResponse(BaseModel):
    """Structured transcription result.

    ``method`` indicates the source: ``"whisper"`` when OpenRouter Whisper
    was used, ``"fallback"`` when no provider key was available and a
    placeholder was returned.

    ``degraded`` is True when the STT could not run (no API key / network
    failure) — the frontend then falls back to the Web Speech API text or
    shows an error hint.
    """
    text: str = Field(default="", description="Transcribed text (empty when degraded)")
    language: str = Field(default="vi")
    method: str = Field(default="whisper")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    degraded: bool = False
    error: Optional[str] = Field(default=None, description="Human-readable failure reason when degraded")
