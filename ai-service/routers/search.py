from fastapi import APIRouter, HTTPException
from services.vector_store import vector_store

router = APIRouter(prefix="/api/ai/search", tags=["3. Semantic Search"])

@router.get("/")
async def semantic_search(q: str, limit: int = 5):
    try:
        if vector_store is None or vector_store.collection is None:
            return {"status": "success", "message": "Tìm kiếm tạm thời không khả dụng.", "data": []}
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
        return {"status": "error", "message": "Lỗi khi tìm kiếm ngữ nghĩa.", "data": []}
