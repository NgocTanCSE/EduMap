import pytest
from unittest.mock import Mock, patch, MagicMock
from services.db_service import DBService

class TestDBService:
    def setup_method(self):
        """Set up test fixtures."""
        self.db = DBService()

    def test_init(self):
        """Test DBService initialization."""
        assert self.db is not None

    def test_get_user_events_offline(self):
        """Test get_user_events when database is not available."""
        result = self.db.get_user_events(limit=10)
        assert result is not None
        assert isinstance(result, list)

    def test_get_education_stats_offline(self):
        """Test get_education_stats when database is not available."""
        result = self.db.get_education_stats(year=2025)
        assert result is not None
        assert isinstance(result, list)

    def test_get_user_events_with_mock_db(self):
        """Test get_user_events with mocked database."""
        with patch.object(self.db, 'conn') as mock_conn:
            mock_cursor = Mock()
            mock_cursor.fetchall.return_value = [
                {"event_type": "page_view", "count": 100}
            ]
            mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
            mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)
            
            result = self.db.get_user_events(limit=10)
            assert result is not None

    def test_get_education_stats_with_mock_db(self):
        """Test get_education_stats with mocked database."""
        with patch.object(self.db, 'conn') as mock_conn:
            mock_cursor = Mock()
            mock_cursor.fetchall.return_value = [
                {"region": "Southeast", "metric_value": 85.5}
            ]
            mock_conn.cursor.return_value.__enter__ = Mock(return_value=mock_cursor)
            mock_conn.cursor.return_value.__exit__ = Mock(return_value=False)
            
            result = self.db.get_education_stats(year=2025)
            assert result is not None
