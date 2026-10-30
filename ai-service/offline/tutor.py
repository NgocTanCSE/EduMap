"""
Edge AI Tutor — offline-first LLM tutor (Idea #7).

The bundled TinyLlama 1.1B local model was **removed** (2026-10-30): loading it
needed ~1.5 GB RAM and produced ~2-5 tokens/s on the 2-vCPU HF free tier, i.e.
30-60 s per answer. The tutor now generates through the shared text cascade
(DeepSeek → Gemini → Cloudflare) and falls back to curated Vietnamese templates
when no provider is configured or every provider fails.

Every method still degrades gracefully: it never raises and always returns a
valid response with ``degraded=True`` when the text came from a template.

Design goals (per AGENTS.md):
  * Lazy loading — the model is instantiated only on the first request so
    that ai-service startup stays fast (ChomaDB seeding happens in parallel).
  * Singleton — only one model instance lives in memory at a time.
  * Thread-safe — all public methods are synchronous and guarded so that
    concurrent FastAPI requests don't trigger duplicate loads.
  * TTL cache — identical requests are served from an in-memory dict cache
    (default 1 hour) to amortise the cost of CPU generation.
  * Graceful degradation — never raises; always returns a valid response.

Usage (inside FastAPI router):
    from offline.tutor import OfflineTutor
    tutor = OfflineTutor.get_instance()
    result = tutor.explain(topic="Đạo hàm", material_context="...")
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Configuration (env-tunable, AGENTS.md compliant) ───────────────────────
OFFLINE_MAX_TOKENS = int(os.getenv("OFFLINE_MAX_TOKENS", "256"))
OFFLINE_TEMPERATURE = float(os.getenv("OFFLINE_TEMPERATURE", "0.7"))
OFFLINE_TOP_P = float(os.getenv("OFFLINE_TOP_P", "0.9"))
OFFLINE_CACHE_TTL = int(os.getenv("OFFLINE_CACHE_TTL", "3600"))  # 1 hour (s)
OFFLINE_CACHE_MAX = int(os.getenv("OFFLINE_CACHE_MAX", "128"))
# Set OFFLINE_TUTOR_USE_LLM=false to force the template-only path (the tutor
# then answers instantly without any network call, e.g. for offline demos).
OFFLINE_TUTOR_USE_LLM = (
    os.getenv("OFFLINE_TUTOR_USE_LLM", "true").lower() != "false"
)


# ───────────────────────────────────────────────────────────────────────────
# Template-based fallback content (Vietnamese educational content)
# ───────────────────────────────────────────────────────────────────────────

_TEMPLATE_EXPLANATIONS: Dict[str, str] = {
    "đạo hàm": (
        "Đạo hàm của một hàm số f(x) tại một điểm đo lường tốc độ thay đổi "
        "của f tại điểm đó. Công thức cơ bản: nếu f(x) = x^n thì "
        "f'(x) = n · x^(n-1).\n"
        "Ví dụ: f(x) = x³ → f'(x) = 3x²;  f(x) = √x = x^(1/2) → "
        "f'(x) = ½ · x^(-1/2) = 1/(2√x).\n"
        "Các dấu hiệu nhận dạng: hằng số nhân (c·f)' = c·f'; tổng (f+g)' = f'+g'; "
        "tích (f·g)' = f'·g + f·g'; thương (f/g)' = (f'·g - f·g')/g²."
    ),
    "vi phân": "Vi phân là mảng toán học nghiên cứu thay đổi liên tục...",
    "xác suất": "Xác suất đo mức độ khả năng của một sự kiện xảy ra...",
    "ma trận": "Ma trận là một bảng các số sắp xếp theo hàng và cột...",
    "tích phân": "Tích phân là phép nghịch đảo của đạo hài...",
}

_TEMPLATE_PRACTICE: Dict[str, List[Dict[str, str]]] = {
    "đạo hàf": [
        {"question": "Tính đạo hàm của f(x) = 3x^4 - 2x^2 + 5", "answer": "f'(x) = 12x^3 - 4x", "difficulty": "medium"},
        {"question": "Đạo hàm của hàm số nào luôn bằng 0?", "answer": "Hàm số hằng", "difficulty": "easy"},
    ],
    "toán": [
        {"question": "Giải phương trình 2x + 5 = 15", "answer": "x = 5", "difficulty": "easy"},
        {"question": "Tính diện tích hình tròn có bán kính R=3", "answer": "9π", "difficulty": "medium"},
    ],
}


def _template_explain(topic: str, material_context: Optional[str]) -> str:
    """Return a template explanation in Vietnamese for *topic*."""
    key = topic.lower().strip()
    if key in _TEMPLATE_EXPLANATIONS:
        base = _TEMPLATE_EXPLANATIONS[key]
    else:
        # Generic explanation template
        base = (
            f"**{topic}** là một khái niệm quan trọng trong chương trình học.\n\n"
            f"Để hiểu rõ hơn, học sinh cần nắm vững các khái niệm cơ bản "
            f"liên quan đến {topic}, luyện tập qua các bài tập mẫu, "
            f"và áp dụng vào các tình huống thực tế.\n\n"
            f"Bạn nên ôn lại lý thuyết cơ sở và thực hành nhiều ví dụ "
            f"để chắc chắn nắm vững chương này."
        )
    if material_context:
        base += f"\n\n**Tài liệu tham khảo:** {material_context}"
    return base


def _template_practice(
    topic: str, difficulty: str, num_questions: int
) -> List[Dict[str, Any]]:
    """Return template practice questions in Vietnamese."""
    key = topic.lower().strip()
    pool = _TEMPLATE_PRACTICE.get(key, _TEMPLATE_PRACTICE.get("toán", []))
    if not pool:
        pool = [
            {
                "question": f"Tạo câu hỏi luyện tập cho chủ đề: {topic}",
                "answer": f"Hãy xem xét lại lý thuyết và công thức liên quan.",
                "difficulty": difficulty,
            }
        ]
    results = []
    for i in range(min(num_questions, len(pool))):
        item = pool[i].copy()
        item["difficulty"] = item.get("difficulty", difficulty)
        results.append(item)
    return results


def _template_suggest(next_step: str, topic: str = "") -> Dict[str, Any]:
    """Return a template suggestion for what to study next."""
    if not next_step:
        next_step = f"Tiếp tục học chương tiếp theo liên quan đến {topic}"
    return {
        "next_step": next_step,
        "resources": [],
        "estimated_time": "15-20 phút",
        "difficulty": "medium",
    }


# ───────────────────────────────────────────────────────────────────────────
# Prompt templates for the tutor LLM
# ───────────────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "Bạn là 'Trợ lý học tập' của EduMap DNTU. Bạn giúp học sinh giải thích "
    "khái niệm, làm bài tập và đề xuất lộ trình học tập. Trả lời ngắn gọn, "
    "rõ ràng, bằng tiếng Việt, phù hợp với trình độ học sinh."
)


# ───────────────────────────────────────────────────────────────────────────
# OfflineTutor — main class
# ───────────────────────────────────────────────────────────────────────────


class OfflineTutor:
    """Tutor that answers through the shared LLM cascade, templates as backup.

    No model is bundled or downloaded any more: text comes from
    ``LLMService._generate_text_with_fallback`` (DeepSeek → Gemini → Cloudflare)
    and, when that is unavailable, from the curated Vietnamese templates below.
    An in-process TTL cache prevents regenerating identical responses, which
    matters because a DeepSeek/Gemini round-trip is ~1-3 s.
    """

    _instance: Optional["OfflineTutor"] = None
    _instance_lock = threading.Lock()

    def __init__(self) -> None:
        self._cache: Dict[str, Tuple[str, float]] = {}  # key → (result_json, expiry_ts)
        self._cache_lock = threading.Lock()

    # ── Singleton accessor ──────────────────────────────────────────────

    @classmethod
    def get_instance(cls) -> "OfflineTutor":
        """Return the singleton OfflineTutor instance."""
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    # ── Generation ──────────────────────────────────────────────────────

    def _llm_ready(self) -> bool:
        """True when at least one remote text provider is configured."""
        if not OFFLINE_TUTOR_USE_LLM:
            return False
        try:
            from services.llm_service import llm_service as _llm

            return bool(getattr(_llm, "is_ready", False))
        except Exception:  # pragma: no cover — llm_service import is defensive
            return False

    def _provider_name(self) -> Optional[str]:
        """Name to report in ``model_used`` (None when templates were used)."""
        if not self._llm_ready():
            return None
        try:
            from services.llm_service import llm_service as _llm

            if getattr(_llm, "has_deepseek", False):
                return getattr(_llm, "deepseek_models", ["deepseek-chat"])[0]
            if getattr(_llm, "has_gemini", False):
                return getattr(_llm, "gemini_model_name", None)
            if getattr(_llm, "has_cf", False):
                return getattr(_llm, "model_name", None)
        except Exception:
            pass
        return None

    def _generate(self, prompt: str, max_tokens: int = None) -> str:
        """Generate text for *prompt*; return "" so the caller uses templates.

        Uses the shared cascade (DeepSeek → Gemini → Cloudflare). Local model
        generation was removed because 2 vCPU CPU inference needed 30-60 s per
        answer, which the NestJS proxy (10 s) and the UX cannot absorb.
        """
        if not self._llm_ready():
            return ""
        try:
            from services.llm_service import llm_service as _llm

            full_prompt = (
                _SYSTEM_PROMPT + "\n\nTrả lời bằng văn bản thuần, không dùng "
                "markdown (không **, #, ``` hay •).\n\n" + prompt
            )
            text = _llm._generate_text_with_fallback(
                full_prompt,
                temperature=OFFLINE_TEMPERATURE,
                max_tokens=max_tokens or OFFLINE_MAX_TOKENS,
                top_p=OFFLINE_TOP_P,
            ) or ""
            # The app renders plain text everywhere (EduMap has no markdown
            # renderer), so flatten any markers the LLM emitted. The same
            # helper is exposed to the frontend as a client-side safety net.
            try:
                from services.llm_service import _strip_markdown as _strip
            except Exception:  # pragma: no cover
                def _strip(x: str) -> str:
                    return x
            return _strip(text)
        except Exception as e:
            logger.warning(f"[OfflineTutor] LLM generation failed: {e}")
            return ""

    # ── Cache helpers ──────────────────────────────────────────────────

    def _cache_key(self, parts: List[str]) -> str:
        return hashlib.md5("|".join(parts).encode("utf-8")).hexdigest()

    def _cache_get(self, key: str) -> Optional[str]:
        with self._cache_lock:
            entry = self._cache.get(key)
            if entry is None:
                return None
            result_str, expiry = entry
            if time.time() > expiry:
                del self._cache[key]
                return None
            return result_str

    def _cache_set(self, key: str, value: str) -> None:
        with self._cache_lock:
            # Evict oldest entries if cache is full
            if len(self._cache) >= OFFLINE_CACHE_MAX:
                oldest_key = min(self._cache, key=lambda k: self._cache[k][1])
                del self._cache[oldest_key]
            self._cache[key] = (value, time.time() + OFFLINE_CACHE_TTL)

    # ── Public API ─────────────────────────────────────────────────────

    def explain(
        self, topic: str, material_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """Explain a topic for a student.

        Args:
            topic: The subject/concept to explain (e.g. "Đạo hàm").
            material_context: Optional text from learning materials.

        Returns:
            {"text": str, "degraded": bool, "source": "model"|"template",
             "model_used": str}
        """
        cache_parts = ["explain", topic or "", material_context or ""]
        cache_key = self._cache_key(cache_parts)
        cached = self._cache_get(cache_key)
        if cached is not None:
            return json.loads(cached)

        prompt = f"Giải thích khái niệm '{topic}' một cách ngắn gọn và dễ hiểu cho học sinh."
        if material_context:
            prompt += f"\n\nBối cảnh từ tài liệu: {material_context}"

        text = self._generate(prompt, max_tokens=256)
        degraded = False
        source = "model"

        if not text:
            # Template fallback
            text = _template_explain(topic, material_context)
            degraded = True
            source = "template"

        # Add a footer if using fallback
        if degraded:
            text += (
                "\n\nLưu ý: Trả lời này được tạo từ mẫu có sẵn của EduMap vì "
                "chưa kết nối được nhà cung cấp AI. Nội dung vẫn bám sát "
                "chương trình học nhưng ngắn hơn so với câu trả lời do AI sinh."
            )

        result = {
            "text": text,
            "degraded": degraded,
            "source": source,
            "model_used": self._provider_name(),
            "topic": topic,
        }
        self._cache_set(cache_key, json.dumps(result, ensure_ascii=False))
        return result

    def generate_practice(
        self,
        topic: str,
        difficulty: str = "medium",
        num_questions: int = 3,
    ) -> Dict[str, Any]:
        """Generate practice questions for a topic.

        Args:
            topic: The subject to generate questions for.
            difficulty: "easy" | "medium" | "hard"
            num_questions: How many questions to generate (1-5, clamped).

        Returns:
            {"questions": [{"question", "answer", "difficulty"}],
             "degraded": bool, "source": str, "model_used": str}
        """
        num_questions = max(1, min(num_questions, 5))  # safety clamp

        cache_parts = ["practice", topic or "", difficulty, str(num_questions)]
        cache_key = self._cache_key(cache_parts)
        cached = self._cache_get(cache_key)
        if cached is not None:
            return json.loads(cached)

        prompt = (
            f"Tạo {num_questions} câu hỏi luyện tập cho chủ đề '{topic}' "
            f"với độ khó {difficulty}. Đối với mỗi câu, cung cấp câu trả lời. "
            f"Trả về JSON: "
            f'[{{"question": "...", "answer": "...", "difficulty": "{difficulty}"}}]'
        )

        text = self._generate(prompt, max_tokens=512)
        degraded = False
        questions: List[Dict[str, Any]] = []

        if text and text.strip().startswith("["):
            try:
                parsed = json.loads(text.strip())
                if isinstance(parsed, list):
                    for item in parsed:
                        if isinstance(item, dict) and "question" in item:
                            questions.append(
                                {
                                    "question": item["question"],
                                    "answer": item.get("answer", "Xem lời giải"),
                                    "difficulty": item.get("difficulty", difficulty),
                                }
                            )
            except (json.JSONDecodeError, TypeError):
                pass  # fall through to template

        if not questions:
            degraded = True
            questions = _template_practice(topic, difficulty, num_questions)

        result = {
            "questions": questions,
            "degraded": degraded,
            "source": "template" if degraded else "model",
            "model_used": self._provider_name(),
            "topic": topic,
            "difficulty": difficulty,
        }
        self._cache_set(cache_key, json.dumps(result, ensure_ascii=False))
        return result

    def suggest_next(
        self, user_progression: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Suggest the next learning step based on user progression.

        Args:
            user_progression: Contains:
              - topics_studied: list[str] — topics the user has covered
              - current_level: str — "beginner" | "intermediate" | "advanced"
              - weak_areas: list[str] — areas needing practice
              - goals: str — learning goal (optional)

        Returns:
            {"next_step": str, "resources": list, "estimated_time": str,
             "difficulty": str, "degraded": bool, ...}
        """
        # Build cache key from normalised JSON
        try:
            prog_json = json.dumps(user_progression, sort_keys=True, ensure_ascii=False)
        except (TypeError, ValueError):
            prog_json = str(user_progression)

        cache_key = self._cache_key(["suggest", prog_json])
        cached = self._cache_get(cache_key)
        if cached is not None:
            return json.loads(cached)

        topics = user_progression.get("topics_studied", [])
        if isinstance(topics, str):
            topics = [topics]
        weak = user_progression.get("weak_areas", [])
        if isinstance(weak, str):
            weak = [weak]
        level = user_progression.get("current_level", "beginner")
        goals = user_progression.get("goals", "")

        prompt = (
            f"Học sinh đang ở trình độ {level}. "
            f"Chủ đề đã học: {', '.join(str(t) for t in topics) or 'chưa có'}. "
            f"Điểm yếu: {', '.join(str(w) for w in weak) or 'không xác định'}. "
            f"Mục tiêu: {goals or 'học tốt chương hiện tại'}. "
            f"Đề xuất bước tiếp theo và ước tính thời gian."
        )

        text = self._generate(prompt, max_tokens=256)
        degraded = False

        if not text:
            degraded = True
            # Template suggestion
            focus = weak[0] if weak else (topics[-1] if topics else "chương tiếp theo")
            text = _template_suggest(
                f"Hãy ôn tập lại {focus} và chuẩn bị cho bài tiếp theo", focus
            )
            result = {
                "next_step": text.get("next_step", f"Ôn tập {focus}"),
                "resources": text.get("resources", []),
                "estimated_time": text.get("estimated_time", "15-20 phút"),
                "difficulty": text.get("difficulty", level),
                "degraded": True,
                "source": "template",
                "model_used": None,
                "progression": user_progression,
            }
        else:
            result = {
                "next_step": text.strip(),
                "resources": [],
                "estimated_time": "15-20 phút",
                "difficulty": level,
                "degraded": False,
                "source": "model",
                "model_used": self._provider_name(),
                "progression": user_progression,
            }

        self._cache_set(cache_key, json.dumps(result, ensure_ascii=False))
        return result

    # ── Diagnostics ────────────────────────────────────────────────────

    def status(self) -> Dict[str, Any]:
        """Return the current status of the offline tutor (for health checks).

        ``model_name`` / ``model_loaded`` are kept for backwards compatibility
        with the backend health check: they now describe the remote text
        provider used by the cascade (no local weights are loaded at all).
        """
        provider = self._provider_name()
        return {
            "model_name": provider or "template",
            "model_loaded": provider is not None,
            "model_failed": False,
            "model_enabled": OFFLINE_TUTOR_USE_LLM,
            "source": "llm-cascade" if provider else "template",
            "engine": "llm-cascade" if provider else "template",
            "template_fallback": provider is None,
            "cache_entries": len(self._cache),
            "cache_ttl_seconds": OFFLINE_CACHE_TTL,
            "cache_max_entries": OFFLINE_CACHE_MAX,
        }


# ── Module-level singleton ─────────────────────────────────────────────────
tutor_singleton = OfflineTutor() if False else None  # lazy — created on demand


def get_tutor() -> OfflineTutor:
    """Return the singleton OfflineTutor instance (lazy-created)."""
    return OfflineTutor.get_instance()
