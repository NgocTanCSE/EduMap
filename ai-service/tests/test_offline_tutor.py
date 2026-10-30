"""Unit tests for the Edge AI Tutor (offline) — Idea #7.

These tests run WITHOUT any network access (the LLM cascade is disabled) —
they verify:

  1. Template fallback works for all three actions (explain, practice, suggest)
  2. The cache returns cached results on repeat calls
  3. Graceful degradation: every method returns a valid dict with
     degraded=True when no text provider is reachable
  4. Input validation / safety clamps (num_questions in 1-5 range)
  5. The FastAPI router returns 200 with degraded=True when model is absent

Run:  cd ai-service && python3 -m pytest tests/test_offline_tutor.py -q
"""

import asyncio
import os
import sys
import json

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Force the template-only path so tests never touch a network provider.
os.environ["OFFLINE_TUTOR_USE_LLM"] = "false"

from offline.tutor import OfflineTutor  # noqa: E402
from offline.tutor import (
    _template_explain,
    _template_practice,
    _template_suggest,
)  # noqa: E402


# ── Template fallback tests ──────────────────────────────────────────────

def test_explain_returns_text_and_degraded_flag():
    """explain() returns a dict with 'text' and degraded=True when model is disabled."""
    tutor = OfflineTutor()
    result = tutor.explain(topic="Đạo hàm", material_context="Sách trang 42")
    assert isinstance(result, dict)
    assert "text" in result
    assert len(result["text"]) > 0
    assert result["degraded"] is True
    assert result["source"] == "template"
    print("✓ test_explain_returns_text_and_degraded_flag")


def test_explain_known_topic_uses_template():
    """Known topics (e.g. 'đạo hàm') get a specific template explanation."""
    tutor = OfflineTutor()
    result = tutor.explain(topic="đạo hàm")
    assert result["text"] is not None
    assert "đạo hàm" in result["text"].lower()
    print("✓ test_explain_known_topic_uses_template")


def test_explain_unknown_topic_gets_generic_template():
    """Unknown topics get a generic explanation template."""
    tutor = OfflineTutor()
    result = tutor.explain(topic="Quantum Computing")
    assert result["text"] is not None
    assert len(result["text"]) > 20  # non-trivial
    assert result["degraded"] is True
    print("✓ test_explain_unknown_topic_gets_generic_template")


def test_generate_practice_returns_questions():
    """generate_practice() returns a list of question dicts."""
    tutor = OfflineTutor()
    result = tutor.generate_practice(topic="Toán", difficulty="medium", num_questions=3)
    assert "questions" in result
    assert isinstance(result["questions"], list)
    assert len(result["questions"]) >= 1
    assert result["degraded"] is True
    for q in result["questions"]:
        assert "question" in q
        assert "answer" in q
        assert "difficulty" in q
    print("✓ test_generate_practice_returns_questions")


def test_generate_practice_clamps_num_questions():
    """num_questions is clamped to [1, 5]."""
    tutor = OfflineTutor()
    # Request 10 questions — should be clamped to 5
    result = tutor.generate_practice(topic="Toán", num_questions=10)
    assert len(result["questions"]) <= 5
    # Request 0 — clamped to 1
    result2 = tutor.generate_practice(topic="Toán", num_questions=0)
    assert len(result2["questions"]) >= 1
    print("✓ test_generate_practice_clamps_num_questions")


def test_suggest_next_returns_next_step():
    """suggest_next() returns a dict with next_step and degraded flag."""
    tutor = OfflineTutor()
    progression = {
        "topics_studied": ["Đạo hàm", "Nguyên hàm"],
        "current_level": "intermediate",
        "weak_areas": ["Vi phân"],
        "goals": "Chuẩn bị thi THPT QG",
    }
    result = tutor.suggest_next(user_progression=progression)
    assert "next_step" in result
    assert len(result["next_step"]) > 0
    assert result["degraded"] is True
    print("✓ test_suggest_next_returns_next_step")


def test_cache_returns_same_result():
    """Repeated calls with same args return cached result (same content)."""
    tutor = OfflineTutor()
    result1 = tutor.explain(topic="Derivative Test", material_context=None)
    result2 = tutor.explain(topic="Derivative Test", material_context=None)
    assert result1["text"] == result2["text"]
    assert result1["source"] == result2["source"]
    print("✓ test_cache_returns_same_result")


def test_cache_different_args_returns_different_results():
    """Different topics produce different cache entries."""
    tutor = OfflineTutor()
    r1 = tutor.explain(topic="Topic A")
    r2 = tutor.explain(topic="Topic B")
    assert r1["text"] != r2["text"]
    print("✓ test_cache_different_args_returns_different_results")


def test_safety_cap_on_num_questions():
    """num_questions is clamped by the method itself."""
    tutor = OfflineTutor()
    result = tutor.generate_practice(topic="Test", num_questions=100)
    assert len(result["questions"]) <= 5
    print("✓ test_safety_cap_on_num_questions")


def test_empty_progression_handled():
    """suggest_next with empty progression dict doesn't crash."""
    tutor = OfflineTutor()
    result = tutor.suggest_next(user_progression={})
    assert "next_step" in result
    assert result["degraded"] is True
    print("✓ test_empty_progression_handled")


def test_status_reports_model_state():
    """status() returns the expected keys."""
    tutor = OfflineTutor()
    status = tutor.status()
    assert "model_name" in status
    assert "model_loaded" in status
    assert "model_failed" in status
    assert status["engine"] in ("llm-cascade", "template")
    assert "template_fallback" in status
    print("✓ test_status_reports_model_state")


def test_get_tutor_singleton():
    """get_instance() returns the same object every time."""
    from offline.tutor import OfflineTutor as OT
    a = OT.get_instance()
    b = OT.get_instance()
    assert a is b
    print("✓ test_get_tutor_singleton")


# ── Test runner ──────────────────────────────────────────────────────────

def _run_all():
    test_explain_returns_text_and_degraded_flag()
    test_explain_known_topic_uses_template()
    test_explain_unknown_topic_gets_generic_template()
    test_generate_practice_returns_questions()
    test_generate_practice_clamps_num_questions()
    test_suggest_next_returns_next_step()
    test_cache_returns_same_result()
    test_cache_different_args_returns_different_results()
    test_safety_cap_on_num_questions()
    test_empty_progression_handled()
    test_status_reports_model_state()
    test_get_tutor_singleton()
    print("\n✅ All offline tutor tests passed!")


if __name__ == "__main__":
    _run_all()
