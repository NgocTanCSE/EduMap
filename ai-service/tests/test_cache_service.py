import pytest
from unittest.mock import Mock, patch, MagicMock
from services.cache_service import CacheService

class TestCacheService:
    def setup_method(self):
        """Set up test fixtures."""
        self.cache = CacheService()

    def test_init(self):
        """Test CacheService initialization."""
        assert self.cache is not None

    def test_get_offline(self):
        """Test get method when Redis is not available."""
        result = self.cache.get("test_key")
        assert result is None

    def test_set_offline(self):
        """Test set method when Redis is not available."""
        # Should not raise exception
        self.cache.set("test_key", {"data": "value"}, ttl=3600)

    def test_get_with_mock_redis(self):
        """Test get method with mocked Redis."""
        with patch.object(self.cache, 'redis') as mock_redis:
            mock_redis.get.return_value = '{"data": "value"}'
            
            result = self.cache.get("test_key")
            assert result == {"data": "value"}

    def test_set_with_mock_redis(self):
        """Test set method with mocked Redis."""
        with patch.object(self.cache, 'redis') as mock_redis:
            mock_redis.set.return_value = True
            
            self.cache.set("test_key", {"data": "value"}, ttl=3600)
            mock_redis.set.assert_called_once()

    def test_get_json_parse_error(self):
        """Test get method with invalid JSON."""
        with patch.object(self.cache, 'redis') as mock_redis:
            mock_redis.get.return_value = "invalid json"
            
            result = self.cache.get("test_key")
            assert result is None
