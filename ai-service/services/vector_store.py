import os
try:
    import chromadb
except ImportError:
    chromadb = None
from typing import List, Dict
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

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

        # OpenAI-compatible embeddings (OpenRouter)
        self.api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("XTROUTER_API_KEY")
        self.embedding_model = os.getenv("OPENROUTER_EMBEDDING_MODEL")
        if self.api_key and OpenAI is not None:
            try:
                self.openai_client = OpenAI(
                    api_key=self.api_key,
                    base_url=os.getenv("OPENROUTER_API_BASE_URL", "https://openrouter.ai/api/v1"),
                )
                self.has_api = True
            except Exception as e:
                print(f"Warning: Failed to initialize embeddings client: {e}")
                self.has_api = False
        else:
            self.has_api = False
            if not self.api_key:
                print("WARNING: Vector store without embeddings. Set OPENROUTER_API_KEY (sk-or-...) for semantic search.")
            elif OpenAI is None:
                print("WARNING: 'openai' package not installed. Semantic search unavailable.")
            if not self.embedding_model:
                print("WARNING: OPENROUTER_EMBEDDING_MODEL is not set. Set an OpenAI-compatible embedding model for semantic search.")

    def get_embedding(self, text: str) -> List[float]:
        if not self.has_api:
            raise RuntimeError("Embedding service chưa sẵn sàng. Cấu hình OPENROUTER_API_KEY + OPENROUTER_API_BASE_URL + OPENROUTER_EMBEDDING_MODEL để dùng semantic search.")
        if not self.embedding_model:
            raise RuntimeError("Chưa cấu hình OPENROUTER_EMBEDDING_MODEL. Semantic search cần model embedding.")
        try:
            result = self.openai_client.embeddings.create(model=self.embedding_model, input=text)
            return result.data[0].embedding
        except Exception as e:
            print(f"Error getting embedding: {e}")
            raise RuntimeError(f"Error getting embedding: {e}")

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
            raise

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
            raise

vector_store = VectorStoreService()
