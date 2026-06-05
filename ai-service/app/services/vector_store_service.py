import chromadb
import os
import google.generativeai as genai
from typing import List, Dict

class VectorStoreService:
    def __init__(self):
        self.client = chromadb.PersistentClient(path="./chroma_db")
        self.collection = self.client.get_or_create_collection(name="edumap_docs")
        
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.has_api = True
        else:
            self.has_api = False

    def get_embedding(self, text: str) -> List[float]:
        if not self.has_api:
            # Fallback for dev without API key - very basic
            return [0.1] * 768 
            
        result = genai.embed_content(
            model="models/embedding-001",
            content=text,
            task_type="retrieval_document"
        )
        return result['embedding']

    def add_documents(self, documents: List[str], metadatas: List[Dict], ids: List[str]):
        embeddings = [self.get_embedding(doc) for doc in documents]
        self.collection.add(
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )

    def query(self, query_text: str, n_results: int = 3):
        query_embedding = self.get_embedding(query_text)
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
        return results

vector_store_service = VectorStoreService()
