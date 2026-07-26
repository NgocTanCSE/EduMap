import os
try:
    import chromadb
except ImportError:
    chromadb = None
from typing import List, Dict

class VectorStoreService:
    def __init__(self):
        self.collection = None
        if chromadb is None:
            print("ChromaDB module not available. Vector store disabled.")
            return
        try:
            db_path = os.getenv("CHROMA_DB_PATH", "./chroma_db")
            self.client = chromadb.PersistentClient(path=db_path)
            self.collection = self.client.get_or_create_collection(name="edumap_docs")
            print(f"Vector store initialized at {db_path}")
        except Exception as e:
            print(f"Vector store initialization failed: {e}")
            self.collection = None

        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self.genai = genai
                self.has_api = True
            except Exception as e:
                print(f"Warning: Failed to initialize Gemini embeddings: {e}")
                self.has_api = False
        else:
            self.has_api = False
            print("WARNING: Vector store without embeddings. Set GEMINI_API_KEY for semantic search.")

    def get_embedding(self, text: str) -> List[float]:
        if not self.has_api:
            return [0.1] * 768
        try:
            result = self.genai.embed_content(
                model="models/embedding-001",
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            print(f"Error getting embedding: {e}")
            return [0.1] * 768

    def add_documents(self, documents: List[str], metadatas: List[Dict], ids: List[str]):
        try:
            if self.has_api:
                embeddings = [self.get_embedding(doc) for doc in documents]
                self.collection.add(documents=documents, embeddings=embeddings, metadatas=metadatas, ids=ids)
            else:
                self.collection.add(documents=documents, metadatas=metadatas, ids=ids)
        except Exception as e:
            print(f"Error adding documents to vector store: {e}")
            raise

    def query(self, query_text: str, n_results: int = 3):
        try:
            if self.has_api:
                query_embedding = self.get_embedding(query_text)
                return self.collection.query(query_embeddings=[query_embedding], n_results=n_results)
            else:
                return self.collection.query(query_texts=[query_text], n_results=n_results)
        except Exception as e:
            print(f"Error querying vector store: {e}")
            return {'documents': [[]], 'metadatas': [[]], 'ids': [[]]}

    def search_similar(self, query: str, top_k: int = 2) -> list:
        try:
            results = self.query(query, n_results=top_k)
            found_docs = []
            if results and results.get('documents') and len(results['documents'][0]) > 0:
                for i in range(len(results['documents'][0])):
                    found_docs.append({
                        "doc_id": results['ids'][0][i] if i < len(results['ids'][0]) else str(i),
                        "title": results['metadatas'][0][i].get('title', 'N/A') if i < len(results['metadatas'][0]) else 'N/A',
                        "snippet": results['documents'][0][i]
                    })
            return found_docs
        except Exception as e:
            print(f"Error in search_similar: {e}")
            return []

vector_store = VectorStoreService()
