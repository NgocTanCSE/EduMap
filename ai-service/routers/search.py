from fastapi import APIRouter, HTTPException
from services.vector_store import vector_store

router = APIRouter(prefix="/api/ai/search", tags=["3. Semantic Search"])

@router.get("/")
async def semantic_search(q: str, limit: int = 5):
    try:
        # ChromaDB sẽ tự động nhúng (embed) câu query 'q' và đo khoảng cách Cosine
        results = vector_store.search_similar(query=q, top_k=limit)
        
        if not results:
            return {"status": "success", "message": "Không tìm thấy tài liệu phù hợp.", "data": []}
            
        return {
            "status": "success",
            "message": f"Đã tìm thấy {len(results)} tài liệu liên quan đến '{q}'.",
            "data": results
        }
    except Exception as e:
        print(f"Lỗi Semantic Search: {str(e)}")
        raise HTTPException(status_code=500, detail="Lỗi khi tìm kiếm ngữ nghĩa.")
