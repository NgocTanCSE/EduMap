from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models.chat_models import ChatRequest, ChatResponse, SourceDocument
from services.llm_service import llm_service
import json
import asyncio

router = APIRouter(prefix="/chat", tags=["1. AI RAG Chat"])

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Endpoint chat RAG chính thức.
    Sử dụng context từ vector database và lịch sử hội thoại.
    """
    try:
        # Chuyển đổi history sang dạng dictionary để LLMService dễ xử lý
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]
        
        # Gọi phương thức đã được tối ưu hóa (RAG + Anti-Hallucination)
        response_data = await llm_service.chat_with_rag(
            message=request.message, 
            history=history_dicts,
            context=request.context
        )
        
        # Mapping dữ liệu sources từ dạng dict sang model Pydantic
        sources_list = []
        for src in response_data.get("sources", []):
            sources_list.append(SourceDocument(
                doc_id=src.get("doc_id", ""),
                title=src.get("title", ""),
                snippet=src.get("snippet", "")
            ))

        return ChatResponse(
            reply=response_data.get("reply", "Lỗi phản hồi"),
            sources=sources_list
        )
    except Exception as e:
        print(f"Error in chat_endpoint: {e}")
        # Cấu trúc phòng thủ (Defensive Programming) khi lỗi xảy ra
        return ChatResponse(
            reply="Hệ thống AI đang bảo trì hoặc quá tải. Vui lòng thử lại sau.", 
            sources=[]
        )

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
