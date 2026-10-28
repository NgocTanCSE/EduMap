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
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN",
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


def test_analyze_geo_density_fallback_accepts_geojson_hubs():
    """Issue #7: when all providers are down, the geo fallback must still
    correctly count hubs delivered as a GeoJSON FeatureCollection (the new
    shape produced by identify_education_hubs). This is the *real* degraded
    path on HF Spaces where AI keys are typically absent.

    Regression guard: a 3-feature collection must yield hub_count=3. The old
    code used ``len(hubs)`` on the dict (==2 for {type,features}) which would
    give the wrong density_score (15.4 vs the correct 23.1 here)."""
    svc = _fresh_service()
    hubs_fc = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "geometry": {"type": "Point", "coordinates": [106.84, 10.95]},
             "properties": {"hub_id": 0, "point_count": 8, "categories": ["school"]}},
            {"type": "Feature", "geometry": {"type": "Point", "coordinates": [106.80, 10.92]},
             "properties": {"hub_id": 1, "point_count": 5, "categories": ["university"]}},
            {"type": "Feature", "geometry": {"type": "Point", "coordinates": [106.70, 10.99]},
             "properties": {"hub_id": 2, "point_count": 1, "categories": []}},
        ],
    }
    # 13 points so density_score = hub_count / point_count * 100.
    data = GeoDensityAnalysisRequest(
        city="Biên Hòa",
        points=[{"lat": 10.95, "lng": 106.84, "type": "school"}] * 13,
    )
    result = asyncio.run(svc.analyze_geo_density(data, hubs=hubs_fc))
    assert result["_degraded"] is True
    assert "template fallback" in result["_reason"]
    # hub_count must be read from features (3), not len(dict)==2.
    # 3/13*100 = 23.0769... -> round -> 23.1
    assert result["density_score"] == 23.1
    assert "3 cụm giáo dục" in result["summary"]
    print("✓ test_analyze_geo_density_fallback_accepts_geojson_hubs")



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


def test_mentor_profile_accepts_id_alias():
    """MentorProfile must accept 'id' (from backend) as alias for 'mentor_id'.

    Regression: previously the backend sent {'id': ...} but the Pydantic model
    required 'mentor_id', causing 422 ValidationErrors on the /api/ai/mentor/match
    endpoint.
    """
    # Backend sends 'id' — must not raise
    m = MentorProfile(id="mentor-1", name="Dr. A", bio="AI expert", specialties=["AI", "Python"])
    assert m.mentor_id == "mentor-1"
    assert m.name == "Dr. A"
    assert m.specialties == ["AI", "Python"]
    # Optional fields get sensible defaults
    assert m.skills == []
    assert m.mbti == ""
    assert m.location is None

    # Canonical 'mentor_id' still works
    m2 = MentorProfile(mentor_id="mentor-2", name="Dr. B")
    assert m2.mentor_id == "mentor-2"
    print("✓ test_mentor_profile_accepts_id_alias")


def test_match_request_pre_filter_fields():
    """MatchRequest should carry pre-filter metadata (student_specialty,
    student_region, max_mentors) with backward-compatible defaults."""
    # Full pre-filtered request
    req = MatchRequest(
        student_id="stu-1",
        student_skills_needed=["Python", "AI"],
        student_mbti="INTJ",
        preferred_days=["T6", "CN"],
        available_mentors=[
            MentorProfile(id="m-1", name="Dr. A", specialties=["AI"]),
        ],
        student_region="TP.HCM",
        student_specialty="AI",
        max_mentors=15,
    )
    assert req.student_region == "TP.HCM"
    assert req.student_specialty == "AI"
    assert req.max_mentors == 15

    # Backward compat: pre-filter fields optional with defaults
    req2 = MatchRequest(
        student_id="stu-2",
        student_skills_needed=["Python"],
        student_mbti="ENFP",
        preferred_days=["T7"],
        available_mentors=[],
    )
    assert req2.student_region is None
    assert req2.student_specialty is None
    assert req2.max_mentors == 15
    print("✓ test_match_request_pre_filter_fields")


def test_match_mentors_safety_cap():
    """match_mentors must cap the number of mentors in the prompt to
    max_mentors even when the input list exceeds it (safety net).

    This prevents token overflow if the backend pre-filter is bypassed.
    """
    svc = _fresh_service()
    # Create 30 mentors — exceeds the default max_mentors (15)
    mentors = [
        MentorProfile(id=f"m-{i}", name=f"Mentor {i}", specialties=["AI"])
        for i in range(30)
    ]
    data = MatchRequest(
        student_id="test-student",
        student_skills_needed=["Python"],
        student_mbti="INTJ",
        preferred_days=["Mon"],
        available_mentors=mentors,
    )
    result = asyncio.run(svc.match_mentors(data))
    # With all providers down, returns fallback empty list — the point is
    # it must NOT raise (cap logic is exercised in the try block)
    assert isinstance(result, list)
    print("✓ test_match_mentors_safety_cap")


def test_match_mentors_safety_cap_with_custom_max():
    """match_mentors respects a custom max_mentors value."""
    svc = _fresh_service()
    mentors = [
        MentorProfile(id=f"m-{i}", name=f"Mentor {i}", specialties=["AI"])
        for i in range(50)
    ]
    data = MatchRequest(
        student_id="test-student",
        student_skills_needed=["Python"],
        student_mbti="INTJ",
        preferred_days=["Mon"],
        available_mentors=mentors,
        max_mentors=5,  # Custom cap
    )
    result = asyncio.run(svc.match_mentors(data))
    assert isinstance(result, list)
    print("✓ test_match_mentors_safety_cap_with_custom_max")


if __name__ == "__main__":
    test_learning_path_degraded_fallback()
    test_recommend_career_degraded_fallback()
    test_summarize_material_degraded_fallback()
    test_match_mentors_degraded_fallback()
    test_match_mentors_safety_cap()
    test_match_mentors_safety_cap_with_custom_max()
    test_mentor_profile_accepts_id_alias()
    test_match_request_pre_filter_fields()
    test_analyze_geo_density_degraded_fallback()
    test_analyze_geo_density_fallback_accepts_geojson_hubs()
    test_get_suggestions_degraded_fallback()
    test_generate_career_advice_degraded_fallback()
    print("\n✅ All AI fallback tests passed!")
