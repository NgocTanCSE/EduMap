"""
Edge AI Tutor — offline LLM tutor package (Idea #7).

AI tutoring backed by the ai-service text cascade
(DeepSeek → Gemini → Cloudflare) with curated Vietnamese templates as the
fallback. No local model weights are bundled (TinyLlama was removed on
2026-10-30 — 30-60 s per answer on the 2-vCPU free tier).

Public API:
    from offline.tutor import OfflineTutor
    tutor = OfflineTutor.get_instance()
    result = tutor.explain(topic="Đạo hàm", material_context="...")
    result = tutor.generate_practice(topic="Toán", difficulty="medium")
    result = tutor.suggest_next(user_progression={...})
"""

from .tutor import OfflineTutor, tutor_singleton

__all__ = ["OfflineTutor", "tutor_singleton"]
