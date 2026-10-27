"""
FastAPI router for the EduMap AI Agent (NL → GIS).

Endpoints (router prefix=/api/ai, route paths /agent/chat):
  POST /api/ai/agent/chat          — non-streaming agent reply
  POST /api/ai/agent/chat-stream   — SSE streaming agent reply (token-by-token)

Both endpoints receive:
  { "message": "Tìm khu vực cách thư viện trên 5km...", "history": [...],
    "context": {...}, "session_id": "..." }

and return / stream a ChatResponse-like payload:
  { "reply": "...", "sources": [...], "tools_used": [...], "degraded": false }
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
import json

router = APIRouter(prefix="/api/ai", tags=["9. AI Map Agent"])


class AgentChatRequest(BaseModel):
    """Request body for the map agent chat endpoints."""
    message: str = Field(..., description="Câu hỏi người dùng bằng ngôn ngữ tự nhiên")
    history: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Lịch sử trò chuyện: [{role, content}, ...]",
    )
    context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Ngữ cảnh bổ sung (session_id, vị trí người dùng...)",
    )
    session_id: Optional[str] = Field(
        default=None,
        description="ID phiên chat — được forward từ backend để gắn với session memory",
    )


@router.post("/agent/chat")
async def agent_chat(request: AgentChatRequest):
    """Non-streaming map-agent endpoint.

    Runs the full agent loop (plan → execute tools → summarise) and returns
    a single JSON payload.  Falls back gracefully when the LLM provider is
    unreachable.
    """
    try:
        from agents.map_agent import map_agent
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI Agent not initialized: {e}")

    if not map_agent:
        raise HTTPException(status_code=503, detail="AI Agent service unavailable.")

    # Run the agent loop in a worker thread (it does blocking curl subprocess
    # calls + SQLite queries).
    try:
        result = await __import__("asyncio").to_thread(
            map_agent.run_agent_loop,
            request.message,
            request.history,
        )
    except Exception as e:
        print(f"[agent_router] agent_chat error: {e}")
        raise HTTPException(status_code=503, detail=str(e))

    return {
        "reply": result.get("reply", ""),
        "sources": result.get("sources", []),
        "tools_used": result.get("tools_used", []),
        "degraded": result.get("degraded", False),
    }


@router.post("/agent/chat-stream")
async def agent_chat_stream(request: AgentChatRequest):
    """SSE streaming endpoint for the map agent.

    Yields:
      - Heartbeat (empty sources, meta=true, heartbeat=true)
      - Metadata (sources + tools_used, meta=true)
      - Token chunks (token + is_final)
      - Done chunk (done=true)
    """
    try:
        from agents.map_agent import map_agent
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI Agent not initialized: {e}")

    if not map_agent:
        raise HTTPException(status_code=503, detail="AI Agent service unavailable.")

    async def _generate():
        try:
            async for chunk in map_agent.stream_agent(
                request.message,
                request.history,
            ):
                yield chunk
        except Exception as e:
            print(f"[agent_router] stream error: {e}")
            yield f"data: {json.dumps({'error': str(e), 'done': True}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
