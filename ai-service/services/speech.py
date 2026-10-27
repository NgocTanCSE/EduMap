"""
Voice-to-Geo AI — server-side Speech-to-Text service (Idea #16, Task 2).

This is the Whisper fallback used when the client-side Web Speech API cannot
recognise Vietnamese reliably (noted risk: "Web Speech tiếng Việt kém → server
STT fallback").

Provider: XKIRO STT endpoint (``POST https://api.xkiro.com/v1/audio/transcriptions``).
NOTE: XKIRO does NOT natively support speech-to-text (404 on /audio/transcriptions).
The service still attempts the endpoint if XKIRO_API_KEY + XKIRO_STT_MODEL are
configured, but gracefully degrades to client-side Web Speech API on failure.
"""
from __future__ import annotations

import os
import json
import time
import subprocess

# ── Configuration ─────────────────────────────────────────────────────────
# XKIRO STT endpoint: OpenAI-compatible /audio/transcriptions.
# XKIRO STT endpoint: OpenAI-compatible /audio/transcriptions.
# NOTE: XKIRO does NOT natively support speech-to-text — this endpoint returns 404.
# The service degrades gracefully to client-side Web Speech API when the endpoint
# fails or when XKIRO_STT_MODEL is not configured.
_XKIRO_BASE = os.getenv("XKIRO_BASE_URL", "https://api.xkiro.com/v1").rstrip("/")
_STT_ENDPOINT = f"{_XKIRO_BASE}/audio/transcriptions"

# STT model slug — empty by default (XKIRO does not support embeddings or STT).
# If the user has XKIRO_STT_MODEL set and XKIRO adds STT support later, this
# will be used; otherwise the service degrades to client-side Web Speech API.
_STT_MODEL = os.getenv("XKIRO_STT_MODEL", "").strip()
# Per-request curl timeout. Keep well below the NestJS stream timeout (10s)
# budget so the backend proxy doesn't hang — the BFF/frontend caller times out
# first and degrades gracefully.
_STT_TIMEOUT_SECONDS = float(os.getenv("XKIRO_STT_TIMEOUT_SECONDS", "25"))

# Per-provider circuit-breaker cooldown (seconds) — matches llm_service.py.
_CB_SECONDS = 300.0


