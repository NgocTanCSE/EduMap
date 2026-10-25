from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from models.library_models import MaterialSummaryRequest

router = APIRouter(prefix="/api/ai/library", tags=["9. AI Library Assistant"])

class KeyConcept(BaseModel):
    concept: str
    explanation: str

class MaterialSummaryResponse(BaseModel):
    summary: str
    key_concepts: List[KeyConcept] = []
    study_tips: List[str] = []
    degraded: Optional[bool] = False
    reason: Optional[str] = None

@router.post("/summarize")
async def summarize_material(data: MaterialSummaryRequest):
    from services.llm_service import llm_service
    if not llm_service:
        raise HTTPException(status_code=503, detail="AI Service chưa được khởi tạo.")

    try:
        analysis = await llm_service.summarize_material(data)
        if analysis:
            # Pass through degraded status if present
            degraded = analysis.pop("_degraded", False) if isinstance(analysis, dict) else False
            reason = analysis.pop("_reason", None) if isinstance(analysis, dict) else None
            # Re-wrap in the Pydantic model for clean output
            key_concepts = analysis.get("key_concepts", [])
            if key_concepts and not isinstance(key_concepts[0], dict):
                key_concepts = [{"concept": str(k), "explanation": ""} for k in key_concepts]
            return MaterialSummaryResponse(
                summary=analysis.get("summary", ""),
                key_concepts=key_concepts,
                study_tips=analysis.get("study_tips", []),
                degraded=degraded,
                reason=reason,
            ).dict()
        raise HTTPException(status_code=502, detail="AI trả về kết quả tóm tắt không hợp lệ.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in summarize_material: {e}")
        raise HTTPException(status_code=502, detail=f"Lỗi tóm tắt tài liệu: {str(e)}")


# ─── Incremental Embed endpoints (auto-embed on new books / locations) ───────
# Called by the NestJS backend when a new learning material or map POI is
# created. Replaces the previous full re-sync (POST /api/ai/sync-knowledge)
# so only the single new document is embedded — keeping latency low and
# avoiding re-embedding the entire knowledge base.

class EmbedRequest(BaseModel):
    text: str = Field(..., description="Document text to embed")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata (title, category, source, ...)")
    id: str = Field(..., description="Unique document ID (e.g. 'material_123', 'location_456')")

class EmbedBatchRequest(BaseModel):
    documents: List[EmbedRequest] = Field(..., description="List of documents to embed")

class EmbedResponse(BaseModel):
    status: str
    id: str
    message: str

@router.post("/embed", response_model=EmbedResponse)
async def embed_document(req: EmbedRequest):
    """Incrementally embed a SINGLE new document (book / location) into the
    ChromaDB vector store. Fired automatically from the backend on create."""
    from services.vector_store import vector_store
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store service not initialised.")
    try:
        ok = vector_store.embed_document(req.text, req.metadata, req.id)
        if not ok:
            raise HTTPException(status_code=503, detail="Vector store collection not ready (ChromaDB may still be initialising).")
        return {"status": "ok", "id": req.id, "message": "Document embedded successfully."}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[embed] Error embedding '{req.id}': {e}")
        raise HTTPException(status_code=502, detail=f"Embed failed: {str(e)}")

@router.post("/embed-batch", response_model=Dict[str, Any])
async def embed_batch(req: EmbedBatchRequest, background_tasks: BackgroundTasks, background: bool = False):
    """Embed a batch of documents. If ``background=true`` the work runs as a
    background task and the endpoint returns immediately."""
    from services.vector_store import vector_store
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store service not initialised.")

    if background:
        def _batch_bg():
            ok_count = 0
            for d in req.documents:
                try:
                    if vector_store.embed_document(d.text, d.metadata, d.id):
                        ok_count += 1
                except Exception as ex:
                    print(f"[embed-batch BG] '{d.id}' failed: {ex}")
            print(f"[embed-batch BG] Done — {ok_count}/{len(req.documents)} embedded.")
        background_tasks.add_task(_batch_bg)
        return {"status": "processing", "count": len(req.documents), "message": "Batch embed running in background."}

    ok_count = 0
    failed = []
    for d in req.documents:
        try:
            if vector_store.embed_document(d.text, d.metadata, d.id):
                ok_count += 1
            else:
                failed.append(d.id)
        except Exception as ex:
            failed.append(d.id)
            print(f"[embed-batch] '{d.id}' failed: {ex}")
    return {"status": "success" if not failed else "partial", "count": ok_count, "failed_ids": failed}