from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models.chat_models import ChatRequest, ChatResponse, SourceDocument
from services.llm_service import llm_service
from services.db_service import db_service
import json
import asyncio

# NOTE: the prefix is the FULL public path, like every other router in this
# service (survey, knowledge, talk2map, …). Do NOT rely on main.py adding
# "/api/ai" for this module: that special case produced
# `POST /api/ai/chat/stream -> 404` in production because the deployed
# main.py did not apply the extra prefix. Keeping the full path here makes
# the route independent of how the router is mounted.
router = APIRouter(prefix="/api/ai/chat", tags=["1. AI RAG Chat"])

@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    # Chỉ trả về trả lời THẬT từ AI — bỏ lời nhắn "bảo trì" mẫu
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (primary) hoặc GEMINI_API_KEY.")
    try:
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]

        response_data = await llm_service.chat_with_rag(
            message=request.message,
            history=history_dicts,
            context=request.context
        )

        sources_list = []
        for src in response_data.get("sources", []):
            sources_list.append(SourceDocument(
                doc_id=src.get("doc_id", ""),
                title=src.get("title", ""),
                snippet=src.get("snippet", "")
            ))

        reply = response_data.get("reply", "Lỗi phản hồi")

        # Only save chat history when db_service is available (skipped in SQLite mode
        # where PostgreSQL is disabled — prevents 'NoneType' crash that returned 503
        # even though the LLM reply was successfully generated).
        if request.user_id and db_service is not None:
            db_service.save_chat_history(
                user_id=request.user_id,
                message=request.message,
                response=reply,
                sources=response_data.get("sources", []),
                context=request.context
            )

        return ChatResponse(reply=reply, sources=sources_list)
    except Exception as e:
        print(f"Error in chat_endpoint: {e}")
        raise HTTPException(status_code=503, detail="AI Service không khả dụng, vui lòng thử lại sau.")

@router.get("/history")
async def get_chat_history(user_id: str, limit: int = 50):
    try:
        # db_service is None in SQLite mode (PostgreSQL disabled) — gracefully return empty history
        if db_service is None:
            return {"history": []}
        history = db_service.get_chat_history(user_id, limit)
        history_data = []
        for record in history or []:
            history_data.append({
                "id": record.get("id"),
                "message": record.get("message"),
                "response": record.get("response"),
                "sources": record.get("context", {}).get("sources", []) if record.get("context") else [],
                "created_at": record.get("created_at").isoformat() if record.get("created_at") else None
            })
        return {"history": history_data}
    except Exception as e:
        print(f"Error fetching chat history: {e}")
        raise HTTPException(status_code=503, detail="Lỗi khi lấy lịch sử chat.")

@router.post("/stream")
async def chat_stream_endpoint(request: ChatRequest):
    """Chat RAG với streaming (SSE) — trả về từng token thực sự real-time.

    Sử dụng chat_with_rag_stream để nhận token từng ký tự từ Cloudflare Workers AI
    (stream=True) qua curl --ipv4 --insecure, thay thế approach cũ
    (gửi toàn bộ response rồi split thành từng từ với delay 50ms).
    """
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng.")

    async def generate_stream():
        try:
            history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]

            async for sse_chunk in llm_service.chat_with_rag_stream(
                message=request.message,
                history=history_dicts,
                context=request.context
            ):
                yield sse_chunk

            # Chat history persistence for the streaming path is handled by the
            # NestJS backend (ai.service.ts chatStream()), which reconstructs the
            # full streamed reply from the SSE chunks and saves it via the SQLite
            # historyRepo. The Python ai-service does NOT duplicate this here
            # because:
            #   1. In HF Spaces SQLite mode (DB_TYPE=sqlite), db_service is None.
            #   2. In PostgreSQL mode, the NestJS backend already persists the
            #      complete reply — saving here too would create a duplicate row
            #      with a misleading "[streamed response]" placeholder instead
            #      of the real answer.
        except Exception as e:
            print(f"Error in chat_stream: {e}")
            error_chunk = {
                "error": str(e),
                "token": "Hệ thống AI đang gặp sự cố. Vui lòng thử lại.",
                "is_final": True,
                "done": True
            }
            yield f"data: {json.dumps(error_chunk)}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/stream-simple")
async def chat_stream_simple_endpoint(request: ChatRequest):
    """Chat RAG streaming đơn giản — trả về chunks."""
    if not llm_service or not llm_service.is_ready:
        raise HTTPException(status_code=503, detail="AI Service chưa sẵn sàng.")
    try:
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]

        response_data = await llm_service.chat_with_rag(
            message=request.message,
            history=history_dicts
        )
        reply = response_data.get("reply", "")
        sources = response_data.get("sources", [])

        chunk_size = 50
        chunks = [reply[i:i+chunk_size] for i in range(0, len(reply), chunk_size)]

        async def generate_chunks():
            for i, chunk in enumerate(chunks):
                yield f"data: {json.dumps({'chunk': chunk, 'is_final': i == len(chunks) - 1})}\n\n"
                await asyncio.sleep(0.1)
            yield f"data: {json.dumps({'sources': sources, 'done': True})}\n\n"

        return StreamingResponse(
            generate_chunks(),
            media_type="text/event-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
