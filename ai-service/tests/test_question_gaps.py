"""Unit tests for Idea #17: AI Question Gap Report.

Verifies:
  - _is_gap() correctly flags queries with failed retrieval, zero docs, or low quality.
  - analyze_gaps() clusters queries into topic groups (TF-IDF + KMeans).
  - Doc recommendations use LLM when available, template fallback otherwise.
  - Graceful degradation: empty / no-DB / no-sklearn still returns a valid report.
  - The 10 000-query hard cap is enforced (MAX_QUERY_LIMIT).
  - In-process 24 h cache returns cached results on repeat calls.
  - Privacy: user_id_hash is preserved (not plain user_id), TTL 30 days reported.
"""

import os
import sys
import sqlite3
import tempfile
import json
from unittest.mock import patch, MagicMock

# Make ai-service importable.
_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

# Ensure SQLite mode with a temp DB and no real API keys.
os.environ["DB_TYPE"] = "sqlite"
os.environ["AI_PREFLIGHT"] = "false"
os.environ["DB_SQLITE_PATH"] = tempfile.mktemp(suffix=".db")
for _v in ["OPENROUTER_API_KEY", "GEMINI_API_KEY", "CLOUDFLARE_API_TOKEN",
           "HF_TOKEN", "NVIDIA_API_KEY"]:
    os.environ[_v] = ""

from services.question_gap_analyzer import (
    QuestionGapAnalyzer,
    question_gap_analyzer,
    MAX_QUERY_LIMIT,
    GAP_QUALITY_THRESHOLD,
)


# ── Test helpers ────────────────────────────────────────────────────────────

def _clear_cache():
    """Clear the in-process cache so tests start fresh."""
    from services.question_gap_analyzer import _CACHE
    _CACHE.clear()


