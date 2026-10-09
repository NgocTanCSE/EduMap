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
    """Semantic search. Chat (LLM) + EMBEDDING đều qua Cloudflare Workers AI (1 token: CLOUDFLARE_API_TOKEN).

    - Chat (LLM)  -> Cloudflare Workers AI : CLOUDFLARE_API_TOKEN / CLOUDFLARE_MODEL (@cf/meta/llama-3-8b-instruct)
    - Embedding  -> Cloudflare Workers AI : CLOUDFLARE_API_TOKEN / CLOUDFLARE_EMBEDDING_MODEL (@cf/baai/bge-1280)
    """

    def __init__(self):
        # --- Cloudflare Embedding config (always set; independent of ChromaDB) ---
        self.cf_api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        self.cf_account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.embed_models = [m.strip() for m in os.getenv("CLOUDFLARE_EMBEDDING_MODEL", "@cf/baai/bge-1280,@cf/snowflake/snowflake-arctic-embed-l").split(",") if m.strip()]
        self.embedding_model = self.embed_models[0] if self.embed_models else "@cf/baai/bge-1280"
        self.has_api = bool(self.cf_api_token) and bool(self.cf_account_id)
        # Pin the embedding dimension to the first model that successfully embeds.
        # Prevents silently falling back to a different-dim model, which would
        # crash the existing ChromaDB collection with a dimension mismatch.
        self._embed_dim = None
        if not self.has_api:
            print("WARNING: Vector store without embeddings. Set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Cloudflare) for semantic search.")
        if not os.getenv("CLOUDFLARE_EMBEDDING_MODEL"):
            print("WARNING: CLOUDFLARE_EMBEDDING_MODEL not set -> default @cf/baai/bge-1280")

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
            raise RuntimeError("Embedding service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_EMBEDDING_MODEL để dùng semantic search.")
        if not text:
            return []

        import time as _time
        base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.cf_account_id}/ai/run"
        last_err = None
        per_model_retries = 1

        for model in self.embed_models:
            url = f"{base_url}/{model}"
            payload = json.dumps({"text": text}).encode("utf-8")
            attempt = 0
            while True:
                attempt += 1
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={
                        "Authorization": f"Bearer {self.cf_api_token}",
                        "Content-Type": "application/json",
                    },
                    method="POST",
                )
                data = None
                try:
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                except urllib.error.HTTPError as e:
                    body = e.read().decode("utf-8", "ignore")[:300]
                    low = body.lower()
                    if e.code == 404 or any(r in low for r in ("not found", "not supported", "no longer available", "model not found", "could not find")):
                        last_err = f"{model}: HTTP {e.code} {body[:120]}"; print(f"Cloudflare embed model {model} khong kha dung, thu model ke tiep..."); break  # next model
                    if e.code in (401, 403):
                        raise RuntimeError(f"Cloudflare auth loi (HTTP {e.code}): {body[:200]}")
                    if e.code == 429:
                        last_err = f"{model}: HTTP 429 {body[:80]}"; print(f"Cloudflare embed model {model} bi rate-limit (429), thu model ke tiep..."); break
                    if e.code in (502, 503, 504) and attempt <= per_model_retries:
                        last_err = f"{model}: HTTP {e.code} {body[:80]}"; print(f"Cloudflare embed model {model} {e.code} (tam thai), retry {attempt}/{per_model_retries}..."); _time.sleep(2.0); continue
                    last_err = f"{model}: HTTP {e.code} {body[:80]}"; print(f"Cloudflare embed model {model} {e.code}, thu model ke tiep..."); break  # next model
                except Exception as e:
                    if attempt <= per_model_retries:
                        last_err = f"{model}: {e}"; print(f"Loi ket noi embed {model}, retry {attempt}/{per_model_retries}..."); _time.sleep(1.5); continue
                    last_err = f"{model}: {e}"; print(f"Loi ket noi embed {model}, thu model ke tiep..."); break  # next model

                # Success path: parse Cloudflare embedding response
                if isinstance(data, dict) and data.get("success") is False:
                    errors = data.get("errors", [])
                    if isinstance(errors, list) and len(errors) > 0:
                        err = errors[0] if isinstance(errors[0], dict) else {"message": str(errors[0])}
                        code = err.get("code", 0)
                        msg = err.get("message", "")
                        if self._is_embed_model_not_found(code, msg):
                            last_err = f"{model}: {msg[:120]}"; print(f"Cloudflare embed model {model} khong kha dung, thu model ke tiep..."); break
                        if code == 429:
                            last_err = f"{model}: {msg[:80]}"; print(f"Cloudflare embed model {model} bi rate-limit (429), thu model ke tiep..."); break
                        last_err = f"{model}: {msg[:80]}"; print(f"Cloudflare embed model {model} {code}, thu model ke tiep..."); break

                result = data.get("result", {}) if isinstance(data, dict) else {}
                vec = None
                if isinstance(result, dict):
                    # Cloudflare BGE returns: {"result": {"data": [{"embedding": [...]}]}}
                    data_list = result.get("data")
                    if isinstance(data_list, list) and len(data_list) > 0:
                        item = data_list[0]
                        if isinstance(item, dict):
                            vec = item.get("embedding")
                    if vec is None:
                        # Fallback shape: {"result": {"embedding": [...]}}
                        vec = result.get("embedding") or result.get("values")
                elif isinstance(result, list) and len(result) > 0:
                    vec = result[0] if isinstance(result[0], list) else result

                if vec:
                    vec = [float(x) for x in vec]
                    # Dimension guard: never return a vector whose dim differs from
                    # the dimension pinned when the collection was first populated.
                    if self._embed_dim and len(vec) != self._embed_dim:
                        last_err = f"{model}: dim {len(vec)} != da pin {self._embed_dim}"
                        print(f"Cloudflare embed model {model} tra ve dim {len(vec)} khac collection ({self._embed_dim}), bo qua..."); break  # dim khac -> thu model ke tiep
                    self._embed_dim = len(vec)
                    return vec
                last_err = f"{model}: response khong co gia tri embedding"
                break
            # end while True (per-model)
            continue

        raise RuntimeError(f"Khong the lay embedding tu Cloudflare Workers AI. Loi: {last_err}")

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
