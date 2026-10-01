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
        # Pin the embedding dimension to the first model that successfully embeds.
        # Prevents silently falling back to a different-dim model (e.g. 768 vs 3072),
        # which would crash the existing ChromaDB collection with a dimension mismatch.
        self._embed_dim = None
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
            # Pin the embedding dimension from the already-seeded collection (if any)
            # so that get_embedding never returns a mismatched dim on the first query.
            try:
                if self.collection and self.collection.count() > 0:
                    get_res = self.collection.get(limit=1, include=["embeddings"])
                    _embs = get_res.get("embeddings") if isinstance(get_res, dict) else None
                    if _embs is not None and len(_embs) > 0:
                        self._embed_dim = len(_embs[0])
                        print(f"Collection da pin dimension = {self._embed_dim}")
            except Exception as e:
                print(f"Could not read collection dim on startup: {e}")
        except Exception as e:
            print(f"Vector store initialization failed: {e}")
            self.collection = None

    def get_embedding(self, text: str) -> List[float]:
        if not self.has_api:
            raise RuntimeError("Embedding service chưa sẵn sàng. Cấu hình GEMINI_API_KEY + GEMINI_EMBEDDING_MODEL để dùng semantic search.")
        if not text:
            return []

        import time as _time
        last_err = None
        for model in self.embed_models:
            # Retry loi tam thai (429/502/503/504) tren cung model truoc khi
            # chuyen sang model ke tiep, tranh nham chan sang model co dimension khac.
            for attempt in range(1, 3):
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={self.gemini_key}"
                payload = json.dumps({"model": model, "content": {"parts": [{"text": text}]}}).encode("utf-8")
                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
                data = None
                try:
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                except urllib.error.HTTPError as e:
                    body = e.read().decode("utf-8", "ignore")[:300]
                    low = body.lower()
                    if e.code == 404 or any(r in low for r in ("not found", "not supported", "no longer available", "model not found", "could not find")):
                        last_err = f"{model}: HTTP {e.code} {body[:120]}"; print(f"Gemini embed model {model} khong kha dung, thu model ke tiep..."); break  # next model
                    if e.code in (401, 403):
                        raise RuntimeError(f"Google Gemini auth loi (HTTP {e.code}): {body[:200]}")
                    if e.code in (429, 502, 503, 504) and attempt == 1:
                        last_err = f"{model}: HTTP {e.code} {body[:80]}"; print(f"Gemini embed model {model} {e.code} (tam thai), retry..."); _time.sleep(2.0); continue
                    last_err = f"{model}: HTTP {e.code} {body[:80]}"; print(f"Gemini embed model {model} {e.code}, chuyen model ke tiep..."); break  # next model
                except Exception as e:
                    last_err = f"{model}: {e}"
                    if attempt == 1:
                        print(f"Loi ket noi embed {model}, retry..."); _time.sleep(1.0); continue
                    print(f"Loi ket noi embed {model}, chuyen model ke tiep..."); break  # next model
                if "error" in data:
                    err = data["error"]; code = err.get("code"); msg = err.get("message", "")
                    if code == 404 or any(r in msg.lower() for r in ("not found", "not supported", "no longer available", "model not found", "could not find")):
                        last_err = f"{model}: {msg[:120]}"; print(f"Gemini embed model {model} khong kha dung, thu model ke tiep..."); break
                    if code in (429, 502, 503, 504) and attempt == 1:
                        last_err = f"{model}: {msg[:80]}"; print(f"Gemini embed model {model} {code} (tam thai), retry..."); _time.sleep(2.0); continue
                    last_err = f"{model}: {msg[:80]}"; print(f"Gemini embed model {model} {code}, chuyen model ke tiep..."); break
                emb = data.get("embeddings") or data.get("embedding")
                if isinstance(emb, list):
                    vec = (emb[0] if emb else {}).get("values")
                elif isinstance(emb, dict):
                    vec = emb.get("values")
                else:
                    vec = data.get("values")
                if vec:
                    vec = [float(x) for x in vec]
                    # Dimension guard: never return a vector whose dim differs from
                    # the dimension pinned when the collection was first populated.
                    if self._embed_dim and len(vec) != self._embed_dim:
                        last_err = f"{model}: dim {len(vec)} != da pin {self._embed_dim}"
                        print(f"Gemini embed model {model} tra ve dim {len(vec)} khac collection ({self._embed_dim}), bo qua..."); break  # dim khac -> thu model ke tiep
                    self._embed_dim = len(vec)
                    return vec
                last_err = f"{model}: response khong co gia tri embedding"
                continue
        raise RuntimeError(f"Khong the lay embedding tu Gemini. Loi: {last_err}")

    def add_documents(self, documents: List[str], metadatas: List[Dict], ids: List[str]):
        try:
            if not self.collection:
                raise RuntimeError("Vector store collection chưa được khởi tạo.")
            save_fn = getattr(self.collection, "upsert", self.collection.add)
            if self.has_api:
                embeddings = [self.get_embedding(doc) for doc in documents]
                save_fn(documents=documents, embeddings=embeddings, metadatas=metadatas, ids=ids)
            else:
                save_fn(documents=documents, metadatas=metadatas, ids=ids)
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
