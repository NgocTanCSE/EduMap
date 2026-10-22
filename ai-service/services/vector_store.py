import os
import json
import urllib.request
import urllib.error
from typing import List, Dict

try:
    import requests
except ImportError:
    requests = None

try:
    import chromadb
except ImportError:
    chromadb = None


class VectorStoreService:
    """Semantic search. Chat (LLM) + EMBEDDING đều qua Cloudflare Workers AI (1 token: CLOUDFLARE_API_TOKEN).

    - Chat (LLM)  -> Cloudflare Workers AI : CLOUDFLARE_API_TOKEN / CLOUDFLARE_MODEL (@cf/meta/llama-3.1-8b-instruct-fp8)
    - Embedding  -> Cloudflare Workers AI : CLOUDFLARE_API_TOKEN / CLOUDFLARE_EMBEDDING_MODEL (@cf/baai/bge-base-en-v1.5)
    - EMBEDDING  -> HuggingFace Inference API (fallback) : HF_TOKEN / HF_EMBEDDING_MODEL (intfloat/multilingual-e5-base, 768 dim)
      Khi Cloudflare khong ket noi duoc (TLS/SSL EOF tu HF Spaces), tu dong chuyen sang HF Inference API.
      HF_TOKEN tu dong co san tren HF Spaces.
    """

    def __init__(self):
        # --- Cloudflare Embedding config (always set; independent of ChromaDB) ---
        self.cf_api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        self.cf_account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        # AI Gateway (tuỳ chọn): nếu bật, gọi qua gateway thay vì trực tiếp Workers AI.
        self.cf_gateway_id = os.getenv("CF_AI_GATEWAY_ID", "")
        self.cf_gateway_enabled = os.getenv("CF_AI_GATEWAY_ENABLED", "false").lower() in ("1", "true", "yes", "on")
        self.embed_models = [m.strip() for m in os.getenv("CLOUDFLARE_EMBEDDING_MODEL", "@cf/baai/bge-base-en-v1.5,@cf/baai/bge-m3,@cf/qwen/qwen3-embedding-0.6b").split(",") if m.strip()]
        self.embedding_model = self.embed_models[0] if self.embed_models else "@cf/baai/bge-base-en-v1.5"
        self.has_cf_api = bool(self.cf_api_token) and bool(self.cf_account_id)
        # Circuit breaker: skip Cloudflare for 5 min after a network failure.
        self._cf_embed_down_until = 0.0
        # --- HuggingFace Inference API config (fallback khi Cloudflare ko hoat dong) ---
        self.hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN")
        self.hf_embedding_model = os.getenv("HF_EMBEDDING_MODEL", "intfloat/multilingual-e5-base")
        # api-inference.huggingface.co was retired (NXDOMAIN). Router is current.
        self.hf_router_url = os.getenv("HF_ROUTER_URL", "https://router.huggingface.co").rstrip("/")
        self.has_hf_api = bool(self.hf_token)
        # has_api = True neu co bat ky nhanh embed nao hoat dong duoc
        self.has_api = self.has_cf_api or self.has_hf_api
        # Pin the embedding dimension to the first model that successfully embeds.
        # Prevents silently falling back to a different-dim model, which would
        # crash the existing ChromaDB collection with a dimension mismatch.
        self._embed_dim = None
        if not self.has_cf_api and not self.has_hf_api:
            print("WARNING: Vector store without embeddings. Set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Cloudflare) OR HF_TOKEN (HuggingFace) for semantic search.")
        if not os.getenv("CLOUDFLARE_EMBEDDING_MODEL"):
            print("WARNING: CLOUDFLARE_EMBEDDING_MODEL not set -> default @cf/baai/bge-base-en-v1.5")
        if self.has_hf_api:
            print(f"INFO: HuggingFace Inference API fallback enabled with model={self.hf_embedding_model}")

        # --- ChromaDB collection (optional; not required for get_embedding) ---
        self.collection = None
        if chromadb is None:
            print("ChromaDB module not available. Vector store disabled.")
            return
        try:
            import signal as _signal

            def _chroma_timeout_handler(signum, frame):
                raise TimeoutError("ChromaDB initialization exceeded 15s — likely stale/corrupt data files.")

            _signal.signal(_signal.SIGALRM, _chroma_timeout_handler)
            _signal.alarm(15)
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
            finally:
                _signal.alarm(0)
        except Exception as e:
            print(f"Vector store initialization failed: {e}")
            self.collection = None

    _EMBED_MODEL_NOT_FOUND_REASONS = (
        "not found", "not supported", "no longer available",
        "model not found", "could not find", "deprecated", "does not exist",
    )

    def _is_embed_model_not_found(self, code, message):
        low = (message or "").lower()
        return (
            code in (404, 410, 7000)
            or any(r in low for r in self._EMBED_MODEL_NOT_FOUND_REASONS)
        )

    def _hf_get_embedding(self, text: str) -> List[float]:
        """Goi HuggingFace Inference API de lay embedding.
        Dung khi Cloudflare Workers AI khong ket noi duoc (TLS/SSL EOF tu HF Spaces).
        """
        if not self.has_hf_api:
            raise RuntimeError("HF_TOKEN not set — cannot use HuggingFace Inference API for embeddings.")

        url = f"{self.hf_router_url}/hf-inference/models/{self.hf_embedding_model}/pipeline/feature-extraction"
        payload = json.dumps({"inputs": text, "options": {"wait_for_model": True}}).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {self.hf_token}",
            "Content-Type": "application/json",
        }

        import time
        max_retries = 1  # reduced from 3 to 1 to fit within 60s backend timeout
        for attempt in range(1, max_retries + 1):
            try:
                if requests is not None:
                    resp = requests.post(
                        url,
                        headers=headers,
                        json={"inputs": text, "options": {"wait_for_model": True}},
                        timeout=8,
                    )
                    status_code = resp.status_code
                    body = resp.text
                    if resp.status_code == 200:
                        data = resp.json()
                    else:
                        raise urllib.error.HTTPError(url, resp.status_code, body, resp.headers, None)
                else:
                    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
                    with urllib.request.urlopen(req, timeout=8) as resp:
                        status_code = resp.status
                        data = json.loads(resp.read().decode("utf-8"))

                vec = None
                if isinstance(data, dict):
                    # HF Inference API feature-extraction returns: {"embeddings": [...]} or {"error": "..."}
                    if "error" in data and not data.get("embeddings"):
                        # Model dang loading — retry
                        if "loading" in data.get("error", "").lower() or "loading" in str(data.get("warnings", "")):
                            print(f"HF embed model loading, retry {attempt}/{max_retries}...")
                            time.sleep(3 * attempt)
                            continue
                        raise RuntimeError(f"HF Inference API error: {data.get('error')}")
                    vec = data.get("embeddings")
                elif isinstance(data, list):
                    # feature-extraction returns either [[...]] (one pooled vector)
                    # or [[[..., ...], ...]] (token-level vectors) for one input.
                    if len(data) > 0:
                        first = data[0]
                        if isinstance(first, list):
                            if len(first) > 0 and isinstance(first[0], list):
                                # Mean-pool token embeddings into one sentence vector.
                                vec = [sum(col) / len(col) for col in zip(*first)]
                            else:
                                vec = first
                        else:
                            vec = data
                elif isinstance(data, dict) and "data" in data:
                    # OpenAI-style: {"data": [{"embedding": [...]}]}
                    data_list = data.get("data")
                    if isinstance(data_list, list) and len(data_list) > 0:
                        item = data_list[0]
                        if isinstance(item, dict):
                            vec = item.get("embedding")
                        elif isinstance(item, list):
                            vec = item

                if vec and isinstance(vec, list) and len(vec) > 0:
                    vec = [float(x) for x in vec]
                    return vec

                raise RuntimeError(f"HF Inference API unexpected response format")

            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", "ignore")[:300] if hasattr(e, "read") else str(e)
                if e.code in (503,) and "loading" in body.lower() and attempt <= max_retries:
                    print(f"HF embed model loading (503), retry {attempt}/{max_retries}...")
                    time.sleep(3 * attempt)
                    continue
                if e.code in (429,) and attempt <= max_retries:
                    print(f"HF Inference API rate-limited (429), retry {attempt}/{max_retries}...")
                    time.sleep(2 * attempt)
                    continue
                raise RuntimeError(f"HF Inference API HTTP error {e.code}: {body[:200]}")
            except Exception as e:
                if attempt <= max_retries:
                    print(f"HF embed connection error, retry {attempt}/{max_retries}: {e}")
                    time.sleep(2 * attempt)
                    continue
                raise RuntimeError(f"HF Inference API connection failed: {e}")

        raise RuntimeError(f"HF Inference API embedding failed after {max_retries} retries")

    def get_embedding(self, text: str) -> List[float]:
        if not self.has_api:
            raise RuntimeError("Embedding service chưa sẵn sàng. Cấu hình CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_EMBEDDING_MODEL hoặc HF_TOKEN để dùng semantic search.")
        if not text:
            return []

        import time
        _embed_start = time.monotonic()
        _EMBED_GLOBAL_TIMEOUT = 12  # cap total embedding time so LLM can still respond within 60s backend timeout
        cf_last_err = None

        # --- Phan 1: thu Cloudflare (qua AI Gateway neu bat, nguoc lai truc tiep Workers AI) ---
        if self.has_cf_api and time.monotonic() >= self._cf_embed_down_until:
            cf_last_err = None
            if self.cf_gateway_enabled and self.cf_gateway_id and self.cf_account_id:
                base_url = f"https://gateway.ai.cloudflare.com/v1/{self.cf_account_id}/{self.cf_gateway_id}/ai/run"
                print(f"[Embed] Using Cloudflare AI Gateway: gateway_id={self.cf_gateway_id}")
            else:
                base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.cf_account_id}/ai/run"
            per_model_retries = 0  # no retry — connection errors on HF Spaces are consistent, retrying wastes time

            for model in self.embed_models:
                if time.monotonic() - _embed_start > _EMBED_GLOBAL_TIMEOUT:
                    print(f"  [embed] global timeout ({_EMBED_GLOBAL_TIMEOUT}s) reached, stopping Cloudflare embed attempts"); break
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
                        with urllib.request.urlopen(req, timeout=4) as resp:
                            data = json.loads(resp.read().decode("utf-8"))
                    except urllib.error.HTTPError as e:
                        body = e.read().decode("utf-8", "ignore")[:300]
                        low = body.lower()
                        if e.code in (404, 410) or any(r in low for r in ("not found", "not supported", "no longer available", "model not found", "could not find", "deprecated", "does not exist")):
                            cf_last_err = f"{model}: HTTP {e.code} {body[:120]}"; print(f"Cloudflare embed model {model} khong kha dung, thu model ke tiep..."); break  # next model
                        if e.code in (401, 403):
                            raise RuntimeError(f"Cloudflare auth loi (HTTP {e.code}): {body[:200]}")
                        if e.code == 429:
                            cf_last_err = f"{model}: HTTP 429 {body[:80]}"; print(f"Cloudflare embed model {model} bi rate-limit (429), thu model ke tiep..."); break
                        if e.code in (502, 503, 504) and attempt <= per_model_retries:
                            cf_last_err = f"{model}: HTTP {e.code} {body[:80]}"; print(f"Cloudflare embed model {model} {e.code} (tam thai), retry {attempt}/{per_model_retries}..."); time.sleep(2.0); continue
                        cf_last_err = f"{model}: HTTP {e.code} {body[:80]}"; print(f"Cloudflare embed model {model} {e.code}, thu model ke tiep..."); break  # next model
                    except Exception as e:
                        if attempt <= per_model_retries:
                            cf_last_err = f"{model}: {e}"; print(f"Loi ket noi embed {model}, retry {attempt}/{per_model_retries}..."); time.sleep(1.5); continue
                        cf_last_err = f"{model}: {e}"; print(f"Loi ket noi embed {model}, tam ngung Cloudflare 5 phut.")
                        self._cf_embed_down_until = time.monotonic() + 300
                        break  # network is down for all models

                    # Success path: parse Cloudflare embedding response
                    if isinstance(data, dict) and data.get("success") is False:
                        errors = data.get("errors", [])
                        if isinstance(errors, list) and len(errors) > 0:
                            err = errors[0] if isinstance(errors[0], dict) else {"message": str(errors[0])}
                            code = err.get("code", 0)
                            msg = err.get("message", "")
                            if self._is_embed_model_not_found(code, msg):
                                cf_last_err = f"{model}: {msg[:120]}"; print(f"Cloudflare embed model {model} khong kha dung, thu model ke tiep..."); break
                            if code == 429:
                                cf_last_err = f"{model}: {msg[:80]}"; print(f"Cloudflare embed model {model} bi rate-limit (429), thu model ke tiep..."); break
                            cf_last_err = f"{model}: {msg[:80]}"; print(f"Cloudflare embed model {model} {code}, thu model ke tiep..."); break

                    result = data.get("result", {}) if isinstance(data, dict) else {}
                    vec = None
                    if isinstance(result, dict):
                        data_list = result.get("data")
                        if isinstance(data_list, list) and len(data_list) > 0:
                            item = data_list[0]
                            if isinstance(item, dict):
                                vec = item.get("embedding")
                            elif isinstance(item, list):
                                vec = item
                        if vec is None:
                            vec = result.get("embedding") or result.get("values")
                    elif isinstance(result, list) and len(result) > 0:
                        vec = result[0] if isinstance(result[0], list) else result

                    if vec:
                        vec = [float(x) for x in vec]
                        # Dimension guard: never return a vector whose dim differs from
                        # the dimension pinned when the collection was first populated.
                        if self._embed_dim and len(vec) != self._embed_dim:
                            cf_last_err = f"{model}: dim {len(vec)} != da pin {self._embed_dim}"
                            print(f"Cloudflare embed model {model} tra ve dim {len(vec)} khac collection ({self._embed_dim}), bo qua..."); break
                        self._embed_dim = len(vec)
                        return vec
                    cf_last_err = f"{model}: response khong co gia tri embedding"
                    break
                # end while True (per-model)
            # end for model in embed_models

        # --- Phan 2: fallback ve HuggingFace Inference API (khi Cloudflare fail) ---
        if self.has_hf_api:
            if time.monotonic() - _embed_start > _EMBED_GLOBAL_TIMEOUT:
                print(f"  [embed] global timeout ({_EMBED_GLOBAL_TIMEOUT}s) reached, skipping HF fallback")
            else:
                try:
                    vec = self._hf_get_embedding(text)
                    vec = [float(x) for x in vec]
                    # Dimension guard: neu collection da co dim (tu Cloudflare seed),
                    # can chinh lenh ve khop. Nhung multilingual-e5-base = 768 dim,
                    # tuong tu nhu bge-base-en-v1.5 = 768 dim.
                    if self._embed_dim and len(vec) != self._embed_dim:
                        print(f"HF embed dim {len(vec)} != collection dim {self._embed_dim}, dieu chinh...")
                        if len(vec) > self._embed_dim:
                            vec = vec[:self._embed_dim]  # truncate
                        else:
                            vec = vec + [0.0] * (self._embed_dim - len(vec))  # pad
                    self._embed_dim = len(vec)
                    print(f"  -> HF Inference API embedding OK (dim={len(vec)})")
                    return vec
                except Exception as e:
                    print(f"HF Inference API embedding ALSO failed: {e}")

        raise RuntimeError(f"Khong the lay embedding. Cloudflare: {cf_last_err or 'khong cau hinh'}")

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
