"""Router cho /api/ai/knowledge/* — AI Knowledge Graph (Idea #8).

Endpoints:
  GET  /api/ai/knowledge/graph                        — trả về toàn bộ graph (nodes + edges)
  POST /api/ai/knowledge/query                      — duyệt 1-degree từ một node
  POST /api/ai/knowledge/suggest-partners           — gợi ý nhà tài trợ/đối tác phù hợp
  POST /api/ai/knowledge/extract                    — NLP entity extraction (+ human-review queue)
  GET  /api/ai/knowledge/reviews                    — lấy hàng đợi NLP extraction review
  POST /api/ai/knowledge/reviews/{id}/approve       — duyệt một extraction

AGENTS.md rules:
  - Graph lớn → subgraph query (1-degree only).
  - NLP extraction sai → human review queue (kg_extraction_review).
  - RAG failure / LLM unavailable → graceful degradation (rule-based extraction).
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/api/ai/knowledge", tags=["14. AI Knowledge Graph"])

# Singleton service — module-level, mirrors vector_store / cache_service pattern.
_kg = None
_kg_loaded = False


def _get_kg():
    """Lazy-load the KnowledgeGraphService singleton.
    A missing sqlite3 / unavailable DB must NOT prevent the ai-service from
    starting — the router returns 503 instead of crashing import."""
    global _kg, _kg_loaded
    if not _kg_loaded:
        try:
            from services.knowledge_graph import KnowledgeGraphService
            _kg = KnowledgeGraphService()
        except Exception as e:
            print(f"[knowledge] Service init failed: {e}")
            _kg = None
        _kg_loaded = True
    return _kg


class GraphQueryRequest(BaseModel):
    """Duyệt knowledge graph từ một node (1-degree traversal).

    Risks: graph lớn → chỉ duyệt 1-degree (depth clamped to 1 server-side).
    """
    node_id: str = Field(..., description="ID của node bắt đầu (kg_nodes.id)")
    edge_types: Optional[List[str]] = Field(
        default=None,
        description="Chỉ duyệt các loại edge này (nếu rỗng = tất cả)"
    )
    depth: Optional[int] = Field(default=1, ge=1, le=2, description="Độ sâu duyệt (được clamp về 1 trên server)")
    limit: Optional[int] = Field(default=50, ge=1, le=200, description="Số node hàng xóm tối đa")


class SuggestPartnersRequest(BaseModel):
    query: str = Field(default="", description="Câu hỏi / mô tả nhu cầu (ví dụ: 'học bổng Hàn Quốc')")
    limit: Optional[int] = Field(default=10, ge=1, le=50)
    focus_type: Optional[str] = Field(default=None, description="Lọc theo loại node (ví dụ: 'sponsor')")


class ExtractRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Văn bản cần trích xuất thực thể")


@router.get("/graph")
async def get_graph(
    node_types: Optional[str] = Query(
        default=None,
        description="Comma-separated node types to include (e.g. 'school,scholarship,sponsor')"
    ),
    limit: int = Query(default=500, ge=1, le=1000),
):
    """GET /api/ai/knowledge/graph

    Trả về toàn bộ knowledge graph dưới dạng {nodes, edges, meta}.

    Dữ liệu nguồn: các bảng SQLite đã seed (map_points, scholarships,
    opportunities, career_paths, ...). Graph được xây dựng bởi
    KnowledgeGraphService.seed_graph() — chạy tự động đầu tiên hoặc qua
    POST /api/ai/knowledge/seed.
    """
    kg = _get_kg()
    if kg is None:
        raise HTTPException(status_code=503, detail="Knowledge graph service chưa sẵn sàng.")
    try:
        types_list = None
        if node_types:
            types_list = [t.strip() for t in node_types.split(",") if t.strip()]
        return kg.get_graph(node_types=types_list, limit=limit)
    except Exception as e:
        print(f"[knowledge] get_graph error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi lấy knowledge graph: {str(e)}")


@router.post("/query")
async def query_graph(data: GraphQueryRequest):
    """POST /api/ai/knowledge/query

    Duyệt knowledge graph **1-degree** từ một node, trả về node bắt đầu,
    các node hàng xóm (neighbors) và các edge kết nối.

    Depth luôn bị clamp về 1 ở server-side để tránh query lớn trên HF Spaces
    (xem Risks trong Idea #8: 'Graph lớn → subgraph query (1-degree only)').
    """
    kg = _get_kg()
    if kg is None:
        raise HTTPException(status_code=503, detail="Knowledge graph service chưa sẵn sàng.")
    try:
        return kg.query(
            start_node_id=data.node_id,
            edge_types=data.edge_types,
            depth=data.depth,
            limit=data.limit,
        )
    except Exception as e:
        print(f"[knowledge] query error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi query knowledge graph: {str(e)}")


@router.post("/suggest-partners")
async def suggest_partners(data: SuggestPartnersRequest):
    """POST /api/ai/knowledge/suggest-partners

    Gợi ý nhà tài trợ / đối tác phù hợp dựa trên:
      1. Graph traversal từ scholarship nodes liên quan đến query.
      2. NLP entity extraction trên query → link tới sponsor nodes.
      3. Keyword relevance scoring.

    Đây là đầu ra chính của Idea #8: 'Gợi ý tài trợ/đối tác phù hợp'.
    """
    kg = _get_kg()
    if kg is None:
        raise HTTPException(status_code=503, detail="Knowledge graph service chưa sẵn sàng.")
    try:
        results = kg.suggest_partners(data.query, limit=data.limit, focus_type=data.focus_type)
        return {"query": data.query, "focus_type": data.focus_type,
                "count": len(results), "suggestions": results}
    except Exception as e:
        print(f"[knowledge] suggest_partners error: {e}")
        # Graceful degradation: return empty list instead of 503, so the
        # frontend shows an empty state rather than crashing.
        return {"query": data.query, "focus_type": data.focus_type,
                "count": 0, "suggestions": [],
                "degraded": True, "reason": str(e)}


@router.post("/extract")
async def extract_entities(data: ExtractRequest):
    """POST /api/ai/knowledge/extract

    NLP entity extraction: trích xuất thực thể (trường học, học bổng, nhà tài
    trợ, kỹ năng, khu vực ...) từ văn bản và liên kết tới các node trong graph.

    Flow:
      1. Thử LLM (Cloudflare → Gemini) — có circuit breaker.
      2. Nếu LLM thất bại → rule-based extraction (keyword matching).
      3. Kết quả có confidence thấp hoặc degraded → lưu vào hàng đợi
         kg_extraction_review để human review (theo rule AGENTS.md).
    """
    kg = _get_kg()
    if kg is None:
        raise HTTPException(status_code=503, detail="Knowledge graph service chưa sẵn sàng.")
    try:
        result = kg.extract_entities(data.text)
        return result
    except Exception as e:
        print(f"[knowledge] extract error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi NLP extraction: {str(e)}")


@router.get("/reviews")
async def get_extraction_reviews(
    status: str = Query(default="pending", description="Trạng thái review: pending/approved/rejected"),
    limit: int = Query(default=100, ge=1, le=500),
):
    """GET /api/ai/knowledge/reviews

    Lấy hàng đợi NLP extraction chờ human review (rule AGENTS.md:
    'NLP extraction sai → human review queue').
    """
    kg = _get_kg()
    if kg is None:
        raise HTTPException(status_code=503, detail="Knowledge graph service chưa sẵn sàng.")
    try:
        return {"reviews": kg.get_extraction_reviews(status=status, limit=limit)}
    except Exception as e:
        print(f"[knowledge] get_reviews error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi lấy review queue: {str(e)}")


@router.post("/reviews/{review_id}/approve")
async def approve_extraction(review_id: str, note: Optional[str] = None):
    """POST /api/ai/knowledge/reviews/{review_id}/approve

    Đánh dấu một NLP extraction là đã được duyệt (human review action).
    """
    kg = _get_kg()
    if kg is None:
        raise HTTPException(status_code=503, detail="Knowledge graph service chưa sẵn sàng.")
    try:
        ok = kg.approve_extraction(review_id, note=note)
        if not ok:
            raise HTTPException(status_code=404, detail=f"Review {review_id} không tìm thấy.")
        return {"review_id": review_id, "status": "approved", "note": note, "ok": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[knowledge] approve error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi duyệt extraction: {str(e)}")


@router.post("/seed")
async def seed_graph(background: bool = False):
    """POST /api/ai/knowledge/seed

    Xây dựng lại knowledge graph từ các bảng SQLite nguồn (map_points,
    scholarships, opportunities, ...). Idempotent — xóa và rebuild toàn bộ
    kg_nodes / kg_edges.
    """
    kg = _get_kg()
    if kg is None:
        raise HTTPException(status_code=503, detail="Knowledge graph service chưa sẵn sẵn sàng.")
    try:
        if background:
            from fastapi import BackgroundTasks
            from services.knowledge_graph import KnowledgeGraphService
            # Run in a daemon thread so the request returns immediately
            import threading
            def _bg():
                try:
                    svc = KnowledgeGraphService()
                    svc.seed_graph()
                except Exception as e:
                    print(f"[knowledge] background seed failed: {e}")
            threading.Thread(target=_bg, daemon=True).start()
            return {"status": "processing", "message": "Seed đang chạy ngầm."}

        result = kg.seed_graph()
        return {"status": "success", **result}
    except Exception as e:
        print(f"[knowledge] seed error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi seed knowledge graph: {str(e)}")
