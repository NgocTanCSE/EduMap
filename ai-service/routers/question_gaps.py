"""Router for /api/ai/analytics/question-gaps — Idea #17: AI Question Gap Report.

Exposes a single GET endpoint that clusters anonymized ``query_logs`` and
identifies knowledge gaps:

* ``GET /api/ai/analytics/question-gaps?limit=10000`` — returns a
  topic-clustered gap report.

The heavy work (SQLite read + TF-IDF clustering) runs in the
``QuestionGapAnalyzer`` singleton service.  Results are cached 24 h
in-process (HF Spaces has no Redis).  The endpoint never 502s: on
failure it returns ``degraded=true`` with empty clusters.

Privacy / risk compliance (per AGENTS.md):
  * query_logs stores SHA-256 hashed user_id — never plain text.
  * Clustering is capped at 10 000 queries to stay within timeouts.
  * TTL 30 days on query_logs rows (enforced in sqlite-bootstrap.ts).
"""

from fastapi import APIRouter, Query
from typing import Optional
import asyncio
import logging
from datetime import date as _date

logger = logging.getLogger("question_gaps")

router = APIRouter(prefix="/api/ai/analytics", tags=["17. AI Question Gap Report"])


@router.get("/question-gaps", response_model=None)
async def get_question_gaps(
    limit: Optional[int] = Query(
        default=None, ge=1, le=10000,
        description="Số lượng truy vấn tối đa phân tích (tối đa 10000, mặc định 10000)",
    ),
):
    """GET /api/ai/analytics/question-gaps — AI Question Gap Report (Idea #17).

    **AI thực hiện:**
      1. Đọc truy vấn ẩn danh từ bảng ``query_logs`` (giới hạn 10 000).
      2. Cluster truy vấn bằng TF-IDF + K-Means (hoặc fallback keyword).
      3. Xác định gaps: truy vấn không retrieval được tài liệu, hoặc
         chất lượng phản hồi thấp (< 0.30).
      4. Đề xuất tài liệu bổ trợ cho mỗi cụm chủ đề bằng LLM (có fallback template).

    **Dữ liệu:** query_logs (anonymized — user_id_hash SHA-256, TTL 30 ngày).

    **Đầu ra:** Báo cáo khoảng trống tri thức theo chủ đề.

    Trả về ``degraded=true`` khi không có dữ liệu hoặc dịch vụ AI không
    khả dụng — frontend hiển thị empty state, không bao giờ báo lỗi 502.
    """
    try:
        # The clustering + SQLite read is CPU/IO-bound; run in a worker
        # thread so the FastAPI event loop stays responsive for other
        # concurrent AI requests.
        from services.question_gap_analyzer import question_gap_analyzer
        result = await asyncio.to_thread(question_gap_analyzer.analyze_gaps, limit)
        return result
    except Exception as e:
        logger.exception(f"question-gaps endpoint error: {e}")
        # Graceful degradation — never 502.
        return {
            "status": "degraded",
            "degraded": True,
            "reason": str(e)[:200],
            "generated_at": _date.today().isoformat(),
            "total_queries": 0,
            "date_range": {"start": None, "end": None},
            "limit_applied": 10000,
            "clusters": [],
            "top_gaps": [],
            "summary": "Dịch vụ báo cáo khoảng trống tri thức tạm thời không khả dụng. Vui lòng thử lại sau.",
        }
