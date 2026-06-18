import pytest
from unittest.mock import Mock, patch, MagicMock
from services.llm_service import LLMService

class TestLLMService:
    def setup_method(self):
        """Set up test fixtures."""
        self.service = LLMService()
        self.service.is_ready = False  # Mock mode

    def test_init(self):
        """Test LLMService initialization."""
        assert self.service is not None
        assert hasattr(self.service, 'is_ready')

    def test_chat_with_rag_offline(self):
        """Test chat_with_rag when Gemini is not available."""
        # Mock mode - should return mock response
        result = self.service.chat_with_rag(
            message="Hello",
            history=[],
            user_id="test-user"
        )
        assert result is not None
        assert isinstance(result, dict)
        assert "reply" in result

    def test_recommend_career_offline(self):
        """Test recommend_career when Gemini is not available."""
        profile = {
            "skills": ["Python", "Machine Learning"],
            "interests": ["AI", "Data Science"],
            "mbti_type": "INTJ"
        }
        result = self.service.recommend_career(profile)
        assert result is not None
        assert isinstance(result, dict)

    def test_generate_learning_path_offline(self):
        """Test generate_learning_path when Gemini is not available."""
        result = self.service.generate_learning_path(
            level="beginner",
            target_role="AI Engineer",
            weekly_hours=10
        )
        assert result is not None
        assert isinstance(result, dict)

    def test_moderate_text_offline(self):
        """Test moderate_text when Gemini is not available."""
        result = self.service.moderate_text("Hello world")
        assert result is not None
        assert isinstance(result, dict)
        assert "action" in result

    def test_match_mentors_offline(self):
        """Test match_mentors when Gemini is not available."""
        student_profile = {"skills": ["Python"], "interests": ["AI"]}
        mentors = [{"id": "1", "name": "Mentor 1", "skills": ["Python", "AI"]}]
        result = self.service.match_mentors(student_profile, mentors)
        assert result is not None
        assert isinstance(result, dict)

    def test_summarize_material_offline(self):
        """Test summarize_material when Gemini is not available."""
        material = {"title": "Python Basics", "description": "Introduction to Python"}
        result = self.service.summarize_material(material)
        assert result is not None
        assert isinstance(result, dict)

    def test_get_suggestions_offline(self):
        """Test get_suggestions when Gemini is not available."""
        result = self.service.get_suggestions(
            skills=["Python"],
            interests=["AI"]
        )
        assert result is not None
        assert isinstance(result, list)

    def test_analyze_geo_density_offline(self):
        """Test analyze_geo_density when Gemini is not available."""
        hubs = [{"center": {"lat": 10.95, "lng": 107.18}, "point_count": 10}]
        result = self.service.analyze_geo_density(None, hubs)
        assert result is not None
        assert isinstance(result, str)

    def test_generate_daily_insight_offline(self):
        """Test generate_daily_insight when Gemini is not available."""
        dashboard_data = {"total_users": 100, "active_users": 50}
        result = self.service.generate_daily_insight(dashboard_data)
        assert result is not None
        assert isinstance(result, str)

    def test_extract_json(self):
        """Test _extract_json method."""
        # Test with markdown code block
        text1 = '```json\n{"key": "value"}\n```'
        result1 = self.service._extract_json(text1)
        assert result1 == {"key": "value"}

        # Test with raw JSON
        text2 = '{"key": "value"}'
        result2 = self.service._extract_json(text2)
        assert result2 == {"key": "value"}

        # Test with invalid JSON
        text3 = 'not json'
        result3 = self.service._extract_json(text3)
        assert result3 is None