class SpeechService:
    """Stateless singleton wrapping the XKIRO STT transcription call.

    XKIRO does not natively support speech-to-text. The service attempts the
    endpoint only when XKIRO_API_KEY + XKIRO_STT_MODEL are both configured;
    otherwise it degrades immediately to the client-side Web Speech API.

    The class itself holds no per-request state; circuit-breaker timestamps
    are class-level so they persist across concurrent requests (the cooldown
    is shared, never per-thread).
    """

    # Circuit breaker: timestamp until which the provider is skipped.
    _down_until: float = 0.0

    # ── Helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _get_xkiro_key() -> str:
        """Read XKIRO_API_KEY dynamically (not at import time) so that
        test fixtures / env changes between import and call are respected."""
        return (os.getenv("XKIRO_API_KEY") or "").strip().strip('"').strip("'")

    # ── Public API ───────────────────────────────────────────────────

    def transcribe(
        self,
        audio_base64: str,
        audio_format: str = "wav",
        language: str = "vi",
    ) -> dict:
        """Transcribe ``audio_base64`` to text via XKIRO STT endpoint.

        Returns a dict matching :class:`models.speech_models.SpeechToTextResponse`:

            {"text", "language", "method", "confidence", "degraded", "error"}

        Never raises — always returns a valid dict. When STT cannot run
        (no key, no XKIRO_STT_MODEL, circuit open, network failure) the result is
        ``degraded=True`` with an empty ``text`` and a human-readable ``error``
        so the caller can surface a hint instead of crashing.
        """
        # Strip a data-URI prefix if the frontend accidentally included one
        # (e.g. "data:audio/wav;base64,AAAA..."). The XKIRO API expects
        # raw base64, not the data-URI wrapper.
        data = self._strip_data_uri(audio_base64)
        if not data:
            return self._degraded("audio_base64 is empty or missing")

        # No API key → can't reach Whisper. Return degraded so the frontend
        # falls back to the Web Speech API text it already captured.
        api_key = self._get_xkiro_key()
        if not api_key:
            return self._degraded("XKIRO_API_KEY not set — using client-side STT only")

        # XKIRO_STT_MODEL is empty by default (XKIRO does not support STT).
        # If the user hasn't explicitly configured one, degrade immediately
        # rather than wasting a curl call that will 404.
        if not _STT_MODEL:
            return self._degraded(
                "XKIRO_STT_MODEL not set — XKIRO does not support speech-to-text. "
                "Using client-side Web Speech API only."
            )

        # Circuit breaker: skip the provider for CB_SECONDS after a failure.
        if time.monotonic() < self._down_until:
            return self._degraded(
                "XKIRO STT temporarily disabled (circuit breaker — cooldown active)"
            )

        payload = {
            "model": _STT_MODEL,
            "input_audio": {"data": data, "format": audio_format},
        }
        if language:
            payload["language"] = language

        body = json.dumps(payload).encode("utf-8")

        try:
            proc = subprocess.run(
                [
                    "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                    "-H", f"Authorization: Bearer {api_key}",
                    "-H", "Content-Type: application/json",
                    "-d", body.decode("utf-8"),
                    "--connect-timeout", "5",
                    "--max-time", str(int(_STT_TIMEOUT_SECONDS)),
                    _STT_ENDPOINT,
                ],
                capture_output=True, text=True,
                timeout=_STT_TIMEOUT_SECONDS + 5,
            )
        except subprocess.TimeoutExpired:
            self._down_until = time.monotonic() + _CB_SECONDS
            return self._degraded(f"XKIRO STT curl timed out after {_STT_TIMEOUT_SECONDS}s")
        except Exception as e:  # pragma: no cover - defensive
            return self._degraded(f"XKIRO STT connection failed: {type(e).__name__}: {e}")

        if proc.returncode != 0:
            err = (proc.stderr or "").strip()[:300] or f"curl exit {proc.returncode}"
            stdout = (proc.stdout or "").strip()
            # Detect auth errors (401) → set circuit breaker so we don't retry
            # for 5 minutes on every request.
            if stdout:
                try:
                    partial = json.loads(stdout)
                    if isinstance(partial, dict) and "error" in partial:
                        err_msg = str(partial.get("error", ""))
                        low = err_msg.lower()
                        if "401" in str(partial) or "api key" in low or "unauthorized" in low or "unauthenticated" in low or "invalid" in low:
                            self._down_until = time.monotonic() + _CB_SECONDS
                            return self._degraded(f"XKIRO STT auth error: {err_msg[:200]}")
                except (json.JSONDecodeError, TypeError):
                    pass
            if proc.returncode in (28,):
                # 28 = curl timeout — treat as transient, set circuit breaker
                self._down_until = time.monotonic() + _CB_SECONDS
            return self._degraded(f"XKIRO STT connection failed: {err}")

        try:
            data = json.loads(proc.stdout or "{}")
        except Exception:
            return self._degraded(f"XKIRO STT invalid JSON response: {(proc.stdout or '')[:200]}")

        # Error response (HTTP still 200 from curl's perspective, error in body)
        if isinstance(data, dict) and data.get("error"):
            err_msg = str(data.get("error", ""))
            low = err_msg.lower()
            if "401" in str(data) or "api key" in low or "unauthorized" in low or "invalid" in low or "unauthenticated" in low:
                self._down_until = time.monotonic() + _CB_SECONDS
            return self._degraded(f"XKIRO STT API error: {err_msg[:200]}")

        # Success: XKIRO returns {"text": "...", "usage": {...}}.
        text = ""
        if isinstance(data, dict):
            text = (data.get("text") or "").strip()
        elif isinstance(data, str):
            text = data.strip()

        return {
            "text": text,
            "language": language,
            "method": "whisper",
            "confidence": None,  # Whisper via XKIRO doesn't expose per-request confidence
            "degraded": False,
            "error": None,
        }

    # ── Internal helpers ─────────────────────────────────────────────

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


# Singleton — mirrors the pattern in climate_guardian.py / llm_service.py.
speech_service = SpeechService()
