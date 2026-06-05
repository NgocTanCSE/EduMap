import chromadb
import os
import google.generativeai as genai
from typing import List, Dict

class VectorStoreService:
    def __init__(self):
        # Use persistent storage for production/staging
        db_path = os.getenv("CHROMA_DB_PATH", "./chroma_db")
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_or_create_collection(name="edumap_docs")
        
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key and not self.api_key.startswith("AIzaSy_placeholder"):
            genai.configure(api_key=self.api_key)
            self.has_api = True
        else:
            self.has_api = False
            # Seed some data for local dev if empty
            if self.collection.count() == 0:
                self._seed_mock_data()

    def _seed_mock_data(self):
        docs = [
            "Học bổng EduMap Talent có giá trị 50 triệu đồng dành cho sinh viên xuất sắc khối ngành CNTT.",
            "Phòng STEM Lab tại cơ sở Quận 1 mở cửa từ 8:00 sáng đến 5:00 chiều các ngày trong tuần.",
            "Lộ trình học Backend Developer cần tối thiểu 6 tháng, bắt buộc phải học Database (SQL) trước khi học API."
        ]
        ids = ["doc_scholarship_01", "doc_stemlab_01", "doc_roadmap_01"]
        metadatas = [{"title": "Quy chế học bổng"}, {"title": "Lịch hoạt động STEM"}, {"title": "Lộ trình Backend"}]
        
        # Use text-based add if no API key for embeddings
        self.collection.add(
            documents=docs,
            metadatas=metadatas,
            ids=ids
        )

    def get_embedding(self, text: str) -> List[float]:
        if not self.has_api:
            return [0.1] * 768 
            
        result = genai.embed_content(
            model="models/embedding-001",
            content=text,
            task_type="retrieval_document"
        )
        return result['embedding']

    def add_documents(self, documents: List[str], metadatas: List[Dict], ids: List[str]):
        if self.has_api:
            embeddings = [self.get_embedding(doc) for doc in documents]
            self.collection.add(documents=documents, embeddings=embeddings, metadatas=metadatas, ids=ids)
        else:
            self.collection.add(documents=documents, metadatas=metadatas, ids=ids)

    def query(self, query_text: str, n_results: int = 3):
        if self.has_api:
            query_embedding = self.get_embedding(query_text)
            return self.collection.query(query_embeddings=[query_embedding], n_results=n_results)
        else:
            return self.collection.query(query_texts=[query_text], n_results=n_results)

    def search_similar(self, query: str, top_k: int = 2) -> list:
        results = self.query(query, n_results=top_k)
        found_docs = []
        if results and results['documents'] and len(results['documents'][0]) > 0:
            for i in range(len(results['documents'][0])):
                found_docs.append({
                    "doc_id": results['ids'][0][i],
                    "title": results['metadatas'][0][i].get('title', 'N/A'),
                    "snippet": results['documents'][0][i]
                })
        return found_docs

vector_store = VectorStoreService()
