from pydantic import BaseModel
from typing import Optional, List, Dict

class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 10
    filters: Optional[Dict] = None

class SearchResult(BaseModel):
    doc_id: str
    title: str
    snippet: str
    score: Optional[float] = None
    metadata: Optional[Dict] = None

class SearchResponse(BaseModel):
    status: str
    results: List[SearchResult]
    total: int
    query: str
