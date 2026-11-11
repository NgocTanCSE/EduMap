
from __future__ import annotations

import base64
import json
import logging
import math
import os
import time
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("language_bridge")




DIFFICULTY_LEVELS = {
    "elementary": {
        "label": "Tiểu học (lớp 1-3)",
        "grade": "3rd grade",
        "description": "Ngôn ngữ rất đơn giản, từ vựng cơ bản, giải thích mọi thuật ngữ.",
    },
    "middle": {
        "label": "Trung học cơ sở (lớp 6-9)",
        "grade": "6th-9th grade",
        "description": "Ngôn ngữ trung bình, giải thích thuật ngữ khó.",
    },
    "high": {
        "label": "Trung học phổ thông (lớp 10-12)",
        "grade": "9th-12th grade",
        "description": "Ngôn ngữ nâng cao, giữ nguyên thuật ngữ nhưng dễ hiểu.",
    },
    "college": {
        "label": "Đại học",
        "grade": "College level",
        "description": "Ngôn ngữ chuyên ngành nhưng vẫn truy cập được.",
    },
}
DEFAULT_DIFFICULTY = "middle"


SUPPORTED_LANGUAGES = {
    "vi": "Tiếng Việt",
    "en": "English",
    "fr": "Français",
    "zh": "中文",
    "ja": "日本語",
    "ko": "한국어",
    "th": "ไทย",
    "id": "Bahasa Indonesia",
    "ms": "Bahasa Melayu",
    "tl": "Tagalog (Filipino)",
}


GOOGLE_TTS_API_KEY = (os.getenv("GOOGLE_TTS_API_KEY") or "").strip().strip('"').strip("'")


_CACHE_TTL = 24 * 3600
_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    val = _CACHE.get(key)
    if val and (time.time() - val[0]) < _CACHE_TTL:
        return val[1]
    if val:
        _CACHE.pop(key, None)
    return None


def _cache_set(key: str, value: Dict[str, Any]) -> None:
    _CACHE[key] = (time.time(), value)








_SIMPLIFY_PROMPT_TEMPLATE = """Bạn là trợ lý giáo dục chuyên làm cho văn bản trở nên dễ hiểu.

Nhiệm vụ: Tóm tắt và đơn giản hóa đoạn văn bản sau theo **trình độ độ khó {grade}** ({label}).
- Dùng từ vựng và câu ngắn, phù hợp với trình độ {grade}.
- Giải thích mọi thuật ngữ chuyên ngành, từ khó trong văn bản gốc bằng ngôn ngữ đơn giản.
- Giữ nguyên ý nghĩa chính, không bỏ sót thông tin quan trọng.
- Nếu văn bản ngắn, hãy giải thích thuật ngữ và đưa ra ví dụ dễ hiểu.

Văn bản gốc:
{text}

Trả về **duy nhất** JSON sau (không có markdown, không có văn bản khác):
{{"simplified": "<văn bản đã đơn giản hóa>", "explained_terms": {{"<thuật ngữ>": "<giải thích>"}}}}"""

_TRANSLATE_PROMPT_TEMPLATE = """Bạn là phiên dịch viên chuyên nghiệp, chuyên dịch tài liệu giáo dục giữa tiếng Việt và tiếng Anh.

Nhiệm vụ: Dịch đoạn văn bản sau sang **{target_name}**.
- Giữ nguyên giọng văn, giữ nguyên ý nghĩa.
- Tôn trọng bảng thuật ngữ (glossary) sau — những thuật ngữ này được giữ nguyên nguyên văn (không dịch):
{glossary_block}
- Nếu không có thuật ngữ trong glossary, hãy dịch tự nhiên nhưng luôn ưu tiên độ chính xác văn nghĩa cao.
- Đảm bảo câu dịch mạch lạc, tự nhiên trong {target_name}.

Văn bản nguồn ({source_name}):
{text}

Trả về **duy nhất** JSON sau (không có markdown, không có văn bản khác):
{{"translated": "<văn bản đã dịch>"}}"""



_TRANSLATE_FALLBACK_PROMPT_TEMPLATE = _TRANSLATE_PROMPT_TEMPLATE


def _build_glossary_block(glossary: Optional[Dict[str, str]]) -> str:
    if not glossary:
        return "(không có — dịch tự nhiên)"
    lines = [f"  - {k} → {v} (giữ nguyên không dịch)" for k, v in glossary.items()]
    return "\n".join(lines)


def _curl_get_json(url: str, timeout: float, headers: Optional[Dict[str, str]] = None) -> Optional[Dict]:
    """Execute an HTTP GET via ``curl --ipv4 --insecure`` (container workaround).
    Mirrors climate_guardian._curl_get_json.  Returns parsed JSON dict or None.
    """
    import subprocess
    cmd = [
        "curl", "--ipv4", "--insecure", "-sS",
        "-X", "GET",
        "--connect-timeout", str(min(3.0, timeout)),
        "--max-time", str(timeout),
    ]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    cmd.append(url)
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 3)
        if proc.returncode != 0:
            return None
        return json.loads(proc.stdout or "{}")
    except Exception:
        return None


