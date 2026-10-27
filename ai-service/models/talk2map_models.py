"""Pydantic models for Talk2Map NL→GIS query parsing endpoints."""
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


class Talk2MapQueryRequest(BaseModel):
    """Incoming Vietnamese natural-language query."""
    text: str = Field(..., min_length=1, max_length=1000,
                      description="Câu hỏi tiếng Việt, ví dụ: 'Tìm thư viện gần trường có wifi'")


class Talk2MapQueryResponse(BaseModel):
    """Structured parse result returned to the backend / frontend."""
    status: str = "success"
    parsed_query: Dict[str, Any] = Field(default_factory=dict)
    explanation: str = Field(default="")
    degraded: bool = False
