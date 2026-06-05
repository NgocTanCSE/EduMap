from fastapi import APIRouter, HTTPException
from models.chat_models import ChatRequest, ChatResponse
from services.llm_service import llm_service

router = APIRouter(prefix="/chat", tags=["1. AI RAG Chat"])

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Endpoint chat RAG chính thức.
    Sử dụng context từ vector database và lịch sử hội thoại.
    """
    try:
        # Trong tương lai, tìm kiếm context từ vector_store ở đây
        # context_docs = vector_store.search_similar(request.message)
        context_docs = []
        
        response_obj = await llm_service.chat_with_rag(request, context_docs=context_docs)

        if not isinstance(response_obj, ChatResponse):
            return ChatResponse(reply="Lỗi xử lý AI.", sources=[])

        return response_obj
    except Exception as e:
        print(f"Error in chat_endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống chat: {str(e)}")
