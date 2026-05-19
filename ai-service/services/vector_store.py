import chromadb
from chromadb.config import Settings

class VectorStoreService:
    def __init__(self):
        # Khởi tạo ChromaDB lưu trong RAM (Ephemeral) để chạy nhanh trên Local
        self.client = chromadb.EphemeralClient()
        
        # Tạo (hoặc lấy) một không gian lưu trữ tên là 'edumap_docs'
        self.collection = self.client.get_or_create_collection(name="edumap_docs")

        # Nạp sẵn một số tài liệu (Mock Data) để test RAG
        self._seed_mock_data()

    def _seed_mock_data(self):
        # Giả lập việc nhà trường upload tài liệu vào hệ thống
        docs = [
            "Học bổng EduMap Talent có giá trị 50 triệu đồng dành cho sinh viên xuất sắc khối ngành CNTT.",
            "Phòng STEM Lab tại cơ sở Quận 1 mở cửa từ 8:00 sáng đến 5:00 chiều các ngày trong tuần.",
            "Lộ trình học Backend Developer cần tối thiểu 6 tháng, bắt buộc phải học Database (SQL) trước khi học API."
        ]
        ids = ["doc_scholarship_01", "doc_stemlab_01", "doc_roadmap_01"]
        metadatas = [{"title": "Quy chế học bổng"}, {"title": "Lịch hoạt động STEM"}, {"title": "Lộ trình Backend"}]
        
        # Lưu vào ChromaDB (Chroma sẽ tự động nhúng - embedding các text này)
        self.collection.add(
            documents=docs,
            metadatas=metadatas,
            ids=ids
        )

    def search_similar(self, query: str, top_k: int = 2) -> list:
        # Tìm kiếm 2 tài liệu giống với câu hỏi của sinh viên nhất
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k
        )
        
        # Ráp kết quả lại thành dạng dễ đọc
        found_docs = []
        if results and results['documents'] and len(results['documents'][0]) > 0:
            for i in range(len(results['documents'][0])):
                found_docs.append({
                    "doc_id": results['ids'][0][i],
                    "title": results['metadatas'][0][i]['title'],
                    "snippet": results['documents'][0][i]
                })
        return found_docs