def _curl_post_json(url: str, payload: Any, timeout: float,
                    headers: Optional[Dict[str, str]] = None) -> Optional[Dict]:
    """Execute an HTTP POST via curl --ipv4 --insecure. Returns parsed JSON or None."""
    import subprocess
    cmd = [
        "curl", "--ipv4", "--insecure", "-sS",
        "-X", "POST",
        "--connect-timeout", str(min(3.0, timeout)),
        "--max-time", str(timeout),
    ]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    cmd += ["-H", "Content-Type: application/json",
            "-d", json.dumps(payload), url]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 3)
        if proc.returncode != 0:
            return None
        return json.loads(proc.stdout or "{}")
    except Exception:
        return None




class LanguageBridgeService:
    """AI Language Bridge service (Idea #15).

    Exposes three capabilities:
      1. ``simplify_text`` — LLM summarisation by reading level + jargon explanation.
      2. ``translate_text`` — LLM translation with optional glossary preservation.
      3. ``synthesize_speech`` — TTS via Google Cloud TTS / gTTS / edge-tts.

    All three degrade gracefully: when the LLM or TTS providers are unavailable
    (common on the host free plan), the service returns valid-shaped content
    with ``degraded=True`` instead of raising a 502.
    """

    def __init__(self):


        self._llm = None
        try:
            from services.llm_service import llm_service
            self._llm = llm_service
        except Exception as e:
            logger.warning(f"LLM service not available: {e}")
        self.llm_ready = bool(self._llm and getattr(self._llm, "is_ready", False))



    def simplify_text(
        self,
        text: str,
        difficulty: str = DEFAULT_DIFFICULTY,
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Summarise / simplify ``text`` to the given ``difficulty`` level.

        Returns a dict:
            {"simplified": str, "explained_terms": {...}, "degraded": bool,
             "reason": str|None, "difficulty": str, "created_at": iso}

        Uses ``_generate_text_with_fallback`` when the LLM is ready.
        Falls back to a truncation-based heuristic when every provider is down.
        """
        if not text or not text.strip():
            return {
                "simplified": "",
                "explained_terms": {},
                "degraded": False,
                "reason": None,
                "difficulty": difficulty,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

        difficulty = difficulty or DEFAULT_DIFFICULTY
        if difficulty not in DIFFICULTY_LEVELS:
            difficulty = DEFAULT_DIFFICULTY


        cache_key = f"simplify:{difficulty}:{hash_text(text)}"
        cached = _cache_get(cache_key)
        if cached is not None:
            cached = dict(cached)
            cached["cached"] = True
            return cached

        info = DIFFICULTY_LEVELS[difficulty]
        prompt = _SIMPLIFY_PROMPT_TEMPLATE.format(
            grade=info["grade"],
            label=info["label"],
            text=text[:8000],
        )

        result: Dict[str, Any] = {}
        degraded = False
        reason: Optional[str] = None

        if self.llm_ready and self._llm:
            import json as _json
            try:
                response = self._llm._generate_text_with_fallback(
                    prompt,
                    temperature=0.3,
                    max_tokens=2048,
                    top_p=0.8,
                )

                extracted = self._llm._extract_json(response)
                if extracted and isinstance(extracted, dict):
                    result["simplified"] = (extracted.get("simplified") or "").strip()
                    result["explained_terms"] = extracted.get("explained_terms") or {}
                else:
                    result["simplified"] = (response or "").strip()
                    result["explained_terms"] = {}
                result["degraded"] = False
                result["reason"] = None
            except Exception as e:
                logger.warning(f"simplify via LLM failed: {e}")
                degraded = True
                reason = f"LLM unavailable — using fallback ({e!s:.120})"
        else:
            degraded = True
            reason = "AI chưa sẵn sàng (chưa cấu hình LLM provider). Dùng fallback."



        if not result.get("simplified"):
            fb = self._simplify_fallback(text, difficulty)
            result["simplified"] = fb["simplified"] or _truncate(text, 500)
            result["explained_terms"] = result.get("explained_terms", {})
            degraded = True
            reason = reason or "LLM trả về nội dung rỗng — dùng bản đơn giản hóa tĩnh."

        result["difficulty"] = difficulty
        result["created_at"] = datetime.now(timezone.utc).isoformat()
        result["degraded"] = degraded
        result["reason"] = reason

        _cache_set(cache_key, result)
        return result

    def _simplify_fallback(self, text: str, difficulty: str) -> Dict[str, Any]:
        """Heuristic fallback when the LLM is down.

        - 'elementary': sentence-split, shortest sentences, strip jargon heuristically.
        - 'middle'/'high'/'college': truncate to a token budget while keeping
          the whole text intact if short.
        """
        import re
        sentences = re.split(r'(?<=[.!?।])\s+', text.strip())
        if difficulty == "elementary":


            simple = " ".join(sentences[:3])
        else:
            simple = text.strip()[:500]
        return {"simplified": simple}



    def translate_text(
        self,
        text: str,
        target_language: str,
        source_language: Optional[str] = None,
        glossary: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Translate ``text`` to ``target_language``, respecting ``glossary``.

        Returns:
            {"translated": str, "detected_source": str|None, "degraded": bool,
             "reason": str|None, "target_language": str, "created_at": iso}
        """
        if not text or not text.strip():
            return {
                "translated": "",
                "detected_source": source_language,
                "degraded": False,
                "reason": None,
                "target_language": target_language,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

        target_language = target_language or "en"

        target_language = target_language.split("-")[0].lower()
        target_name = SUPPORTED_LANGUAGES.get(target_language, target_language)
        source_name = SUPPORTED_LANGUAGES.get(source_language, source_language or "tự động")

        cache_key = f"translate:{target_language}:{source_language or 'auto'}:{hash_text(text)}"
        cached = _cache_get(cache_key)
        if cached is not None:
            cached = dict(cached)
            cached["cached"] = True
            return cached

        prompt = _TRANSLATE_PROMPT_TEMPLATE.format(
            target_name=target_name,
            source_name=source_name,
            glossary_block=_build_glossary_block(glossary),
            text=text[:8000],
        )

        result: Dict[str, Any] = {}
        degraded = False
        reason: Optional[str] = None

        if self.llm_ready and self._llm:
            try:
                response = self._llm._generate_text_with_fallback(
                    prompt,
                    temperature=0.2,
                    max_tokens=2048,
                    top_p=0.9,
                )
                extracted = self._llm._extract_json(response)
                if extracted and isinstance(extracted, dict) and extracted.get("translated"):
                    result["translated"] = extracted["translated"].strip()
                else:
                    result["translated"] = (response or "").strip()
                result["degraded"] = False
                result["reason"] = None
            except Exception as e:
                logger.warning(f"translate via LLM failed: {e}")
                degraded = True
                reason = f"LLM unavailable — using fallback ({e!s:.120})"
        else:
            degraded = True
            reason = "AI chưa sẵn sàng — dùng fallback bản sao."

        if not result.get("translated"):

            result["translated"] = text.strip()
            degraded = True
            reason = reason or "LLM không dịch được — trả về văn bản gốc."

        result["detected_source"] = source_language
        result["target_language"] = target_language
        result["created_at"] = datetime.now(timezone.utc).isoformat()
        result["degraded"] = degraded
        result["reason"] = reason

        _cache_set(cache_key, result)
        return result



    def synthesize_speech(
        self,
        text: str,
        language: str = "vi",
        voice: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Synthesise speech from ``text``.

        Returns:
            {"audio_base64": str|None, "audio_format": "mp3", "duration_ms": int,
             "degraded": bool, "reason": str|None, "provider": str,
             "language": str, "created_at": iso}

        When no TTS provider succeeds, ``audio_base64`` is None and
        ``degraded=True`` — the frontend should fall back to the browser's
        SpeechSynthesis API (Web Speech API) which supports Vietnamese.
        """
        if not text or not text.strip():
            return {
                "audio_base64": None,
                "audio_format": "mp3",
                "duration_ms": 0,
                "degraded": True,
                "reason": "Văn bản trống.",
                "provider": None,
                "language": language,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }


        text = text.strip()[:5000]
        language = (language or "vi").split("-")[0].lower()
        cache_key = f"tts:{language}:{voice or 'default'}:{hash_text(text)}"
        cached = _cache_get(cache_key)
        if cached is not None:
            cached = dict(cached)
            cached["cached"] = True
            return cached


        providers = [
            ("google_cloud", self._tts_google_cloud),
            ("edge_tts", self._tts_edge_tts),
            ("gtts", self._tts_gtts),
        ]

        last_error = ""
        for name, fn in providers:
            try:
                audio_b64 = fn(text, language, voice)
                if audio_b64:
                    result = {
                        "audio_base64": audio_b64,
                        "audio_format": "mp3",
                        "duration_ms": _estimate_duration_ms(text),
                        "degraded": False,
                        "reason": None,
                        "provider": name,
                        "language": language,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    _cache_set(cache_key, result)
                    return result
            except ImportError:

                logger.debug(f"TTS provider {name} not available (ImportError)")
            except Exception as e:
                last_error = str(e)
                logger.warning(f"TTS provider {name} failed: {e}")
                continue


        result = {
            "audio_base64": None,
            "audio_format": "mp3",
            "duration_ms": _estimate_duration_ms(text),
            "degraded": True,
            "reason": f"TTS không khả dụng (thử Google Cloud TTS / gTTS / edge-tts): {last_error[:120]}. "
                      f"Dùng Web Speech API của trình duyệt.",
            "provider": None,
            "language": language,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _cache_set(cache_key, result)
        return result

    def _tts_google_cloud(self, text: str, language: str, voice: Optional[str]) -> Optional[str]:
        """Google Cloud TTS via ``curl --ipv4 --insecure`` (container compatible).

        Requires ``GOOGLE_TTS_API_KEY`` env var.  Returns base64-encoded MP3.
        """
        if not GOOGLE_TTS_API_KEY:
            return None


        lang_code = language.upper()
        voice_name = voice or f"{lang_code}-Wavenet-A"
        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={GOOGLE_TTS_API_KEY}"

        payload = {
            "input": {"text": text},
            "voice": {
                "languageCode": language,
                "name": voice_name,
            },
            "audioConfig": {
                "audioEncoding": "MP3",
                "speakingRate": 1.0,
            },
        }

        data = _curl_post_json(url, payload, timeout=10)
        if data and data.get("audioContent"):
            return data["audioContent"]
        return None

    def _tts_edge_tts(self, text: str, language: str, voice: Optional[str]) -> Optional[str]:
        """Microsoft Edge online TTS (no API key needed).  Good Vietnamese voices.

        Requires the ``edge-tts`` Python package.  Uses asyncio to drive the
        async edge-tts client.
        """
        import edge_tts


        voice_map = {
            "vi": "vi-VN-HoaNeural",
            "en": "en-US-AriaNeural",
            "fr": "fr-FR-DeniseNeural",
            "zh": "zh-CN-XiaoyiNeural",
            "ja": "ja-JP-KeitaNeural",
            "ko": "ko-KR-JiMinNeural",
        }
        voice_name = voice or voice_map.get(language, "vi-VN-HoaNeural")

        async def _run():
            communicate = edge_tts.Communicate(text, voice=voice_name)
            mp3_bytes = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    mp3_bytes += chunk["data"]
            if mp3_bytes:
                return base64.b64encode(mp3_bytes).decode("ascii")
            return None




        try:
            loop = asyncio.get_running_loop()

            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, _run())
                return future.result(timeout=25)
        except RuntimeError:

            return asyncio.run(_run())

    def _tts_gtts(self, text: str, language: str, voice: Optional[str]) -> Optional[str]:
        """Google Text-to-Speech (free, via gTTS library).  No API key needed.

        Requires the ``gTTS`` Python package.  Benefits from the global
        ``force_ipv4()`` applied at startup (fixes the container IPv6 blackhole).
        """
        from gtts import gTTS
        import io

        lang_code = language if language in ("vi", "en", "fr", "zh", "ja", "ko", "th", "id", "ms", "tl") else "en"
        tts = gTTS(text=text, lang=lang_code, slow=False)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        mp3_bytes = buf.getvalue()
        if mp3_bytes:
            return base64.b64encode(mp3_bytes).decode("ascii")
        return None



    @staticmethod
    def _extract_json(text: str):
        """Extract a JSON object from LLM output (best-effort)."""
        if not text:
            return None
        import json as _json
        import re as _re
        try:
            match = _re.search(r'```json\s*([\s\S]*?)\s*```', text)
            if match:
                return _json.loads(match.group(1).strip())
            start_obj = text.find('{')
            start_arr = text.find('[')
            if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
                candidate = text[start_obj:text.rfind('}') + 1]
            elif start_arr != -1:
                candidate = text[start_arr:text.rfind(']') + 1]
            else:
                return None
            candidate = _re.sub(r',\s*([\]}])', r'\1', candidate)
            return _json.loads(candidate)
        except Exception:
            return None




def hash_text(text: str) -> str:
    """Short deterministic hash of text for cache keys (first 16 hex chars)."""
    import hashlib
    return hashlib.md5(text.encode("utf-8")).hexdigest()[:16]


def _truncate(text: str, max_len: int = 500) -> str:
    """Truncate text to ``max_len`` characters, breaking at a sentence boundary."""
    if len(text) <= max_len:
        return text.strip()
    cut = text[:max_len].rsplit('.', 1)[0] if '.' in text[:max_len] else text[:max_len]
    return cut.strip() + "..."


def _estimate_duration_ms(text: str) -> int:
    """Rough estimate of speech duration: ~150 words/min → ~2.5 w/s.

    For Vietnamese, speech rate is similar (~150 wpm average).
    """
    words = len(text.split())
    if words == 0:
        return 0
    seconds = words / 2.5
    return int(seconds * 1000)




language_bridge = LanguageBridgeService()
