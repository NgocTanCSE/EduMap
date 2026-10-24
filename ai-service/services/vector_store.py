import os
import json
import urllib.request
import urllib.error
import urllib.parse
from typing import List, Dict

# ChromaDB's PostHog telemetry is incompatible with newer posthog releases and
# logs a noisy "capture() takes 1 positional argument but 3 were given" error
# on every collection query. Telemetry is not needed for EduMap — disable it
# before chromadb reads its Settings.
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")
os.environ.setdefault("CHROMA_TELEMETRY_ENABLED", "False")

# Belt-and-suspenders: chromadb 0.5.x still CALLS posthog.capture(...) even when
# anonymized_telemetry is False (it only sets posthog.disabled, which is checked
# after the argument binding). With posthog>=6 the call itself raises, so the
# error survives the setting. Replace capture with a no-op before chromadb
# imports it. requirements.txt also pins posthog<6.
try:
    import posthog as _posthog

    _posthog.disabled = True
    _posthog.capture = lambda *args, **kwargs: None
except Exception:
    pass

try:
    import requests
except ImportError:
    requests = None

try:
    import chromadb
except ImportError:
    chromadb = None


class VectorStoreService:
    """Semantic search. Chat (LLM) + EMBEDDING đều qua Google Gemini (một key).

    - Embedding  -> Google Gemini : GEMINI_API_KEY / GEMINI_EMBEDDING_MODEL
    - Embedding  -> Cloudflare Workers AI : CLOUDFLARE_API_TOKEN / CLOUDFLARE_EMBEDDING_MODEL
    - EMBEDDING  -> HuggingFace Inference API (fallback) : HF_TOKEN / HF_EMBEDDING_MODEL
      HF Spaces không hoàn tất được TLS tới api.cloudflare.com; Gemini là lựa chọn chính.
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
        # --- Google Gemini embeddings (primary on HF Spaces) ---
        # One GEMINI_API_KEY covers chat and embeddings. Gemini is reachable
        # from HF Spaces, unlike api.cloudflare.com (TLS handshake blackholed).
        self.gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip().strip('"').strip("'")
        self.gemini_embedding_models = [
            m.strip()
            for m in os.getenv(
                "GEMINI_EMBEDDING_MODEL",
                # text-embedding-004 was shut down on 2026-01-14.
                "gemini-embedding-001",
            ).split(",")
            if m.strip()
        ]
        self.gemini_timeout = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "20"))
        self.has_gemini_api = bool(self.gemini_key)
        self._gemini_embed_down_until = 0.0
        # --- HuggingFace Inference API config (fallback khi Cloudflare/Gemini ko hoat dong) ---
        self.hf_token = (
            os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN") or ""
        ).strip().strip('"').strip("'")
        self.hf_embedding_model = os.getenv("HF_EMBEDDING_MODEL", "intfloat/multilingual-e5-base")
        # api-inference.huggingface.co was retired (NXDOMAIN). Router is current.
        self.hf_router_url = os.getenv("HF_ROUTER_URL", "https://router.huggingface.co").rstrip("/")
        self.has_hf_api = bool(self.hf_token)

        # --- OpenRouter embedding (tuỳ chọn, thay thế Cloudflare/Gemini nếu cần) ---
        self.openrouter_base = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
        self.openrouter_key = (os.getenv("OPENROUTER_API_KEY") or "").strip().strip('"').strip("'")
        self.openrouter_embed_model = os.getenv("OPENROUTER_EMBEDDING_MODEL", "")
        self.openrouter_timeout = float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "20"))
        self.has_openrouter_api = bool(self.openrouter_key) and bool(self.openrouter_embed_model)

        # --- NVIDIA NIM embedding (OpenAI-compatible, build.nvidia.com) ---
        self.nvidia_key = (os.getenv("NVIDIA_API_KEY") or os.getenv("NIM_API_KEY") or "").strip().strip('"').strip("'")
        self.nvidia_base = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")
        self.nvidia_embed_model = os.getenv("NVIDIA_EMBED_MODEL", "nvidia/embed-qa-4")
        self.nvidia_timeout = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "30"))
        self.has_nvidia_api = bool(self.nvidia_key) and bool(self.nvidia_embed_model)

        # has_api = True neu co bat ky nhanh embed nao hoat dong duoc
        self.has_api = self.has_gemini_api or self.has_cf_api or self.has_hf_api or self.has_openrouter_api or self.has_nvidia_api
        # Pin the embedding dimension to the first model that successfully embeds.
        # Prevents silently falling back to a different-dim model, which would
        # crash the existing ChromaDB collection with a dimension mismatch.
        self._embed_dim = None
        if not self.has_api:
            print("WARNING: Vector store without embeddings. Set GEMINI_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Cloudflare) OR HF_TOKEN (HuggingFace) for semantic search.")
        if self.has_gemini_api:
            print(f"INFO: Gemini embeddings enabled with models={','.join(self.gemini_embedding_models)}")
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
                try:
                    from chromadb.config import Settings as ChromaSettings
                    chroma_settings = ChromaSettings(anonymized_telemetry=False)
                except Exception:
                    chroma_settings = None
                if chroma_settings is not None:
                    self.client = chromadb.PersistentClient(path=db_path, settings=chroma_settings)
                else:
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

    def _gemini_get_embedding(self, text: str) -> List[float]:
        """Get an embedding from Google Gemini (primary on HF Spaces)."""
        import subprocess
        import time

        if not self.has_gemini_api:
            raise RuntimeError("GEMINI_API_KEY not set — cannot use Gemini embeddings.")
        if time.monotonic() < self._gemini_embed_down_until:
            raise RuntimeError("Gemini embeddings temporarily disabled after a network failure.")

        last_err = None
        for raw_model in self.gemini_embedding_models:
            model = (raw_model or "").strip()
            if model.startswith("models/"):
                model = model[len("models/"):]
            if not model:
                continue

            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{urllib.parse.quote(model, safe='-')}:embedContent"
            )
            payload = {
                "model": f"models/{model}",
                "content": {"parts": [{"text": text}]},
            }
            # gemini-embedding-001 defaults to 3072 dims, which would not match
            # the existing 768-dim Chroma collection. Ask for the pinned dim.
            if model.startswith("gemini-embedding-001"):
                payload["outputDimensionality"] = int(self._embed_dim or 768)
            body_json = json.dumps(payload)

            try:
                proc = subprocess.run(
                    [
                        "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                        "-H", f"x-goog-api-key: {self.gemini_key}",
                        "-H", "Content-Type: application/json",
                        "-d", body_json,
                        "--connect-timeout", "6",
                        "--max-time", str(self.gemini_timeout),
                        url,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=self.gemini_timeout + 2,
                )
            except Exception as e:
                self._gemini_embed_down_until = time.monotonic() + 300
                raise RuntimeError(f"Gemini embedding connection failed: {type(e).__name__}: {e}")

            if proc.returncode != 0:
                err = (proc.stderr or "").strip()[:200] or f"curl exit {proc.returncode}"
                self._gemini_embed_down_until = time.monotonic() + 300
                raise RuntimeError(f"Gemini embedding connection failed: {err}")

            try:
                data = json.loads(proc.stdout or "{}")
            except Exception:
                last_err = f"{model}: invalid JSON response"
                continue

            if isinstance(data, dict) and data.get("error"):
                err = data.get("error") or {}
                code = int(err.get("code") or 0)
                message = str(err.get("message") or "")
                low = message.lower()
                if code in (401, 403) or "api key" in low and ("invalid" in low or "not valid" in low):
                    raise RuntimeError(f"Gemini embedding auth error (HTTP {code}): {message[:200]}")
                if code == 429:
                    last_err = f"{model}: HTTP 429 {message[:100]}"
                    print(f"Gemini embedding model {model} bi rate-limit (429), thu model ke tiep...")
                    continue
                if code in (400, 404) and any(
                    reason in low
                    for reason in ("not found", "not supported", "does not exist", "deprecated")
                ):
                    last_err = f"{model}: HTTP {code} {message[:100]}"
                    print(f"Gemini embedding model {model} khong kha dung, thu model ke tiep...")
                    continue
                last_err = f"{model}: HTTP {code} {message[:120]}"
                continue

            vec = None
            if isinstance(data, dict):
                emb = data.get("embedding")
                if isinstance(emb, dict):
                    vec = emb.get("values")
                if vec is None:
                    embs = data.get("embeddings")
                    if isinstance(embs, list) and embs:
                        first = embs[0]
                        if isinstance(first, dict):
                            vec = first.get("values")
                        elif isinstance(first, list):
                            vec = first

            if vec and isinstance(vec, list) and len(vec) > 0:
                return [float(x) for x in vec]

            last_err = f"{model}: empty embedding response"

        raise RuntimeError(f"Gemini embedding failed: {last_err or 'no model available'}")

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

    def _nvidia_get_embedding(self, text: str) -> List[float]:
        """Lấy embedding qua NVIDIA NIM (OpenAI-compatible /embeddings)."""
        if not self.has_nvidia_api:
            raise RuntimeError("NVIDIA_API_KEY + NVIDIA_EMBED_MODEL not set — cannot use NVIDIA embedding.")
        url = f"{self.nvidia_base}/embeddings"
        payload = json.dumps({"model": self.nvidia_embed_model, "input": text}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {self.nvidia_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.nvidia_timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "ignore")[:300]
            raise RuntimeError(f"NVIDIA embedding HTTP {e.code}: {body}")
        except Exception as e:
            raise RuntimeError(f"NVIDIA embedding connection failed: {type(e).__name__}: {e}")

        try:
            vec = data["data"][0]["embedding"]
        except (KeyError, IndexError, TypeError):
            raise RuntimeError(f"NVIDIA embedding returned unexpected format: {str(data)[:200]}")
        if not isinstance(vec, list) or not vec:
            raise RuntimeError(f"NVIDIA embedding returned empty vector: {str(data)[:200]}")
        return [float(x) for x in vec]

    def get_embedding(self, text: str) -> List[float]:
        if not self.has_api:
            raise RuntimeError("Embedding service chưa sẵn sàng. Cấu hình GEMINI_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, HF_TOKEN, OPENROUTER_API_KEY + OPENROUTER_EMBEDDING_MODEL, hoặc NVIDIA_API_KEY + NVIDIA_EMBED_MODEL để dùng semantic search.")
        if not text:
            return []

        import time
        _embed_start = time.monotonic()
        _EMBED_GLOBAL_TIMEOUT = 12  # cap total embedding time so LLM can still respond within 60s backend timeout
        gemini_last_err = None
        cf_last_err = None

        # --- Phan 0: Gemini embeddings (primary — reachable from HF Spaces) ---
        if self.has_gemini_api and time.monotonic() >= self._gemini_embed_down_until:
            try:
                vec = self._gemini_get_embedding(text)
                vec = [float(x) for x in vec]
                if self._embed_dim and len(vec) != self._embed_dim:
                    print(f"Gemini embed dim {len(vec)} != collection dim {self._embed_dim}, dieu chinh...")
                    if len(vec) > self._embed_dim:
                        vec = vec[:self._embed_dim]
                    else:
                        vec = vec + [0.0] * (self._embed_dim - len(vec))
                self._embed_dim = len(vec)
                print(f"  -> Gemini embedding OK (dim={len(vec)})")
                return vec
            except Exception as e:
                gemini_last_err = str(e)
                print(f"Gemini embedding failed: {e}")

        # --- Phan 1: thu Cloudflare (qua AI Gateway neu bat, nguoc lai truc tiep Workers AI) ---
        if self.has_cf_api and time.monotonic() >= self._cf_embed_down_until:
            cf_last_err = None
            cf_network_down = False
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
                        cf_network_down = True
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
                if cf_network_down:
                    print("  [embed] Cloudflare network unreachable, skipping remaining models")
                    break
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

        # --- Phan 3: fallback ve NVIDIA NIM embedding ---
        if self.has_nvidia_api:
            if time.monotonic() - _embed_start > _EMBED_GLOBAL_TIMEOUT:
                print(f"  [embed] global timeout ({_EMBED_GLOBAL_TIMEOUT}s) reached, skipping NVIDIA fallback")
            else:
                try:
                    vec = self._nvidia_get_embedding(text)
                    vec = [float(x) for x in vec]
                    if self._embed_dim and len(vec) != self._embed_dim:
                        print(f"NVIDIA embed dim {len(vec)} != collection dim {self._embed_dim}, dieu chinh...")
                        if len(vec) > self._embed_dim:
                            vec = vec[:self._embed_dim]
                        else:
                            vec = vec + [0.0] * (self._embed_dim - len(vec))
                    self._embed_dim = len(vec)
                    print(f"  -> NVIDIA NIM embedding OK (dim={len(vec)})")
                    return vec
                except Exception as e:
                    print(f"NVIDIA NIM embedding ALSO failed: {e}")

        raise RuntimeError(
            "Khong the lay embedding. "
            f"Gemini: {gemini_last_err or ('khong cau hinh' if not self.has_gemini_api else 'khong kha dung')}, "
            f"Cloudflare: {cf_last_err or 'khong cau hinh'}, "
            f"HF: {'khong cau hinh' if not self.has_hf_api else 'that bai'}, "
            f"NVIDIA: {'khong cau hinh' if not self.has_nvidia_api else 'that bai'}"
        )

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
