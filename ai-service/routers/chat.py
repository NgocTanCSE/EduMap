from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models.chat_models import ChatRequest, ChatResponse, SourceDocument
from services.llm_service import llm_service
from services.db_service import db_service
import json
import asyncio

router = APIRouter(prefix="/chat", tags=["1. AI RAG Chat"])

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
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
        
        if request.user_id:
            db_service.save_chat_history(
                user_id=request.user_id,
                message=request.message,
                response=reply,
                sources=response_data.get("sources", []),
                context=request.context
            )
        
        return ChatResponse(
            reply=reply,
            sources=sources_list
        )
    except Exception as e:
        print(f"Error in chat_endpoint: {e}")
        return ChatResponse(
            reply="Hệ thống AI đang bảo trì hoặc quá tải. Vui lòng thử lại sau.", 
            sources=[]
        )

@router.get("/history")
async def get_chat_history(user_id: str, limit: int = 50):
    try:
        history = db_service.get_chat_history(user_id, limit)
        history_data = []
        for record in history:
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
        raise HTTPException(status_code=500, detail="Lỗi khi lấy lịch sử chat.")

@router.post("/stream")
async def chat_stream_endpoint(request: ChatRequest):
    """
    Endpoint chat RAG với streaming response (Server-Sent Events).
    Trả về từng token một để hiển thị real-time.
    """
    async def generate_stream():
        try:
            # Chuyển đổi history sang dạng dictionary
            history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]
            
            # Simulate streaming response
            # Trong thực tế, sẽ gọi Gemini API với stream=True
            full_response = await llm_service.chat_with_rag(
                message=request.message,
                history=history_dicts
            )
            
            reply = full_response.get("reply", "")
            sources = full_response.get("sources", [])
            
            # Streaming từng token (giả lập)
            words = reply.split()
            for i, word in enumerate(words):
                chunk = {
                    "token": word + " ",
                    "is_final": i == len(words) - 1,
                    "sources": sources if i == len(words) - 1 else []
                }
                yield f"data: {json.dumps(chunk)}\n\n"
                await asyncio.sleep(0.05)  # Giả lập delay giữa các token
            
            # Gửi sự kiện hoàn thành
            yield f"data: {json.dumps({'done': True})}\n\n"
            
        except Exception as e:
            error_chunk = {
                "error": str(e),
                "token": "Hệ thống AI đang gặp sự cố. Vui lòng thử lại.",
                "is_final": True
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
    """
    Endpoint chat RAG với streaming response đơn giản hơn.
    Trả về toàn bộ response nhưng chia thành chunks.
    """
    try:
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]
        
        response_data = await llm_service.chat_with_rag(
            message=request.message,
            history=history_dicts
        )
        
        reply = response_data.get("reply", "")
        sources = response_data.get("sources", [])
        
        # Chia response thành chunks
        chunk_size = 50
        chunks = [reply[i:i+chunk_size] for i in range(0, len(reply), chunk_size)]
        
        async def generate_chunks():
            for i, chunk in enumerate(chunks):
                yield f"data: {json.dumps({'chunk': chunk, 'is_final': i == len(chunks) - 1})}\n\n"
                await asyncio.sleep(0.1)
            
            # Gửi sources ở cuối
            yield f"data: {json.dumps({'sources': sources, 'done': True})}\n\n"
        
        return StreamingResponse(
            generate_chunks(),
            media_type="text/event-stream"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
