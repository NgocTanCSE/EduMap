from fastapi import APIRouter, HTTPException
from services.vector_store import vector_store

router = APIRouter(prefix="/api/ai/search", tags=["3. Semantic Search"])

@router.get("/")
async def semantic_search(q: str, limit: int = 5):
    try:
        if vector_store is None or vector_store.collection is None:
            raise HTTPException(status_code=503, detail="Vector store chưa sẵn sàng. Hãy seed dữ liệu vào ChromaDB.")
        results = vector_store.search_similar(query=q, top_k=limit)

        # "Không tìm thấy" là kết quả thật (empty) — giữ lại; chỉ bỏ thông báo "tạm thời không khả dụng"
        if not results:
            return {"status": "success", "message": "Không tìm thấy tài liệu phù hợp.", "data": []}

        return {
            "status": "success",
            "message": f"Đã tìm thấy {len(results)} tài liệu liên quan đến '{q}'.",
            "data": results
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Lỗi Semantic Search: {str(e)}")
        raise HTTPException(status_code=503, detail="Lỗi khi tìm kiếm ngữ nghĩa.")
