"""Unit tests for all AI method graceful-degradation fallbacks.

Verifies that when every LLM provider is unreachable, all AI service methods
return valid-shaped fallback data instead of raising 503/502 errors that would
break the frontend features (career quiz, roadmap, mentor matching, etc.).
"""

import asyncio
import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure NO real providers are configured before importing
for _v in [
    "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "OPENROUTER_API_KEY",
    "NVIDIA_API_KEY", "NIM_API_KEY",
]:
    os.environ[_v] = ""
os.environ["AI_PREFLIGHT"] = "false"

from services.llm_service import LLMService
from models.learning_models import LearningPathRequest
from models.career_models import CareerAnalysisRequest
from models.library_models import MaterialSummaryRequest
from models.mentor_models import MatchRequest, MentorProfile
from models.geo_models import GeoDensityAnalysisRequest


def _fresh_service():
    """Return a brand-new LLMService with all providers disabled."""
    return LLMService()


def test_learning_path_degraded_fallback():
    """generate_learning_path returns a template path with _degraded=True
    instead of raising when all providers are down."""
    svc = _fresh_service()
    data = LearningPathRequest(
        user_id="test-user", current_level="Beginner",
        target_role="Data Scientist", time_commitment_hours_per_week=15
    )
    result = asyncio.run(svc.generate_learning_path(data))
    assert isinstance(result, dict)
    assert result["target_role"] == "Data Scientist"
    assert isinstance(result["steps"], list)
    assert len(result["steps"]) >= 1
    assert result["_degraded"] is True
    assert "template fallback" in result["_reason"]
    print("✓ test_learning_path_degraded_fallback")


def test_recommend_career_degraded_fallback():
    """recommend_career returns template suggestions with _degraded=True."""
    svc = _fresh_service()
    data = CareerAnalysisRequest(
        user_id="test-user",
        skills=["Python", "SQL"],
        career_aspirations=["Data Scientist"],
        mbti_type="INTJ",
    )
    result = asyncio.run(svc.recommend_career(data))
    assert isinstance(result, list)
    assert len(result) >= 2
    # Each fallback item should have _degraded marker
    for item in result:
        assert item["_degraded"] is True
        assert "_reason" in item
    # Verify field names match frontend expectations
    for item in result:
        assert "title" in item
        assert "match_score" in item
        assert isinstance(item["match_score"], int)
        assert "explanation" in item
        assert "missing_skills" in item
        assert isinstance(item["missing_skills"], list)
    print("✓ test_recommend_career_degraded_fallback")


def test_summarize_material_degraded_fallback():
    """summarize_material returns a template summary with _degraded=True."""
    svc = _fresh_service()
    data = MaterialSummaryRequest(
        title="Giới thiệu máy học",
        description="Sách về machine learning cơ bản",
    )
    result = asyncio.run(svc.summarize_material(data))
    assert isinstance(result, dict)
    assert "summary" in result
    assert isinstance(result["key_concepts"], list)
    assert isinstance(result["study_tips"], list)
    assert result["_degraded"] is True
    assert "template fallback" in result["_reason"]
    print("✓ test_summarize_material_degraded_fallback")


def test_match_mentors_degraded_fallback():
    """match_mentors returns an empty list (graceful) instead of raising."""
    svc = _fresh_service()
    data = MatchRequest(
        student_id="test-student",
        student_skills_needed=["Python"],
        student_mbti="INTJ",
        preferred_days=["Mon", "Wed"],
        available_mentors=[],
    )
    result = asyncio.run(svc.match_mentors(data))
    assert isinstance(result, list)
    assert result == []
    print("✓ test_match_mentors_degraded_fallback")


def test_analyze_geo_density_degraded_fallback():
    """analyze_geo_density returns a template analysis with _degraded=True."""
    svc = _fresh_service()
    data = GeoDensityAnalysisRequest(
        city="Hồ Chí Minh",
        points=[{"lat": 10.8, "lng": 106.7, "type": "school"}],
    )
    result = asyncio.run(svc.analyze_geo_density(data, hubs=[]))
    assert isinstance(result, dict)
    assert "summary" in result
    assert "density_score" in result
    assert isinstance(result["recommendations"], list)
    assert result["_degraded"] is True
    assert "template fallback" in result["_reason"]
    print("✓ test_analyze_geo_density_degraded_fallback")


def test_get_suggestions_degraded_fallback():
    """get_suggestions returns template suggestions with _degraded=True."""
    svc = _fresh_service()
    result = asyncio.run(svc.get_suggestions())
    assert isinstance(result, list)
    assert len(result) == 3
    for item in result:
        assert "_degraded" in item
        assert item["_degraded"] is True
        assert "title" in item
        assert "description" in item
        assert "match_score" in item
    print("✓ test_get_suggestions_degraded_fallback")


def test_generate_career_advice_degraded_fallback():
    """generate_career_advice returns a string fallback instead of raising."""
    svc = _fresh_service()
    result = asyncio.run(svc.generate_career_advice({"skills": "Python"}))
    assert isinstance(result, str)
    assert len(result) > 0
    assert "AI" in result  # mentions AI service
    print("✓ test_generate_career_advice_degraded_fallback")


if __name__ == "__main__":
    test_learning_path_degraded_fallback()
    test_recommend_career_degraded_fallback()
    test_summarize_material_degraded_fallback()
    test_match_mentors_degraded_fallback()
    test_analyze_geo_density_degraded_fallback()
    test_get_suggestions_degraded_fallback()
    test_generate_career_advice_degraded_fallback()
    print("\n✅ All AI fallback tests passed!")
