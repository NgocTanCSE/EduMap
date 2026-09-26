import os
import json
import urllib.request
import urllib.error
from typing import List, Dict

try:
    import chromadb
except ImportError:
    chromadb = None


class VectorStoreService:
    """Semantic search. Chat + EMBEDDING deu qua GOOGLE GEMINI (1 key: GEMINI_API_KEY).

    - Chat (LLM)  -> Google Gemini  : GEMINI_API_KEY / GEMINI_MODEL (gemini-3.8-flash)
    - Embedding   -> Google Gemini : GEMINI_API_KEY / GEMINI_EMBEDDING_MODEL (gemini-embedding-001)
    """

    def __init__(self):
        # --- Gemini Embedding config (always set; independent of ChromaDB) ---
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.embed_models = [m.strip() for m in os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001,text-embedding-004").split(",") if m.strip()]
        self.embedding_model = self.embed_models[0] if self.embed_models else "gemini-embedding-001"
        self.has_api = bool(self.gemini_key)
        if not self.gemini_key:
            print("WARNING: Vector store without embeddings. Set GEMINI_API_KEY (Google) for semantic search.")
        if not os.getenv("GEMINI_EMBEDDING_MODEL"):
            print("WARNING: GEMINI_EMBEDDING_MODEL not set -> default gemini-embedding-001")

        # --- ChromaDB collection (optional; not required for get_embedding) ---
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

    def get_embedding(self, text: str) -> List[float]:
        if not self.has_api:
            raise RuntimeError("Embedding service chưa sẵn sàng. Cấu hình GEMINI_API_KEY + GEMINI_EMBEDDING_MODEL để dùng semantic search.")
        if not text:
            return []

        last_err = None
        for model in self.embed_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={self.gemini_key}"
            payload = json.dumps({"model": model, "content": {"parts": [{"text": text}]}}).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", "ignore")[:300]
                low = body.lower()
                if e.code == 404 or "not found" in low or "not supported" in low or "no longer available" in low:
                    last_err = f"{model}: HTTP {e.code} {body[:120]}"; print(f"Gemini embed model {model} khong kha dung, thu ke tiep..."); continue
                if e.code in (401, 403):
                    raise RuntimeError(f"Google Gemini auth loi (HTTP {e.code}): {body[:200]}")
                raise RuntimeError(f"Error getting embedding (HTTP {e.code}): {body}")
            except Exception as e:
                raise RuntimeError(f"Error getting embedding: {e}")
            if "error" in data:
                err = data["error"]; code = err.get("code"); msg = err.get("message",""); mlow = msg.lower()
                if code == 404 or "not found" in mlow or "not supported" in mlow or "no longer available" in mlow:
                    last_err = f"{model}: {msg[:120]}"; print(f"Gemini embed model {model} khong kha dung, thu ke tiep..."); continue
                raise RuntimeError(f"Google Gemini API error: {err}")
            emb = data.get("embeddings") or data.get("embedding")
            if isinstance(emb, list):
                vec = (emb[0] if emb else {}).get("values")
            elif isinstance(emb, dict):
                vec = emb.get("values")
            else:
                vec = data.get("values")
            if vec:
                return [float(x) for x in vec]
            last_err = f"{model}: response khong co gia tri embedding"
            continue
        raise RuntimeError(f"Khong the lay embedding tu Gemini. Loi: {last_err}")

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
