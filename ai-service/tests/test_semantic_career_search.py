"""Unit tests for VectorStoreService.semantic_career_search().

Verifies that cosine-similarity semantic career matching returns properly
structured results with match_score, missing_skills, and field names that
match the backend CareerService.suggestCareer() output format.

Replaces the previous if-else keyword-matching approach with vector-based
similarity search via ChromaDB.
"""

import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure NO real API providers are configured before importing
for _v in [
    "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "XKIRO_API_KEY",
    "NVIDIA_API_KEY", "NIM_API_KEY",
]:
    os.environ[_v] = ""
os.environ["AI_PREFLIGHT"] = "false"


class _FakeCollection:
    """Minimal ChromaDB collection stand-in for semantic_career_search tests.

    Accepts **kwargs so it is compatible with query()'s where/hybrid_compose
    parameters regardless of call signature.
    """

    def __init__(self, query_result, collection_count=None):
        self._result = query_result
        self._count = collection_count if collection_count is not None else (
            len(query_result.get("documents", [[]])[0]) if query_result else 0
        )

    def query(self, **kwargs):
        return self._result

    def count(self):
        return self._count


def _make_vector_store():
    """Create a VectorStoreService without running __init__ (no chromadb needed)."""
    from services.vector_store import VectorStoreService
    svc = object.__new__(VectorStoreService)
    svc._embed_dim = None
    svc._embed_cache = {}
    svc._embed_cache_meta = {}
    svc._embed_cache_max = 128
    svc._embed_cache_ttl = 1800.0
    svc.has_api = False  # disable real embedding by default
    svc.has_gemini_api = False
    svc.has_cf_api = False
    svc._gemini_embed_down_until = 0.0
    svc._cf_embed_down_until = 0.0
    svc.embed_global_timeout = 6.0
    svc.embed_provider_timeout = 4.0
    # Local embedding + reranker attributes (disabled = True in tests to avoid
    # loading sentence_transformers/CrossEncoder which aren't installed locally)
    svc.local_embedding_disabled = True
    svc._local_embedder = None
    svc._local_embedder_failed = False
    svc._local_embedder_loaded = False
    svc.local_embed_dim = 768
    svc.local_reranker_disabled = True
    svc._local_reranker = None
    svc._local_reranker_failed = False
    svc._local_reranker_loaded = False
    return svc


def test_semantic_career_search_returns_structured_results():
    """semantic_career_search should return career paths with match_score,
    missing_skills, and field names matching the backend output format."""
    query_result = {
        "documents": [[
            "Lộ trình AI Engineer: Python, Machine Learning, Data Science",
            "Lộ trình Fullstack Developer: HTML, CSS, JavaScript, React, Node.js",
        ]],
        "metadatas": [[
            {"title": "AI Engineer", "category": "career", "field": "CNTT",
             "skills_required": '["Python","Machine Learning","Statistics"]'},
            {"title": "Fullstack Developer", "category": "career", "field": "CNTT",
             "skills_required": '["JavaScript","React","Node.js","TypeScript"]'},
        ]],
        "ids": [["career_1", "career_2"]],
        "distances": [[0.15, 0.30]],
    }

    svc = _make_vector_store()
    svc.collection = _FakeCollection(query_result, collection_count=2)
    svc.has_api = False  # use raw text query (no embedding)

    results = svc.semantic_career_search(
        skills=["python", "machine learning"],
        n_results=3,
    )

    assert isinstance(results, list)
    assert len(results) == 2

    first = results[0]
    assert first["title"] == "AI Engineer"
    assert first["category"] == "career"
    assert isinstance(first["match_score"], int)
    assert first["match_score"] > 0
    # Matched skills: python, machine learning → both present
    assert "python" in [s.lower() for s in first["matched_skills"]]
    # Missing: statistics not in user's skills
    assert "statistics" in [s.lower() for s in first["missing_skills"]]

    second = results[1]
    assert second["title"] == "Fullstack Developer"
    assert isinstance(second["match_score"], int)
    assert second["match_score"] > 0

    print("✓ test_semantic_career_search_returns_structured_results")


def test_semantic_career_search_filters_non_career_docs():
    """Should only return documents where metadata category == 'career'."""
    query_result = {
        "documents": [[
            "Career doc text",
            "Scholarship doc text (should be filtered out)",
            "Location doc text (should be filtered out)",
        ]],
        "metadatas": [[
            {"title": "AI Engineer", "category": "career",
             "skills_required": '["Python"]'},
            {"title": "Scholarship XYZ", "category": "scholarship"},
            {"title": "Campus Library", "category": "facility"},
        ]],
        "ids": [["career_1", "scholarship_1", "facility_1"]],
        "distances": [[0.10, 0.20, 0.25]],
    }

    svc = _make_vector_store()
    svc.collection = _FakeCollection(query_result, collection_count=3)

    results = svc.semantic_career_search(skills=["python"], n_results=5)

    # Only the career category doc should be returned
    assert len(results) == 1
    assert results[0]["title"] == "AI Engineer"
    print("✓ test_semantic_career_search_filters_non_career_docs")


