import pytest
from unittest.mock import Mock, patch, MagicMock
from services.vector_store import VectorStore

class TestVectorStore:
    def setup_method(self):
        """Set up test fixtures."""
        self.store = VectorStore()

    def test_init(self):
        """Test VectorStore initialization."""
        assert self.store is not None
        assert hasattr(self.store, 'client')
        assert hasattr(self.store, 'collection')

    def test_add_documents(self):
        """Test add_documents method."""
        documents = [
            {"id": "doc1", "text": "Python programming", "metadata": {"topic": "programming"}},
            {"id": "doc2", "text": "Machine learning basics", "metadata": {"topic": "ai"}}
        ]
        
        # Mock the collection method
        with patch.object(self.store.collection, 'add') as mock_add:
            self.store.add_documents(documents)
            mock_add.assert_called_once()

    def test_search_similar(self):
        """Test search_similar method."""
        query = "Python programming"
        
        # Mock the query method
        mock_results = {
            "documents": [["Python basics", "Advanced Python"]],
            "metadatas": [[{"topic": "programming"}, {"topic": "programming"}]],
            "ids": [["doc1", "doc2"]]
        }
        
        with patch.object(self.store.collection, 'query', return_value=mock_results):
            results = self.store.search_similar(query, limit=2)
            assert results is not None
            assert len(results) == 2

    def test_search_similar_empty(self):
        """Test search_similar with empty results."""
        query = "nonexistent topic"
        
        mock_results = {
            "documents": [[]],
            "metadatas": [[]],
            "ids": [[]]
        }
        
        with patch.object(self.store.collection, 'query', return_value=mock_results):
            results = self.store.search_similar(query)
            assert results is not None
            assert len(results) == 0