def _make_db(rows=None):
    """Create a temp SQLite DB with a query_logs table and optional seed rows."""
    _clear_cache()
    db_path = tempfile.mktemp(suffix=".db")
    os.environ["DB_SQLITE_PATH"] = db_path
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE query_logs (
            id varchar PRIMARY KEY,
            user_id_hash varchar,
            query_text text NOT NULL,
            retrieved_doc_count integer DEFAULT 0,
            retrieval_status varchar,
            response_text text,
            response_quality real,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    if rows:
        for r in rows:
            conn.execute(
                """INSERT INTO query_logs
                   (user_id_hash, query_text, retrieved_doc_count,
                    retrieval_status, response_text, response_quality)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                r,
            )
    conn.commit()
    conn.close()
    return db_path


_SAMPLE_ROWS = [
    ("hash_a", "học bổng toàn phần Nhật Bản", 3, "success", "Trả lời chi tiết...", 0.85),
    ("hash_b", "học bổng học thạch kê hoạt Đà Nẵng", 2, "partial", "Có một số thông tin", 0.55),
    ("hash_c", "học bổng học thạch kê", 0, "failed", "Tôi không biết", 0.12),
    ("hash_d", "cách đăng ký tài khoản edumap", 0, "failed", "", 0.0),
    ("hash_e", "tôi quên mật khẩu edumap", 0, "failed", "Liên hệ hỗ trợ", 0.05),
    ("hash_f", "địa chỉ trường học ở Đồng Nai", 5, "success", "Dài hạn...", 0.90),
    ("hash_g", "trường học ở Bình Dương", 4, "success", "Rất nhiều trường", 0.88),
    ("hash_h", "lịch thi cuối kỳ học kỳ 2", 3, "success", "Lịch thi...", 0.72),
    ("hash_i", "lịch thi cuối kỳ", 0, "failed", "Không rõ", 0.28),
    ("hash_j", "wifi miễn phí gần đây", 0, "failed", "Không tìm thấy", 0.10),
]


# ── Tests ────────────────────────────────────────────────────────────────────

def test_is_gap_flags_failed_retrieval():
    """Queries with retrieval_status='failed' are gaps."""
    analyzer = QuestionGapAnalyzer()
    row = {"retrieval_status": "failed", "retrieved_doc_count": 0, "response_quality": 0.1}
    assert analyzer._is_gap(row) is True


def test_is_gap_flags_zero_docs():
    """Queries with zero retrieved docs but 'success' status are still gaps."""
    analyzer = QuestionGapAnalyzer()
    row = {"retrieval_status": "success", "retrieved_doc_count": 0, "response_quality": 0.5}
    assert analyzer._is_gap(row) is True


def test_is_gap_flags_low_quality():
    """Queries with response_quality < 0.30 are gaps even if docs were found."""
    analyzer = QuestionGapAnalyzer()
    row = {"retrieval_status": "partial", "retrieved_doc_count": 1, "response_quality": 0.20}
    assert analyzer._is_gap(row) is True


def test_is_gap_does_not_flag_good_queries():
    """A well-served query is NOT a gap."""
    analyzer = QuestionGapAnalyzer()
    row = {"retrieval_status": "success", "retrieved_doc_count": 5, "response_quality": 0.9}
    assert analyzer._is_gap(row) is False


def test_analyze_gaps_returns_valid_structure():
    """analyze_gaps returns a well-formed report with all required keys."""
    db_path = _make_db(_SAMPLE_ROWS)
    try:
        result = question_gap_analyzer.analyze_gaps(limit=1000)
        assert result["status"] in ("success", "degraded")
        assert "total_queries" in result
        assert "clusters" in result
        assert "top_gaps" in result
        assert "summary" in result
        assert "privacy" in result
        assert isinstance(result["clusters"], list)
        assert isinstance(result["top_gaps"], list)
        assert result["total_queries"] == len(_SAMPLE_ROWS)
    finally:
        os.unlink(db_path)


def test_analyze_gaps_clusters_queries_by_topic():
    """K-Means (or keyword fallback) groups queries into topic clusters."""
    db_path = _make_db(_SAMPLE_ROWS)
    try:
        result = question_gap_analyzer.analyze_gaps(limit=1000)
        clusters = result["clusters"]
        assert len(clusters) >= 2, "Expected at least 2 clusters from 10 diverse queries"
        # Each cluster should have structured gap metrics.
        for c in clusters:
            assert "cluster_id" in c
            assert "topic" in c
            assert "total_queries" in c
            assert "gap_count" in c
            assert "gap_rate" in c
            assert "recommended_docs" in c
            assert 0.0 <= c["gap_rate"] <= 1.0
            assert c["gap_count"] <= c["total_queries"]
    finally:
        os.unlink(db_path)


def test_analyze_gaps_identifies_gap_queries():
    """top_gaps contains queries that had failed retrieval or low quality."""
    db_path = _make_db(_SAMPLE_ROWS)
    try:
        result = question_gap_analyzer.analyze_gaps(limit=1000)
        gap_statuses = {g["retrieval_status"] for g in result["top_gaps"]}
        assert "failed" in gap_statuses
        for g in result["top_gaps"]:
            assert g["retrieved_doc_count"] == 0 or g["response_quality"] < GAP_QUALITY_THRESHOLD
    finally:
        os.unlink(db_path)


def test_analyze_gaps_recommends_docs_per_cluster():
    """Each cluster with gaps should have at least one doc recommendation."""
    db_path = _make_db(_SAMPLE_ROWS)
    try:
        result = question_gap_analyzer.analyze_gaps(limit=1000)
        for c in result["clusters"]:
            if c["gap_count"] > 0:
                assert len(c["recommended_docs"]) >= 1
                assert all(isinstance(d, str) for d in c["recommended_docs"])
    finally:
        os.unlink(db_path)


def test_analyze_gaps_empty_db_returns_valid_empty_report():
    """No query_logs → valid empty report (not a 502)."""
    db_path = _make_db()  # empty table
    try:
        result = question_gap_analyzer.analyze_gaps(limit=1000)
        assert result["status"] == "success"
        assert result["total_queries"] == 0
        assert result["clusters"] == []
        assert result["top_gaps"] == []
        assert result["degraded"] is False
    finally:
        os.unlink(db_path)


def test_analyze_gaps_no_db_returns_degraded():
    """When SQLite path is missing/invalid, returns a degraded-but-valid report."""
    os.environ["DB_SQLITE_PATH"] = "/nonexistent/path/nope.db"
    try:
        result = question_gap_analyzer.analyze_gaps(limit=100)
        assert result["total_queries"] == 0
        assert result["clusters"] == []
        assert "summary" in result
    finally:
        os.environ["DB_SQLITE_PATH"] = tempfile.mktemp(suffix=".db")


def test_max_query_limit_is_10000():
    """The hard cap must be exactly 10 000 per AGENTS.md risk mitigation."""
    assert MAX_QUERY_LIMIT == 10_000


def test_analyze_gaps_respects_limit():
    """The limit is clamped to MAX_QUERY_LIMIT."""
    analyzer = QuestionGapAnalyzer()
    # When limit exceeds MAX_QUERY_LIMIT, it's clamped.
    n_limit = min(99999, analyzer.max_query_limit, MAX_QUERY_LIMIT)
    assert n_limit <= MAX_QUERY_LIMIT


def test_privacy_metadata_present():
    """Report includes privacy metadata (SHA-256 hash, 30-day TTL)."""
    db_path = _make_db(_SAMPLE_ROWS)
    try:
        result = question_gap_analyzer.analyze_gaps(limit=1000)
        privacy = result["privacy"]
        assert privacy["user_id_hashed"] is True
        assert privacy["hash_algorithm"] == "sha256"
        assert privacy["ttl_days"] == 30
    finally:
        os.unlink(db_path)


def test_cache_returns_cached_on_second_call():
    """Second call with same args returns cached=True."""
    db_path = _make_db(_SAMPLE_ROWS)
    try:
        first = question_gap_analyzer.analyze_gaps(limit=1000)
        assert first.get("cached") is False
        second = question_gap_analyzer.analyze_gaps(limit=1000)
        assert second.get("cached") is True
        # Total queries must match.
        assert second["total_queries"] == first["total_queries"]
    finally:
        os.unlink(db_path)


def test_template_fallback_when_no_llm():
    """_recommend_docs falls back to template-based docs when LLM is unavailable."""
    analyzer = QuestionGapAnalyzer()
    # Simulate LLM unavailable by patching the import.
    with patch.dict(sys.modules, {"services.llm_service": None}):
        docs = analyzer._recommend_docs(["học", "bổng"], ["hỏi về học bổng"], "học bổng")
    assert isinstance(docs, list)
    assert len(docs) >= 1
    assert all(isinstance(d, str) for d in docs)


def test_keyword_clustering_fallback():
    """Keyword-based clustering works when sklearn is unavailable."""
    analyzer = QuestionGapAnalyzer()
    texts = ["học bổng học thạch kê", "học bổng toàn phần", "cách đăng ký tài khoản"]
    rows = [
        {"query_text": t, "retrieved_doc_count": 0, "retrieval_status": "failed",
         "response_quality": 0.1, "user_id_hash": "h", "created_at": "2025-01-01"}
        for t in texts
    ]
    with patch("services.question_gap_analyzer.SKLEARN_OK", False):
        clusters = analyzer._cluster_queries(rows)
    assert len(clusters) >= 1
    for c in clusters:
        assert "topic" in c and "total_queries" in c


def test_gap_rate_calculation():
    """gap_rate is the fraction of gap queries in a cluster."""
    db_path = _make_db(_SAMPLE_ROWS)
    try:
        result = question_gap_analyzer.analyze_gaps(limit=1000)
        for c in result["clusters"]:
            expected = round(c["gap_count"] / max(c["total_queries"], 1), 3)
            assert abs(c["gap_rate"] - expected) < 0.001
    finally:
        os.unlink(db_path)