def test_semantic_career_search_returns_empty_when_no_collection():
    """Should return empty list (not raise) when ChromaDB collection is None."""
    svc = _make_vector_store()
    svc.collection = None

    results = svc.semantic_career_search(skills=["python"], n_results=3)
    assert results == []
    print("✓ test_semantic_career_search_returns_empty_when_no_collection")


def test_semantic_career_search_returns_empty_when_no_skills():
    """Should return empty list when skills list is empty/blank."""
    svc = _make_vector_store()
    svc.collection = _FakeCollection(
        {"documents": [[]], "metadatas": [[]], "ids": [[]], "distances": [[]]},
        collection_count=0,
    )

    results = svc.semantic_career_search(skills=[], n_results=3)
    assert results == []
    print("✓ test_semantic_career_search_returns_empty_when_no_skills")


def test_semantic_career_search_match_score_range():
    """match_score should always be a 0-100 integer."""
    query_result = {
        "documents": [[
            "Perfect match career",
            "Partial match career",
        ]],
        "metadatas": [[
            {"title": "Perfect Match", "category": "career", "field": "IT",
             "skills_required": '["Python","React","Docker"]'},
            {"title": "Partial Match", "category": "career", "field": "IT",
             "skills_required": '["Python","React","Docker"]'},
        ]],
        "ids": [["career_1", "career_2"]],
        "distances": [[0.05, 0.55]],
    }

    svc = _make_vector_store()
    svc.collection = _FakeCollection(query_result, collection_count=2)

    user_skills = ["python", "react"]
    results = svc.semantic_career_search(skills=user_skills, n_results=3)

    for r in results:
        assert isinstance(r["match_score"], int)
        assert 0 <= r["match_score"] <= 100
    print("✓ test_semantic_career_search_match_score_range")


def test_semantic_career_search_missing_skills_correctness():
    """missing_skills should only include required skills NOT in user's input."""
    query_result = {
        "documents": [[
            "Career doc",
        ]],
        "metadatas": [[
            {"title": "Data Scientist", "category": "career", "field": "Data",
             "skills_required": '["Python","SQL","Statistics","Machine Learning"]'},
        ]],
        "ids": [["career_1"]],
        "distances": [[0.20]],
    }

    svc = _make_vector_store()
    svc.collection = _FakeCollection(query_result, collection_count=1)

    user_skills = ["python", "sql"]
    results = svc.semantic_career_search(skills=user_skills, n_results=3)

    assert len(results) == 1
    missing = [s.lower() for s in results[0]["missing_skills"]]
    # Python and SQL are present → not missing
    assert "python" not in missing
    assert "sql" not in missing
    # Statistics and Machine Learning are missing
    assert "statistics" in missing
    assert "machine learning" in missing
    print("✓ test_semantic_career_search_missing_skills_correctness")


def test_semantic_career_search_accepts_list_skills_required():
    """skills_required can arrive as a JSON list (not just a JSON string)."""
    query_result = {
        "documents": [["Career doc"]],
        "metadatas": [[
            {"title": "Backend Engineer", "category": "career", "field": "IT",
             "skills_required": ["Python", "Go", "PostgreSQL"]},
        ]],
        "ids": [["career_1"]],
        "distances": [[0.10]],
    }

    svc = _make_vector_store()
    svc.collection = _FakeCollection(query_result, collection_count=1)

    results = svc.semantic_career_search(skills=["python", "go"], n_results=3)

    assert len(results) == 1
    assert "postgresql" in [s.lower() for s in results[0]["missing_skills"]]
    print("✓ test_semantic_career_search_accepts_list_skills_required")


def test_semantic_career_search_handles_embedding_path():
    """When has_api=True, semantic_career_search should call get_embedding
    and still return structured results."""
    from services.vector_store import VectorStoreService

    svc = object.__new__(VectorStoreService)
    svc._embed_dim = 768
    svc._embed_cache = {}
    svc._embed_cache_meta = {}
    svc._embed_cache_max = 128
    svc._embed_cache_ttl = 1800.0

    embed_calls = []
    def mock_embed(text):
        embed_calls.append(text)
        return [0.1] * 768

    # Mock get_embedding directly to avoid spinning up real provider chain
    svc.get_embedding = mock_embed
    svc.has_api = True

    query_result = {
        "documents": [["Career doc"]],
        "metadatas": [[
            {"title": "AI Engineer", "category": "career", "field": "IT",
             "skills_required": '["Python"]'},
        ]],
        "ids": [["career_1"]],
        "distances": [[0.15]],
    }
    svc.collection = _FakeCollection(query_result, collection_count=1)

    results = svc.semantic_career_search(skills=["python"], n_results=3)

    assert len(embed_calls) == 1  # get_embedding called once for the combined query
    assert len(results) == 1
    assert results[0]["title"] == "AI Engineer"
    print("✓ test_semantic_career_search_handles_embedding_path")


if __name__ == "__main__":
    test_semantic_career_search_returns_structured_results()
    test_semantic_career_search_filters_non_career_docs()
    test_semantic_career_search_returns_empty_when_no_collection()
    test_semantic_career_search_returns_empty_when_no_skills()
    test_semantic_career_search_match_score_range()
    test_semantic_career_search_missing_skills_correctness()
    test_semantic_career_search_accepts_list_skills_required()
    test_semantic_career_search_handles_embedding_path()
    print("\n✅ All semantic_career_search tests passed!")
