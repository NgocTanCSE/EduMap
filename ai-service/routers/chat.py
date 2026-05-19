from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio

router = APIRouter()

class ChatRequest(BaseModel):
    user_id: str
    query: str

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # Mo phong viec streaming cac token tu LLM
    async def generate():
        full_text = f"Day la cau tra loi cho: {request.query}. Toi dang tim kiem du lieu tu EduMap..."
        words = full_text.split()
        for word in words:
            yield f"{word} "
            await asyncio.sleep(0.1) # Gia lap do tre cua LLM

    return StreamingResponse(generate(), media_type="text/plain")

@router.post("/career/recommend")
async def career_recommend(request: dict):
    return {"recommendations": ["AI Engineer", "Sustainability Consultant"]}
