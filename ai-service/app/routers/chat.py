from fastapi import APIRouter, HTTPException
from models.chat_models import ChatRequest, ChatResponse, SourceDocument
from app.services.llm_service import llm_service

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        # Chuyển đổi history sang dạng dictionary để LLMService dễ xử lý
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]
        
        # Gọi phương thức đã được tối ưu hóa (RAG + Anti-Hallucination)
        response_data = await llm_service.chat_with_rag(
            message=request.message, 
            history=history_dicts
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
        print(f"Chat API Router Error: {str(e)}")
        # Cấu trúc phòng thủ (Defensive Programming) khi lỗi xảy ra
        return ChatResponse(
            reply="Hệ thống AI đang bảo trì hoặc quá tải. Vui lòng thử lại sau.", 
            sources=[]
        )
