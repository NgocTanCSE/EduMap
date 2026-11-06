"""
Voice-to-Geo AI — server-side Speech-to-Text service (Idea

This module is the Whisper fallback used when the client-side Web Speech API
cannot recognise Vietnamese reliably.

Provider model:
  XKIRO STT (https://api.xkiro.com/v1/audio/transcriptions) was the original
  server-side STT provider, but:
    1. XKIRO has been removed from the provider chain (consolidated to
       Cloudflare Workers AI + Google Gemini only).
    2. XKIRO does NOT natively support speech-to-text — the /audio/transcriptions
       endpoint returns 404.

  There is currently **no** server-side STT provider configured. The service
  degrades gracefully: it always returns ``degraded=True`` with an empty
  ``text`` and a human-readable ``error``, so the frontend can fall back to
  the client-side Web Speech API (which captures audio in-browser and never
  sends it to a server — privacy-first).

  If a server-side STT provider is added later, wire it in here and remove
  the always-degrade path.
"""
from __future__ import annotations

import os
import time





_STT_TIMEOUT_SECONDS = float(os.getenv("STT_TIMEOUT_SECONDS", "25"))


_CB_SECONDS = 300.0


class SpeechService:
    """Stateless singleton wrapping server-side Speech-to-Text.

    Currently always degrades (no STT provider configured). Returns a
    valid response dict with ``degraded=True`` so callers never crash —
    they surface a hint and fall back to the client-side Web Speech API.

    The class holds no per-request state; circuit-breaker timestamps
    are class-level so they persist across concurrent requests.
    """


    _down_until: float = 0.0



    def transcribe(
        self,
        audio_base64: str,
        audio_format: str = "wav",
        language: str = "vi",
    ) -> dict:
        """Transcribe ``audio_base64`` to text.

        Returns a dict matching :class:`models.speech_models.SpeechToTextResponse`:

            {"text", "language", "method", "confidence", "degraded", "error"}

        Never raises — always returns a valid dict. When STT cannot run
        (no provider configured) the result is ``degraded=True`` with an empty
        ``text`` and a human-readable ``error`` so the caller can surface a
        hint and fall back to the client-side Web Speech API.
        """


        data = self._strip_data_uri(audio_base64)
        if not data:
            return self._degraded("audio_base64 is empty or missing")



        return self._degraded(
            "Không có provider STT phía server. Sử dụng Web Speech API "
            "phía client (ghi âm trong trình duyệt, không gửi lên server)."
        )



    @staticmethod
    def _strip_data_uri(b64: str) -> str:
        """Remove the 'data:audio/...;base64,' prefix if present."""
        if not b64:
            return ""
        if "," in b64 and b64.startswith("data:"):
            return b64.split(",", 1)[1]
        return b64

    @staticmethod
    def _degraded(error: str) -> dict:
        """Build a degraded (graceful-failure) response — never raises."""
        return {
            "text": "",
            "language": "vi",
            "method": "fallback",
            "confidence": None,
            "degraded": True,
            "error": error,
        }



speech_service = SpeechService()
