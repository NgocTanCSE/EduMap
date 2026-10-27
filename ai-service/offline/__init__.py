"""
Edge AI Tutor — offline LLM tutor package (Idea #7).

Provides local, internet-free AI tutoring using a small language model
(TinyLlama 1.1B Chat, 4-bit quantized) running inside the ai-service
container on HF Spaces.

Public API:
    from offline.tutor import OfflineTutor
    tutor = OfflineTutor.get_instance()
    result = tutor.explain(topic="Đạo hàm", material_context="...")
    result = tutor.generate_practice(topic="Toán", difficulty="medium")
    result = tutor.suggest_next(user_progression={...})
"""

from .tutor import OfflineTutor, tutor_singleton

__all__ = ["OfflineTutor", "tutor_singleton"]
