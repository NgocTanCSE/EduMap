from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="EduMap AI Service")

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    sources: List[str]
    suggestions: List[str]

@app.get("/")
async def root():
    return {"message": "EduMap AI Service is running"}

@app.post("/ai/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    # This is a placeholder for LLM logic (Gemini/GPT)
    return {
        "reply": f"Đây là câu tr? l?i gi? l?p cho tin nh?n: {request.message}",
        "sources": ["https://edumap.vn/docs/1"],
        "suggestions": ["L? tr?nh h?c IT", "T?m ki?m h?c b?ng"]
    }
