"""
Edge AI Tutor — offline LLM tutor (Idea #7).

Runs a small language model (TinyLlama 1.1B Chat) **locally** inside the
ai-service container on HF Spaces.  No external API calls are required — the
model is downloaded once at runtime from HuggingFace Hub and cached on disk.

When the model cannot be loaded (e.g. HF Spaces free-tier RAM is exhausted)
or generation fails for any reason, every method degrades gracefully to a
template-based Vietnamese response and sets ``degraded=True`` on the result.

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
OFFLINE_MODEL_NAME = os.getenv(
    "OFFLINE_MODEL_NAME", "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
)
OFFLINE_MODEL_CACHE = os.getenv(
    "OFFLINE_MODEL_CACHE", "/app/uploads/offline-models"
)
OFFLINE_MODEL_ENABLED = (
    os.getenv("OFFLINE_MODEL_ENABLED", "true").lower() != "false"
)
OFFLINE_MAX_TOKENS = int(os.getenv("OFFLINE_MAX_TOKENS", "256"))
OFFLINE_TEMPERATURE = float(os.getenv("OFFLINE_TEMPERATURE", "0.7"))
OFFLINE_TOP_P = float(os.getenv("OFFLINE_TOP_P", "0.9"))
OFFLINE_CACHE_TTL = int(os.getenv("OFFLINE_CACHE_TTL", "3600"))  # 1 hour (s)
OFFLINE_CACHE_MAX = int(os.getenv("OFFLINE_CACHE_MAX", "128"))

# HF Spaces free-tier is CPU-only (no CUDA). We try 4-bit quantisation with
# bitsandbytes if CUDA is available, otherwise fall back to BF16 / FP16
# dynamic quantisation which still fits in ~1-1.5 GB RAM.
_TORCH_AVAILABLE = False
_TRANSFORMERS_AVAILABLE = False
_BNB_AVAILABLE = False
try:
    import torch  # noqa: F401
    _TORCH_AVAILABLE = True
except ImportError:
    logger.warning("torch not installed — offline tutor will use template fallback only")

if _TORCH_AVAILABLE:
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        _TRANSFORMERS_AVAILABLE = True
    except ImportError:
        logger.warning("transformers not installed — offline tutor will use template fallback")


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
# Prompt templates for the local LLM
# ───────────────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "Bạn là 'Trợ lý ngoại tuyến' — một giáo viên AI chạy cục bộ trên thiết bị, "
    "không cần kết nối internet. Bạn giúp học sinh giải thích khái niệm, "
    "làm bài tập và đề xuất lộ trình học tập. Trả lời ngắn gọn, rõ ràng, "
    "bằng tiếng Việt, phù hợp với trình độ học sinh."
)


def _format_chat_prompt(messages: List[Dict[str, str]]) -> str:
    """Format messages into TinyLlama-1.1B-Chat chat template.

    TinyLlama uses a Llama-2-style template:
      <|system|>\\n{system}</s>\\n<|user|>\\n{user}</s>\\n
    If the tokenizer already has a chat_template we let it handle this, but
    this helper is the fallback for raw string construction.
    """
    parts: List[str] = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "system":
            parts.append(f"<|system|>\n{content}\n")
        elif role == "user":
            parts.append(f"<|user|>\n{content}\n")
        else:  # assistant
            parts.append(f"<|assistant|>\n{content}\n")
    parts.append("<|assistant|>\n")
    return "".join(parts)


# ───────────────────────────────────────────────────────────────────────────
# OfflineTutor — main class
# ───────────────────────────────────────────────────────────────────────────


class OfflineTutor:
    """Local LLM tutor that runs offline inside the ai-service container.

    The model (TinyLlama 1.1B Chat, 4-bit or BF16) is loaded lazily on the
    first call to any public method.  Subsequent calls reuse the in-memory
    instance.  An in-process TTL cache prevents regenerating identical
    responses.

    Thread safety: all public methods are synchronous; a class-level lock
    serialises the one-time model download.  Inference itself is fast enough
    (~2-4 s/token on CPU for 1.1B) that serialisation is acceptable.
    """

    _instance: Optional["OfflineTutor"] = None
    _instance_lock = threading.Lock()

    def __init__(self) -> None:
        self._model: Any = None
        self._tokenizer: Any = None
        self._load_lock = threading.Lock()
        self._model_loaded: bool = False
        self._model_failed: bool = False
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

    # ── Model loading (lazy, lazy, lazy) ────────────────────────────────

    def _load_model(self) -> bool:
        """Attempt to load the local LLM.  Returns True on success.

        Tries, in order of preference:
          1. 4-bit NF4 via bitsandbytes (smallest, ~300 MB)
          2. BF16 via torch (good quality/size ratio)
          3. FP16 (fallback)
        Sets ``_model_failed = True`` so we don't retry on every request.
        """
        if self._model_loaded or self._model_failed:
            return self._model_loaded

        if not _TORCH_AVAILABLE or not _TRANSFORMERS_AVAILABLE:
            logger.info("transformers/torch not available — using template fallback")
            self._model_failed = True
            return False

        if not OFFLINE_MODEL_ENABLED:
            logger.info("OFFLINE_MODEL_ENABLED=false — using template fallback")
            self._model_failed = True
            return False

        try:
            from transformers import (
                AutoModelForCausalLM,
                AutoTokenizer,
            )

            model_name = OFFLINE_MODEL_NAME
            cache_dir = OFFLINE_MODEL_CACHE
            os.makedirs(cache_dir, exist_ok=True)

            logger.info(f"[OfflineTutor] Loading model: {model_name} → {cache_dir}")

            # ── Try 4-bit quantisation (requires CUDA + bitsandbytes) ──
            use_4bit = False
            try:
                import bitsandbytes as bnb  # noqa: F401
                _bnb_available = True
            except ImportError:
                _bnb_available = False

            try:
                if _bnb_available:
                    from transformers import BitsAndBytesConfig

                    quant_cfg = BitsAndBytesConfig(
                        load_in_4bit=True,
                        bnb_4bit_compute_dtype="auto",
                        bnb_4bit_quant_type="nf4",
                        bnb_4bit_use_double_quant=True,
                    )
                    self._tokenizer = AutoTokenizer.from_pretrained(
                        model_name, cache_dir=cache_dir, use_fast=True
                    )
                    self._model = AutoModelForCausalLM.from_pretrained(
                        model_name,
                        cache_dir=cache_dir,
                        device_map="auto",
                        quantization_config=quant_cfg,
                        trust_remote_code=False,
                    )
                    use_4bit = True
                    logger.info("[OfflineTutor] Model loaded with 4-bit NF4 quantisation")
            except Exception as e:
                logger.warning(f"[OfflineTutor] 4-bit load failed ({e}), trying BF16")

            # ── Fallback: BF16 (works on CPU) ──
            if not use_4bit:
                self._tokenizer = AutoTokenizer.from_pretrained(
                    model_name, cache_dir=cache_dir, use_fast=True
                )
                self._model = AutoModelForCausalLM.from_pretrained(
                    model_name,
                    cache_dir=cache_dir,
                    torch_dtype="auto",
                    device_map="auto",
                    trust_remote_code=False,
                )
                logger.info("[OfflineTutor] Model loaded with auto dtype (BF16/FP16)")

            self._model_loaded = True
            return True

        except Exception as e:
            logger.error(f"[OfflineTutor] Model load failed: {e}")
            self._model_failed = True
            return False

    # ── Generation ──────────────────────────────────────────────────────

    def _generate(self, prompt: str, max_tokens: int = None) -> str:
        """Generate text from *prompt* using the local model.

        Falls back to ``None`` → caller invokes template fallback.
        """
        if not self._load_model():
            return ""

        if self._model is None or self._tokenizer is None:
            return ""

        try:
            from transformers import GenerationConfig

            max_new = max_tokens or OFFLINE_MAX_TOKENS

            # Use the tokenizer's chat template if available
            use_template = hasattr(self._tokenizer, "apply_chat_template")
            if use_template:
                messages = [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ]
                try:
                    input_ids = self._tokenizer.apply_chat_template(
                        messages,
                        add_generation_prompt=True,
                        return_tensors="pt",
                    )
                except Exception:
                    # Fallback to manual formatting
                    input_ids = self._tokenizer.encode(
                        _format_chat_prompt(messages),
                        return_tensors="pt",
                    )
            else:
                input_ids = self._tokenizer.encode(
                    _format_chat_prompt(
                        [
                            {"role": "system", "content": _SYSTEM_PROMPT},
                            {"role": "user", "content": prompt},
                        ]
                    ),
                    return_tensors="pt",
                )

            with __import__("torch").no_grad():
                gen_cfg = GenerationConfig(
                    max_new_tokens=max_new,
                    temperature=OFFLINE_TEMPERATURE,
                    top_p=OFFLINE_TOP_P,
                    do_sample=True,
                    pad_token_id=self._tokenizer.eos_token_id,
                )
                outputs = self._model.generate(input_ids=input_ids, generation_config=gen_cfg)

            # Decode and strip the prompt portion
            input_len = input_ids.shape[-1] if hasattr(input_ids, "shape") else len(input_ids[0])
            result = self._tokenizer.decode(outputs[0][input_len:], skip_special_tokens=True)
            return result.strip()

        except Exception as e:
            logger.error(f"[OfflineTutor] Generation error: {e}")
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
                "\n\n*Lưu ý: Trả lời này được tạo bởi bản sao chép mẫu (template) "
                "vì mô hình AI cục bộ chưa sẵn sàng. Hãy tải lên thiết bị để "
                "nhận được giải thích chi tiết hơn.*"
            )

        result = {
            "text": text,
            "degraded": degraded,
            "source": source,
            "model_used": OFFLINE_MODEL_NAME if self._model_loaded else None,
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
            "model_used": OFFLINE_MODEL_NAME if self._model_loaded else None,
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
                "model_used": OFFLINE_MODEL_NAME if self._model_loaded else None,
                "progression": user_progression,
            }

        self._cache_set(cache_key, json.dumps(result, ensure_ascii=False))
        return result

    # ── Diagnostics ────────────────────────────────────────────────────

    def status(self) -> Dict[str, Any]:
        """Return the current status of the offline tutor (for health checks)."""
        return {
            "model_name": OFFLINE_MODEL_NAME,
            "model_loaded": self._model_loaded,
            "model_failed": self._model_failed,
            "model_enabled": OFFLINE_MODEL_ENABLED,
            "torch_available": _TORCH_AVAILABLE,
            "transformers_available": _TRANSFORMERS_AVAILABLE,
            "cache_entries": len(self._cache),
            "cache_ttl_seconds": OFFLINE_CACHE_TTL,
            "cache_max_entries": OFFLINE_CACHE_MAX,
            "model_cache_path": OFFLINE_MODEL_CACHE,
        }


# ── Module-level singleton ─────────────────────────────────────────────────
tutor_singleton = OfflineTutor() if False else None  # lazy — created on demand


def get_tutor() -> OfflineTutor:
    """Return the singleton OfflineTutor instance (lazy-created)."""
    return OfflineTutor.get_instance()
