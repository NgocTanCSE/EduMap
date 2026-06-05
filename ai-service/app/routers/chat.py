from fastapi import APIRouter
from models.chat_models import ChatRequest, ChatResponse
from services.llm_service import LLMService

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    llm_service = LLMService() # Instantiate LLMService
    
    # For now, context_docs is empty. This will be populated by vector_store later.
    context_docs = [] 
    
    # The updated chat_with_rag now returns a ChatResponse object directly
    response_obj = await llm_service.chat_with_rag(request, context_docs=context_docs)

    # Defensive Programming: Ensure response_obj is a ChatResponse object
    if not isinstance(response_obj, ChatResponse):
        print(f"Warning: chat_with_rag returned non-ChatResponse: {response_obj}")
        return ChatResponse(reply="An unexpected error occurred in AI processing.", sources=[])

    return response_obj
