import os
import json
import time
import hashlib
import subprocess
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
            os.getenv("HF_TOKEN") or os.getenv("HF_API_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN") or ""
        ).strip().strip('"').strip("'")
        self.hf_embedding_model = os.getenv("HF_EMBEDDING_MODEL", "intfloat/multilingual-e5-base")
        # api-inference.huggingface.co was retired (NXDOMAIN). Router is current.
        self.hf_router_url = os.getenv("HF_ROUTER_URL", "https://router.huggingface.co").rstrip("/")
        self.has_hf_api = bool(self.hf_token)
        # Circuit breaker: skip HF embeddings for 5 min after a 401/invalid token.
        self._hf_embed_down_until = 0.0

        # --- OpenRouter embedding (tuỳ chọn, thay thế Cloudflare/Gemini nếu cần) ---
        self.openrouter_base = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
        self.openrouter_key = (os.getenv("OPENROUTER_API_KEY") or "").strip().strip('"').strip("'")
        # OpenRouter model slugs are provider-prefixed. The old default
        # "text-embedding-3-small" is NOT a valid slug (must be
        # "openai/text-embedding-3-small"). _openrouter_get_embedding() also
        # normalises unprefixed values coming from older HF Space secrets.
        self.openrouter_embed_model = os.getenv(
            "OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small"
        ).strip()
        self.openrouter_timeout = float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "8"))
        self.has_openrouter_api = bool(self.openrouter_key) and bool(self.openrouter_embed_model)

        # --- NVIDIA NIM embedding (OpenAI-compatible, build.nvidia.com) ---
        self.nvidia_key = (os.getenv("NVIDIA_API_KEY") or os.getenv("NIM_API_KEY") or "").strip().strip('"').strip("'")
        self.nvidia_base = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")
        self.nvidia_embed_model = os.getenv("NVIDIA_EMBED_MODEL", "nvidia/embed-qa-4")
        self.nvidia_timeout = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "30"))
        self.has_nvidia_api = bool(self.nvidia_key) and bool(self.nvidia_embed_model)
        # Circuit breaker for NVIDIA NIM embeddings: 5-min cooldown after a failure.
        self._nvidia_embed_down_until = 0.0

        # --- Shanghai AI Laboratory (01.ai / Kimi) embedding ---
        self.kimi_key = (os.getenv("KIMI_API_KEY") or "").strip().strip('"').strip("'")
        self.kimi_base = os.getenv("KIMI_BASE_URL", "https://api.01.ai/v1").rstrip("/")
        self.kimi_embed_model = os.getenv("KIMI_EMBEDDING_MODEL", "kimi-embedding-0812")
        self.kimi_timeout = float(os.getenv("KIMI_TIMEOUT_SECONDS", "30"))
        self.has_kimi_api = bool(self.kimi_key) and bool(self.kimi_embed_model)
        self._kimi_embed_down_until = 0.0

        # --- Embedding time budget (critical for HF Spaces) -------------------
        # The whole provider chain runs synchronously inside a worker thread
        # triggered by a chat request. On HF Spaces a slow/hanging provider
        # (OpenRouter often times out after 15s with 0 bytes) used to consume
        # the entire budget, so Cloudflare/HF/Kimi fallbacks were always
        # skipped and RAG failed. Now:
        #   * EMBED_GLOBAL_TIMEOUT_SECONDS caps the entire chain (default 6s,
        #     safely below the NestJS 10s stream timeout and RAG_TIMEOUT_SECONDS).
        #   * EMBED_PROVIDER_TIMEOUT_SECONDS caps each individual attempt
        #     (default 4s) so the first provider cannot starve the fallbacks.
        # Both are env-tunable without a code change.
        self.embed_global_timeout = max(2.0, float(os.getenv("EMBED_GLOBAL_TIMEOUT_SECONDS", "6")))
        self.embed_provider_timeout = max(1.5, float(os.getenv("EMBED_PROVIDER_TIMEOUT_SECONDS", "4")))

        # has_api = True neu co bat ky nhanh embed nao hoat dong duoc
        self.has_api = self.has_gemini_api or self.has_cf_api or self.has_hf_api or self.has_openrouter_api or self.has_nvidia_api or self.has_kimi_api
        # Pin the embedding dimension to the first model that successfully embeds.
        # Prevents silently falling back to a different-dim model, which would
        # crash the existing ChromaDB collection with a dimension mismatch.
        self._embed_dim = None
        # LRU + TTL cache for embeddings: avoid re-computing the (slow) curl/subprocess
        # embedding call for identical queries. Repeated chat questions like
        # "tìm học bổng" or "lộ trình học AI" would otherwise burn 5-20s on
        # every turn. Keys are md5(text); values are (vector, timestamp) tuples.
        self._embed_cache: Dict[str, List[float]] = {}
        self._embed_cache_meta: Dict[str, float] = {}  # cache_key -> insert timestamp
        self._embed_cache_max = 128
        # TTL in seconds: cached embeddings expire after 30 minutes to prevent
        # stale vectors from dominating long-running chat sessions. The LRU
        # eviction (FIFO by insertion order) remains as the secondary guard.
        self._embed_cache_ttl = float(os.getenv("EMBED_CACHE_TTL_SECONDS", "1800"))
        if not self.has_api:
            print("WARNING: Vector store without embeddings. Set OPENROUTER_API_KEY + OPENROUTER_EMBEDDING_MODEL, GEMINI_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Cloudflare), HF_TOKEN (HuggingFace), or NVIDIA_API_KEY + NVIDIA_EMBED_MODEL for semantic search.")
        if self.has_openrouter_api:
            print(f"INFO: OpenRouter embeddings enabled (primary) with model={self.openrouter_embed_model}")
        if self.has_gemini_api:
            print(f"INFO: Gemini embeddings enabled with models={','.join(self.gemini_embedding_models)}")
        if not os.getenv("CLOUDFLARE_EMBEDDING_MODEL"):
            print("WARNING: CLOUDFLARE_EMBEDDING_MODEL not set -> default @cf/baai/bge-base-en-v1.5")
        if self.has_hf_api:
            print(f"INFO: HuggingFace Inference API fallback enabled with model={self.hf_embedding_model}")
        if self.has_kimi_api:
            print(f"INFO: Shanghai AI Laboratory (01.ai / Kimi) embeddings enabled with model={self.kimi_embed_model}")
        print(
            f"INFO: Embedding budget: global={self.embed_global_timeout}s, "
            f"per-provider={self.embed_provider_timeout}s "
            f"(EMBED_GLOBAL_TIMEOUT_SECONDS / EMBED_PROVIDER_TIMEOUT_SECONDS)"
        )

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

    def _embed_remaining(self, started: float) -> float:
        """Seconds left in the global embedding budget."""
        return getattr(self, "embed_global_timeout", 6.0) - (time.monotonic() - started)

    def _embed_attempt_timeout(self, started: float) -> float:
        """Per-provider timeout capped by both the provider cap and the
        remaining global budget. Ensures one slow provider cannot starve the
        fallback chain (the original OpenRouter timeout bug)."""
        return max(1.5, min(getattr(self, "embed_provider_timeout", 4.0), self._embed_remaining(started)))

    def _openrouter_get_embedding(self, text: str, timeout_override: float = None) -> List[float]:
        """Get an embedding from OpenRouter (OpenAI-compatible /v1/embeddings).

        Uses curl for HF Spaces compatibility (IPv4 + skip TLS verification).

        When timeout_override is provided (set by get_embedding() based on the
        remaining global embedding budget), it caps curl's --max-time so a
        slow/timing-out provider does not consume the entire embedding budget,
        leaving room for fallback providers (Gemini, HF, NVIDIA).
        """
        if not self.has_openrouter_api:
            raise RuntimeError("OPENROUTER_API_KEY + OPENROUTER_EMBEDDING_MODEL not set.")
        if time.monotonic() < getattr(self, "_openrouter_embed_down_until", 0.0):
            raise RuntimeError("OpenRouter embeddings temporarily disabled after a network failure.")

        url = f"{self.openrouter_base}/embeddings"
        # Normalise legacy/unprefixed slugs: OpenRouter requires the provider
        # prefix ("openai/text-embedding-3-small"). Bypass with an explicit
        # prefix or a slash in the configured value.
        _model = (self.openrouter_embed_model or "").strip()
        if _model and "/" not in _model:
            _model = f"openai/{_model}"
        _payload_obj = {"model": _model, "input": text}
        # OpenAI text-embedding-3-* supports a `dimensions` parameter. Pin it
        # to the existing Chroma collection dimension so we get a high-quality
        # vector instead of truncating/padding a 1536-dim vector to 768.
        if self._embed_dim and _model.startswith(("openai/text-embedding-3", "text-embedding-3")):
            _payload_obj["dimensions"] = int(self._embed_dim)
        payload = json.dumps(_payload_obj).encode("utf-8")
        # Cap the per-call timeout so one provider cannot starve the remaining
        # budget (default 20s is way longer than the 15s global embedding budget).
        _call_timeout = timeout_override or self.openrouter_timeout
        _connect_timeout = max(1.0, min(3.0, _call_timeout))

        try:
            proc = subprocess.run(
                [
                    "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                    "-H", f"Authorization: Bearer {self.openrouter_key}",
                    "-H", "Content-Type: application/json",
                    "-d", payload,
                    "--connect-timeout", str(_connect_timeout),
                    "--max-time", str(_call_timeout),
                    url,
                ],
                capture_output=True,
                text=True,
                timeout=_call_timeout + 2,
            )
        except Exception as e:
            self._openrouter_embed_down_until = time.monotonic() + 300
            raise RuntimeError(f"OpenRouter embedding connection failed: {type(e).__name__}: {e}")

        if proc.returncode != 0:
            err = (proc.stderr or "").strip()[:200] or f"curl exit {proc.returncode}"
            # curl can exit non-zero (e.g. timeout code 28) while still having
            # received a partial response body — try to parse it so a 401/429
            # auth error body is surfaced instead of a generic "curl exit 28".
            _stdout = (proc.stdout or "").strip()
            if _stdout:
                try:
                    _partial = json.loads(_stdout)
                    if isinstance(_partial, dict):
                        if "error" in _partial:
                            _eno = _partial["error"]
                            if isinstance(_eno, dict):
                                _msg = str(_eno.get("message", _stdout[:120]))
                                _code = int(_eno.get("code") or 0)
                            else:
                                _msg = str(_eno)
                                _code = 0
                            low = _msg.lower()
                            if _code in (401, 403) or "api key" in low or "invalid" in low or "unauthorized" in low:
                                self._openrouter_embed_down_until = time.monotonic() + 300
                                raise RuntimeError(f"OpenRouter embedding auth error (HTTP {_code}): {_msg[:200]}")
                            err = f"{err} | body: {_msg[:120]}"
                except json.JSONDecodeError:
                    pass
            # Set circuit breaker so subsequent calls fail fast instead of
            # re-entering the 20s timeout on every request.
            self._openrouter_embed_down_until = time.monotonic() + 300
            raise RuntimeError(f"OpenRouter embedding connection failed: {err}")

        try:
            data = json.loads(proc.stdout or "{}")
        except Exception:
            raise RuntimeError("OpenRouter embedding: invalid JSON response")

        if isinstance(data, dict) and data.get("error"):
            err = data.get("error") or {}
            code = int(getattr(err, "get", lambda k, d=0: d)("code", 0)) if isinstance(err, dict) else 0
            message = str(err.get("message", "")) if isinstance(err, dict) else str(err)
            low = message.lower()
            if code in (401, 403) or "api key" in low:
                raise RuntimeError(f"OpenRouter embedding auth error (HTTP {code}): {message[:200]}")
            if code == 429:
                raise RuntimeError(f"OpenRouter embedding rate-limited (429): {message[:100]}")
            if self._is_embed_model_not_found(code, message):
                raise RuntimeError(f"OpenRouter embedding model not found: {message[:200]}")
            raise RuntimeError(f"OpenRouter embedding HTTP {code}: {message[:200]}")

        vec = None
        if isinstance(data, dict):
            data_list = data.get("data")
            if isinstance(data_list, list) and data_list:
                item = data_list[0]
                if isinstance(item, dict):
                    vec = item.get("embedding")
                elif isinstance(item, list):
                    vec = item

        if vec and isinstance(vec, list) and len(vec) > 0:
            return [float(x) for x in vec]

        raise RuntimeError(f"OpenRouter embedding returned empty vector: {str(data)[:200]}")

    def _gemini_get_embedding(self, text: str, timeout_override: float = None) -> List[float]:
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

            _gem_timeout = timeout_override or self.gemini_timeout
            try:
                proc = subprocess.run(
                    [
                        "curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                        "-H", f"x-goog-api-key: {self.gemini_key}",
                        "-H", "Content-Type: application/json",
                        "-d", body_json,
                        "--connect-timeout", "4",
                        "--max-time", str(_gem_timeout),
                        url,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=_gem_timeout + 2,
                )
            except Exception as e:
                self._gemini_embed_down_until = time.monotonic() + 300
                raise RuntimeError(f"Gemini embedding connection failed: {type(e).__name__}: {e}")

            if proc.returncode != 0:
                err = (proc.stderr or "").strip()[:200] or f"curl exit {proc.returncode}"
                # Try parsing partial stdout for auth/rate-limit error details
                # (curl exit 28 can still receive a small JSON error body).
                _stdout = (proc.stdout or "").strip()
                if _stdout:
                    try:
                        _partial = json.loads(_stdout)
                        if isinstance(_partial, dict) and _partial.get("error"):
                            _eno = _partial["error"]
                            if isinstance(_eno, dict):
                                err = f"{err} | body: {str(_eno.get('message', _stdout[:120]))[:120]}"
                    except Exception:
                        pass
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

    def _hf_get_embedding(self, text: str, timeout_override: float = None) -> List[float]:
        """Get embedding from HuggingFace Inference API (fallback when others fail).

        HF router (router.huggingface.co) is reachable from HF Spaces.
        Uses curl for consistent IPv4/TLS behavior with the other embedding
        providers. A 401 (invalid/expired token) sets a 5-minute circuit
        breaker so we don't waste the timeout on every subsequent request.
        """
        if not self.has_hf_api:
            raise RuntimeError("HF_TOKEN not set — cannot use HuggingFace Inference API for embeddings.")
        if time.monotonic() < getattr(self, "_hf_embed_down_until", 0.0):
            raise RuntimeError("HuggingFace embeddings temporarily disabled (circuit breaker — 401/invalid token, 5 min cooldown).")

        url = f"{self.hf_router_url}/hf-inference/models/{self.hf_embedding_model}/pipeline/feature-extraction"
        payload = json.dumps({"inputs": text, "options": {"wait_for_model": True}}).encode("utf-8")
        _hf_timeout = timeout_override or 8
        max_retries = 1  # reduced from 3 to 1 to fit within embedding global budget

        for attempt in range(1, max_retries + 1):
            try:
                proc = subprocess.run(
                    ["curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                     "-H", f"Authorization: Bearer {self.hf_token}",
                     "-H", "Content-Type: application/json",
                     "-d", payload.decode("utf-8"),
                     "--connect-timeout", "4",
                     "--max-time", str(_hf_timeout), url],
                    capture_output=True, text=True, timeout=_hf_timeout + 2,
                )
            except Exception as e:
                raise RuntimeError(f"HF embedding connection failed: {type(e).__name__}: {e}")

            if proc.returncode != 0:
                _body = (proc.stderr or "").strip()[:300] or f"curl exit {proc.returncode}"
                # Try parsing partial stdout for error details
                _stdout = (proc.stdout or "").strip()
                if _stdout:
                    try:
                        _partial = json.loads(_stdout)
                        if isinstance(_partial, dict):
                            if "error" in _partial:
                                _eno = _partial["error"]
                                if isinstance(_eno, dict):
                                    _code = int(_eno.get("code") or 0)
                                    _msg = str(_eno.get("message", _stdout[:120]))
                                else:
                                    _code = 0
                                    _msg = str(_eno)
                                low = _msg.lower()
                                if _code in (401, 403) or "api key" in low or "invalid" in low or "unauthorized" in low:
                                    self._hf_embed_down_until = time.monotonic() + 300
                                    print("[LLM] HuggingFace embedding circuit breaker set (HTTP 401) — skipping HF for 5 minutes")
                                    raise RuntimeError(f"HF embedding auth error (HTTP {_code}): {_msg[:200]}")
                                _body = f"{_body} | body: {_msg[:120]}"
                    except json.JSONDecodeError:
                        pass
                self._hf_embed_down_until = time.monotonic() + 300
                raise RuntimeError(f"HF Inference API connection failed: {_body}")

            try:
                status_code = 200  # curl doesn't separate HTTP status from body
                data = json.loads(proc.stdout or "{}")
            except Exception:
                raise RuntimeError(f"HF Inference API invalid JSON: {(proc.stdout or '')[:200]}")

            vec = None
            if isinstance(data, dict):
                # HF Inference API feature-extraction returns: {"embeddings": [...]} or {"error": "..."}
                if "error" in data and not data.get("embeddings"):
                    # Model loading — only wait when another attempt remains.
                    # With max_retries=1 the old unconditional 3s sleep just
                    # pushed the whole embedding chain past its budget.
                    if "loading" in data.get("error", "").lower():
                        if attempt < max_retries:
                            print(f"HF embed model loading, retry {attempt}/{max_retries}...")
                            time.sleep(min(2.0 * attempt, 3.0))
                            continue
                        raise RuntimeError("HF embed model is loading (try again later)")
                    _err_msg = str(data.get("error", ""))
                    _low = _err_msg.lower()
                    if "401" in str(data) or "api key" in _low or "invalid" in _low or "unauthorized" in _low:
                        self._hf_embed_down_until = time.monotonic() + 300
                        print("[LLM] HuggingFace embedding circuit breaker set (HTTP 401) — skipping HF for 5 minutes")
                        raise RuntimeError(f"HF Inference API auth error: {_err_msg[:200]}")
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

        raise RuntimeError(f"HF Inference API embedding failed after {max_retries} retries")

    def _nvidia_get_embedding(self, text: str, timeout_override: float = None) -> List[float]:
        """Lấy embedding qua NVIDIA NIM (OpenAI-compatible /embeddings).

        Uses curl (OpenSSL TLS) for HF Spaces compatibility — same approach as
        text-generation in llm_service.py._nvidia_generate.
        """
        if not self.has_nvidia_api:
            raise RuntimeError("NVIDIA_API_KEY + NVIDIA_EMBED_MODEL not set — cannot use NVIDIA embedding.")
        import time as _nv_time
        if _nv_time.monotonic() < getattr(self, "_nvidia_embed_down_until", 0.0):
            raise RuntimeError("NVIDIA NIM embeddings temporarily disabled after a network failure.")

        url = f"{self.nvidia_base}/embeddings"
        payload = json.dumps({"model": self.nvidia_embed_model, "input": text}).encode("utf-8")
        _nv_timeout = timeout_override or self.nvidia_timeout

        try:
            proc = subprocess.run(
                ["curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                 "-H", f"Authorization: Bearer {self.nvidia_key}",
                 "-H", "Content-Type: application/json",
                 "-H", "Accept: application/json",
                 "-d", payload.decode("utf-8"),
                 "--connect-timeout", "4",
                 "--max-time", str(_nv_timeout), url],
                capture_output=True, text=True, timeout=_nv_timeout + 2,
            )
        except Exception as e:
            self._nvidia_embed_down_until = _nv_time.monotonic() + 300
            raise RuntimeError(f"NVIDIA embedding connection failed: {type(e).__name__}: {e}")

        if proc.returncode != 0:
            err = (proc.stderr or "").strip()[:200] or f"curl exit {proc.returncode}"
            # Try parsing partial stdout for auth/rate-limit error details.
            _stdout = (proc.stdout or "").strip()
            if _stdout:
                try:
                    _partial = json.loads(_stdout)
                    if isinstance(_partial, dict) and _partial.get("error"):
                        _eno = _partial["error"]
                        if isinstance(_eno, dict):
                            err = f"{err} | body: {str(_eno.get('message', _stdout[:120]))[:120]}"
                except Exception:
                    pass
            self._nvidia_embed_down_until = _nv_time.monotonic() + 300
            raise RuntimeError(f"NVIDIA embedding connection failed: {err}")

        try:
            data = json.loads(proc.stdout or "{}")
        except Exception:
            raise RuntimeError(f"NVIDIA embedding invalid JSON: {(proc.stdout or '')[:200]}")

        if isinstance(data, dict) and data.get("error"):
            err = data.get("error") or {}
            if isinstance(err, dict):
                code = int(err.get("code") or 0)
                message = str(err.get("message") or "")
            else:
                code = 0
                message = str(err)
            if code in (401, 403) or "api key" in message.lower():
                self._nvidia_embed_down_until = _nv_time.monotonic() + 300
                raise RuntimeError(f"NVIDIA embedding auth error (HTTP {code}): {message[:200]}")
            raise RuntimeError(f"NVIDIA embedding API error (HTTP {code}): {message[:200]}")

        try:
            vec = data["data"][0]["embedding"]
        except (KeyError, IndexError, TypeError):
            raise RuntimeError(f"NVIDIA embedding returned unexpected format: {str(data)[:200]}")
        if not isinstance(vec, list) or not vec:
            raise RuntimeError(f"NVIDIA embedding returned empty vector: {str(data)[:200]}")
        return [float(x) for x in vec]

    def _kimi_get_embedding(self, text: str, timeout_override: float = None) -> List[float]:
        """Get embedding from Shanghai AI Lab (01.ai / Kimi) — OpenAI-compatible /embeddings.

        Uses curl (OpenSSL TLS) for HF Spaces compatibility.
        Circuit breaker: 5-min cooldown after 401 or network failure.
        """
        if not self.has_kimi_api:
            raise RuntimeError("KIMI_API_KEY + KIMI_EMBEDDING_MODEL not set — cannot use 01.ai embedding.")
        import time as _ki_time
        if _ki_time.monotonic() < getattr(self, "_kimi_embed_down_until", 0.0):
            raise RuntimeError("01.ai (Kimi) embeddings temporarily disabled (circuit breaker, 5 min cooldown).")

        url = f"{self.kimi_base}/embeddings"
        payload = json.dumps({"model": self.kimi_embed_model, "input": text}).encode("utf-8")
        _ki_timeout = timeout_override or self.kimi_timeout

        try:
            proc = subprocess.run(
                ["curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                 "-H", f"Authorization: Bearer {self.kimi_key}",
                 "-H", "Content-Type: application/json",
                 "-H", "Accept: application/json",
                 "-d", payload.decode("utf-8"),
                 "--connect-timeout", "4",
                 "--max-time", str(_ki_timeout), url],
                capture_output=True, text=True, timeout=_ki_timeout + 2,
            )
        except Exception as e:
            self._kimi_embed_down_until = _ki_time.monotonic() + 300
            raise RuntimeError(f"01.ai embedding connection failed: {type(e).__name__}: {e}")

        if proc.returncode != 0:
            err = (proc.stderr or "").strip()[:200] or f"curl exit {proc.returncode}"
            _stdout = (proc.stdout or "").strip()
            if _stdout:
                try:
                    _partial = json.loads(_stdout)
                    if isinstance(_partial, dict):
                        if "error" in _partial:
                            _eno = _partial["error"]
                            if isinstance(_eno, dict):
                                _msg = str(_eno.get("message", _stdout[:120]))
                                _code = int(_eno.get("code") or 0)
                            else:
                                _msg = str(_eno)
                                _code = 0
                            _low = _msg.lower()
                            if _code in (401, 403) or "api key" in _low or "invalid" in _low or "unauthorized" in _low:
                                self._kimi_embed_down_until = _ki_time.monotonic() + 300
                                raise RuntimeError(f"01.ai embedding auth error (HTTP {_code}): {_msg[:200]}")
                            err = f"{err} | body: {_msg[:120]}"
                except json.JSONDecodeError:
                    pass
            self._kimi_embed_down_until = _ki_time.monotonic() + 300
            raise RuntimeError(f"01.ai embedding connection failed: {err}")

        try:
            data = json.loads(proc.stdout or "{}")
        except Exception:
            raise RuntimeError(f"01.ai embedding invalid JSON: {(proc.stdout or '')[:200]}")

        if isinstance(data, dict) and data.get("error"):
            err = data.get("error") or {}
            if isinstance(err, dict):
                code = int(err.get("code") or 0)
                message = str(err.get("message") or "")
            else:
                code = 0
                message = str(err)
            if code in (401, 403) or "api key" in message.lower() or "invalid" in message.lower():
                self._kimi_embed_down_until = _ki_time.monotonic() + 300
                raise RuntimeError(f"01.ai embedding auth error (HTTP {code}): {message[:200]}")
            if code == 429:
                self._kimi_embed_down_until = _ki_time.monotonic() + 300
                raise RuntimeError(f"01.ai embedding rate-limited (429): {message[:150]}")
            raise RuntimeError(f"01.ai embedding API error (HTTP {code}): {message[:200]}")

        try:
            vec = data["data"][0]["embedding"]
        except (KeyError, IndexError, TypeError):
            raise RuntimeError(f"01.ai embedding returned unexpected format: {str(data)[:200]}")
        if not isinstance(vec, list) or not vec:
            raise RuntimeError(f"01.ai embedding returned empty vector: {str(data)[:200]}")
        return [float(x) for x in vec]

    def _store_embed_cache(self, cache_key: str, vec: List[float]) -> None:
        """Cache a successfully computed embedding with TTL + FIFO-LRU eviction.

        - TTL: entries expire after _embed_cache_ttl seconds (default 30 min),
          preventing stale vectors from dominating long-running chat sessions.
        - FIFO-LRU: when the cache exceeds _embed_cache_max entries (128),
          the oldest insertion-order key is evicted (Python 3.7+ dicts preserve
          insertion order).
        """
        import time

        if not (vec and isinstance(vec, list)):
            return
        # Lazily evict expired entries before inserting (cheap: single time call)
        if len(self._embed_cache) >= self._embed_cache_max:
            now = time.monotonic()
            # Purge expired entries first — this keeps the cache lean under load
            expired = [k for k, ts in self._embed_cache_meta.items() if now - ts > self._embed_cache_ttl]
            for k in expired:
                self._embed_cache.pop(k, None)
                self._embed_cache_meta.pop(k, None)
            # If still over capacity after TTL purge, evict oldest (FIFO)
            while len(self._embed_cache) >= self._embed_cache_max:
                oldest = next(iter(self._embed_cache))
                self._embed_cache.pop(oldest, None)
                self._embed_cache_meta.pop(oldest, None)
        now = time.monotonic()
        self._embed_cache[cache_key] = vec
        self._embed_cache_meta[cache_key] = now

    def get_embedding(self, text: str) -> List[float]:
        if not self.has_api:
            raise RuntimeError("Embedding service chưa sẵn sàng. Cấu hình GEMINI_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, HF_TOKEN, OPENROUTER_API_KEY + OPENROUTER_EMBEDDING_MODEL, hoặc NVIDIA_API_KEY + NVIDIA_EMBED_MODEL để dùng semantic search.")
        if not text:
            return []

        # Fast path: return cached embedding for identical queries.
        # This is the single biggest ChromaDB/LLM optimization for chat —
        # the embedding call is a blocking curl subprocess (5-20s) and
        # the same question is frequently repeated within a session.
        # TTL check ensures stale embeddings (expired after _embed_cache_ttl)
        # are recomputed so we never serve a vector that's potentially outdated.
        import time as _embed_time
        _cache_key = hashlib.md5(text.encode("utf-8")).hexdigest()
        _cached = self._embed_cache.get(_cache_key)
        if _cached is not None:
            _cached_ts = self._embed_cache_meta.get(_cache_key, 0.0)
            if _embed_time.monotonic() - _cached_ts <= self._embed_cache_ttl:
                return _cached
            else:
                # Expired — remove stale entry so the provider is re-queried
                self._embed_cache.pop(_cache_key, None)
                self._embed_cache_meta.pop(_cache_key, None)

        import time
        _embed_start = time.monotonic()
        # Budget for the whole embedding chain. Configurable via env so it can
        # be tuned on HF Spaces without a rebuild. Keep this comfortably below
        # the downstream RAG/HTTP timeouts so chat degrades instead of hanging.
        _EMBED_GLOBAL_TIMEOUT = getattr(self, "embed_global_timeout", 6.0)
        gemini_last_err = None
        cf_last_err = None
        or_last_err = None
        hf_last_err = None
        nvidia_last_err = None
        kimi_last_err = None

        # --- Phan 0: OpenRouter embeddings (primary — reachable from HF Spaces) ---
        _or_remaining = self._embed_remaining(_embed_start)
        if self.has_openrouter_api and time.monotonic() >= getattr(self, "_openrouter_embed_down_until", 0.0):
            if _or_remaining <= 0.5:
                print(f"  [embed] global timeout ({_EMBED_GLOBAL_TIMEOUT}s) reached, skipping OpenRouter embed")
            else:
                try:
                    vec = self._openrouter_get_embedding(text, timeout_override=self._embed_attempt_timeout(_embed_start))
                    vec = [float(x) for x in vec]
                    if self._embed_dim and len(vec) != self._embed_dim:
                        print(f"OpenRouter embed dim {len(vec)} != collection dim {self._embed_dim}, dieu chinh...")
                        if len(vec) > self._embed_dim:
                            vec = vec[:self._embed_dim]
                        else:
                            vec = vec + [0.0] * (self._embed_dim - len(vec))
                    self._embed_dim = len(vec)
                    print(f"  -> OpenRouter embedding OK (dim={len(vec)})")
                    self._store_embed_cache(_cache_key, vec)
                    return vec
                except Exception as e:
                    or_last_err = str(e)
                    print(f"OpenRouter embedding failed: {e}")

        # --- Phan 1: Gemini embeddings (reachable from HF Spaces) ---
        if self.has_gemini_api and time.monotonic() >= self._gemini_embed_down_until:
            if self._embed_remaining(_embed_start) <= 0.5:
                print(f"  [embed] global timeout ({_EMBED_GLOBAL_TIMEOUT}s) reached, skipping Gemini fallback")
            else:
                try:
                    vec = self._gemini_get_embedding(text, timeout_override=self._embed_attempt_timeout(_embed_start))
                    vec = [float(x) for x in vec]
                    if self._embed_dim and len(vec) != self._embed_dim:
                        print(f"Gemini embed dim {len(vec)} != collection dim {self._embed_dim}, dieu chinh...")
                        if len(vec) > self._embed_dim:
                            vec = vec[:self._embed_dim]
                        else:
                            vec = vec + [0.0] * (self._embed_dim - len(vec))
                    self._embed_dim = len(vec)
                    print(f"  -> Gemini embedding OK (dim={len(vec)})")
                    self._store_embed_cache(_cache_key, vec)
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
            # Embedding calls are small/fast; use the shared per-provider budget
            # so each model attempt fails within the global budget, leaving room
            # for Gemini/HF/NVIDIA fallback. Mirrors llm_service._cloudflare_generate.
            _cf_embed_timeout = self._embed_attempt_timeout(_embed_start)

            for model in self.embed_models:
                if self._embed_remaining(_embed_start) <= 0.5:
                    print(f"  [embed] global timeout ({_EMBED_GLOBAL_TIMEOUT}s) reached, stopping Cloudflare embed attempts"); break
                _cf_embed_timeout = self._embed_attempt_timeout(_embed_start)
                # URL-encode @ prefix but PRESERVE / so Cloudflare sees the full
                # model path (@cf/baai/bge-base-en-v1.5). Encoding / as %2F
                # flattens the path → Cloudflare returns "No route for that URI" (code 7000).
                encoded_model = urllib.parse.quote(model, safe='/')
                url = f"{base_url}/{encoded_model}"
                payload = json.dumps({"text": text}).encode("utf-8")
                attempt = 0
                while True:
                    attempt += 1
                    data = None
                    try:
                        # Use curl (OpenSSL TLS) — bypasses Python ssl/urllib IPv6
                        # blackhole on HF Spaces. --ipv4 avoids IPv6 blackhole;
                        # --insecure skips cert verification (HF Spaces may have a
                        # MITM proxy with custom CA). Already proven in
                        # llm_service.py._cloudflare_generate text-generation path.
                        _curl = subprocess.run(
                            ["curl", "--ipv4", "--insecure", "-sS", "-X", "POST",
                             "-H", f"Authorization: Bearer {self.cf_api_token}",
                             "-H", "Content-Type: application/json",
                             "-d", payload.decode("utf-8"),
                             "--connect-timeout", "4",
                             "--max-time", str(_cf_embed_timeout), url],
                            capture_output=True, text=True, timeout=_cf_embed_timeout + 2,
                        )
                        if _curl.returncode == 0 and _curl.stdout.strip():
                            data = json.loads(_curl.stdout)
                        else:
                            _msg = (_curl.stderr or "").strip()[:200] or f"curl exit {_curl.returncode}"
                            # curl can exit non-zero (e.g. timeout code 28) while
                            # still having received a partial response body — try to
                            # parse it so a 401/429/auth error body is surfaced
                            # instead of a generic "curl exit 28".
                            _stdout = (_curl.stdout or "").strip()
                            if _stdout:
                                try:
                                    _partial = json.loads(_stdout)
                                    if isinstance(_partial, dict):
                                        if "error" in _partial:
                                            _eno = _partial["error"]
                                            if isinstance(_eno, dict):
                                                _msg = f"{_msg} | body: {str(_eno.get('message', _stdout[:120]))[:120]}"
                                            else:
                                                _msg = f"{_msg} | body: {str(_eno)[:120]}"
                                        _perr = _partial.get("errors", [])
                                        if isinstance(_perr, list) and _perr:
                                            _perr0 = _perr[0] if isinstance(_perr[0], dict) else {"message": str(_perr[0])}
                                            if isinstance(_perr0, dict):
                                                _msg = f"{_msg} | errors: {str(_perr0.get('message', _stdout[:120]))[:120]}"
                                except Exception:
                                    pass
                            raise urllib.error.URLError(_msg)
                    except FileNotFoundError:
                        print("  curl not found, falling back to urllib.request")
                        req = urllib.request.Request(
                            url, data=payload,
                            headers={"Authorization": f"Bearer {self.cf_api_token}", "Content-Type": "application/json"},
                            method="POST",
                        )
                        _urllib_data = None
                        _urllib_err = None
                        try:
                            with urllib.request.urlopen(req, timeout=_cf_embed_timeout) as resp:
                                _urllib_data = json.loads(resp.read().decode("utf-8"))
                        except urllib.error.HTTPError as e:
                            _body = e.read().decode("utf-8", "ignore")[:300]
                            _low = _body.lower()
                            if e.code in (404, 410) or any(r in _low for r in ("not found", "not supported", "no longer available", "model not found", "could not find", "deprecated", "does not exist")):
                                cf_last_err = f"{model}: HTTP {e.code} {_body[:120]}"; print(f"Cloudflare embed model {model} khong kha dung, thu model ke tiep..."); break
                            if e.code in (401, 403):
                                raise RuntimeError(f"Cloudflare embed auth loi (HTTP {e.code}): {_body[:200]}")
                            if e.code == 429:
                                cf_last_err = f"{model}: HTTP 429 {_body[:80]}"; print(f"Cloudflare embed model {model} bi rate-limit (429), thu model ke tiep..."); break
                            if e.code in (502, 503, 504) and attempt <= per_model_retries:
                                cf_last_err = f"{model}: HTTP {e.code} {_body[:80]}"; print(f"Cloudflare embed model {model} {e.code} (tam thai), retry {attempt}/{per_model_retries}..."); time.sleep(2.0); continue
                            cf_last_err = f"{model}: HTTP {e.code} {_body[:80]}"; print(f"Cloudflare embed model {model} {e.code}, thu model ke tiep..."); break
                        except Exception as e2:
                            if attempt <= per_model_retries:
                                cf_last_err = f"{model}: {e2}"; print(f"Loi ket noi embed {model}, retry {attempt}/{per_model_retries}..."); time.sleep(1.5); continue
                            cf_last_err = f"{model}: {e2}"; print(f"Loi ket noi embed {model}, tam ngung Cloudflare 5 phut.")
                            self._cf_embed_down_until = time.monotonic() + 300
                            cf_network_down = True
                            break
                        data = _urllib_data
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
                        self._store_embed_cache(_cache_key, vec)
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
            if self._embed_remaining(_embed_start) <= 0.5:
                print(f"  [embed] global timeout ({_EMBED_GLOBAL_TIMEOUT}s) reached, skipping HF fallback")
            else:
                try:
                    vec = self._hf_get_embedding(text, timeout_override=self._embed_attempt_timeout(_embed_start))
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
                    self._store_embed_cache(_cache_key, vec)
                    return vec
                except Exception as e:
                    hf_last_err = str(e)
                    print(f"HF Inference API embedding ALSO failed: {e}")

        # --- Phan 3: fallback ve NVIDIA NIM embedding ---
        if self.has_nvidia_api:
            if self._embed_remaining(_embed_start) <= 0.5:
                print(f"  [embed] global timeout ({_EMBED_GLOBAL_TIMEOUT}s) reached, skipping NVIDIA fallback")
            else:
                try:
                    vec = self._nvidia_get_embedding(text, timeout_override=self._embed_attempt_timeout(_embed_start))
                    vec = [float(x) for x in vec]
                    if self._embed_dim and len(vec) != self._embed_dim:
                        print(f"NVIDIA embed dim {len(vec)} != collection dim {self._embed_dim}, dieu chinh...")
                        if len(vec) > self._embed_dim:
                            vec = vec[:self._embed_dim]
                        else:
                            vec = vec + [0.0] * (self._embed_dim - len(vec))
                    self._embed_dim = len(vec)
                    print(f"  -> NVIDIA NIM embedding OK (dim={len(vec)})")
                    self._store_embed_cache(_cache_key, vec)
                    return vec
                except Exception as e:
                    nvidia_last_err = str(e)
                    print(f"NVIDIA NIM embedding ALSO failed: {e}")

        # --- Phan 4: fallback ve 01.ai (Shanghai AI Laboratory) embedding ---
        if getattr(self, "has_kimi_api", False):
            if self._embed_remaining(_embed_start) <= 0.5:
                print(f"  [embed] global timeout ({_EMBED_GLOBAL_TIMEOUT}s) reached, skipping 01.ai fallback")
            else:
                try:
                    vec = self._kimi_get_embedding(text, timeout_override=self._embed_attempt_timeout(_embed_start))
                    vec = [float(x) for x in vec]
                    if self._embed_dim and len(vec) != self._embed_dim:
                        print(f"01.ai embed dim {len(vec)} != collection dim {self._embed_dim}, dieu chinh...")
                        if len(vec) > self._embed_dim:
                            vec = vec[:self._embed_dim]
                        else:
                            vec = vec + [0.0] * (self._embed_dim - len(vec))
                    self._embed_dim = len(vec)
                    print(f"  -> 01.ai (Kimi) embedding OK (dim={len(vec)})")
                    self._store_embed_cache(_cache_key, vec)
                    return vec
                except Exception as e:
                    kimi_last_err = str(e)
                    print(f"01.ai (Kimi) embedding ALSO failed: {e}")

        raise RuntimeError(
            f"Khong the lay embedding (gioi han {_EMBED_GLOBAL_TIMEOUT}s). "
            f"OpenRouter: {or_last_err or ('khong cau hinh' if not self.has_openrouter_api else 'khong kha dung')}, "
            f"Gemini: {gemini_last_err or ('khong cau hinh' if not self.has_gemini_api else 'khong kha dung')}, "
            f"Cloudflare: {cf_last_err or 'khong cau hinh'}, "
            f"HF: {hf_last_err or ('khong cau hinh' if not self.has_hf_api else 'khong kha dung')}, "
            f"NVIDIA: {nvidia_last_err or ('khong cau hinh' if not self.has_nvidia_api else 'khong kha dung')}, "
            f"01.ai: {kimi_last_err or ('khong cau hinh' if not getattr(self, 'has_kimi_api', False) else 'khong kha dung')}"
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

    def embed_document(self, text: str, metadata: Dict, doc_id: str) -> bool:
        """Incrementally embed a SINGLE document into the vector DB.

        This is the automatic-embed hook called when a new book or location is
        created — it avoids the cost of a full re-sync (seed_data) and only
        computes an embedding for the one new document.

        - Uses ``collection.upsert`` so re-embedding an existing doc_id updates
          its embedding + metadata in place (idempotent).
        - Returns True on success, False if the collection is unavailable
          (e.g. ChromaDB not initialised) so callers can degrade gracefully.
        """
        try:
            if not self.collection:
                print("[embed_document] Vector store collection is None — skipping (graceful degradation).")
                return False
            if not self.has_api:
                # No embedding provider configured — upsert without embeddings
                # so the document is at least present for keyword fallback.
                self.collection.upsert(documents=[text], metadatas=[metadata], ids=[doc_id])
                print(f"[embed_document] Upserted '{doc_id}' WITHOUT embeddings (no API key).")
                return True

            embedding = self.get_embedding(text)
            # Dimension guard: pad/truncate to match the collection's pinned dim
            # (set during seed_data or the first successful embed).
            if self._embed_dim and len(embedding) != self._embed_dim:
                print(f"[embed_document] dim {len(embedding)} != collection {self._embed_dim}, adjusting...")
                if len(embedding) > self._embed_dim:
                    embedding = embedding[:self._embed_dim]
                else:
                    embedding = embedding + [0.0] * (self._embed_dim - len(embedding))
            self._embed_dim = len(embedding)

            self.collection.upsert(
                embeddings=[embedding],
                documents=[text],
                metadatas=[metadata],
                ids=[doc_id],
            )
            self._store_embed_cache(hashlib.md5(text.encode("utf-8")).hexdigest(), embedding)
            print(f"[embed_document] Incremental embed OK: '{doc_id}' (dim={len(embedding)}, category={metadata.get('category')})")
            return True
        except Exception as e:
            print(f"[embed_document] Failed to embed '{doc_id}': {e}")
            return False

    def query(self, query_text: str, n_results: int = 3, where: dict = None,
              hybrid: bool = False, hybrid_alpha: float = 0.7):
        """Query ChromaDB with optional metadata filtering and hybrid search.

        Parameters
        ----------
        query_text : str
            The user's search/query string.
        n_results : int
            Number of results to return. If ``None`` or ``<= 0``, an adaptive
            value is computed from the query length so short/ambiguous queries
            (e.g. "học bổng") retrieve more candidates than long specific ones.
        where : dict, optional
            ChromaDB metadata filter (e.g. ``{"category": "scholarship"}``)
            applied server-side — prunes the candidate set *before* ranking
            so we never embed/scan irrelevant documents.
        hybrid : bool
            If ``True``, run a hybrid search: combine **keyword text search**
            (``query_texts``) with **semantic vector search**
            (``query_embeddings``) and merge results weighted by
            ``hybrid_alpha`` (vector weight; ``1 - alpha`` is keyword weight).
            Falls back to pure keyword-only search when no embedding provider
            is configured (``has_api`` is False).
        hybrid_alpha : float
            Weight for semantic results in the merged ranking. 0.0 = pure
            keyword, 1.0 = pure semantic. Defaults to 0.7 (semantic-leaning).

        Returns
        -------
        dict with keys ``documents``, ``metadatas``, ``distances``, ``ids``
        (the ``ids`` list is always present — ChromaDB returns it regardless
        of ``include``).
        """
        try:
            if not self.collection:
                # ChromaDB not initialized (e.g., timeout on startup).
                # Return empty results so RAG degrades gracefully instead of
                # crashing the chat endpoint — the LLM will answer from its
                # own knowledge + conversation history.
                print("Vector store collection is None — returning empty RAG results (graceful degradation).")
                return {"documents": [[]], "metadatas": [[]], "ids": [[]], "distances": [[]]}

            # --- Adaptive n_results: short/ambiguous queries need more candidates ---
            if n_results is None or n_results <= 0:
                text_len = len(query_text.strip()) if query_text else 0
                if text_len < 10:
                    n_results = 5   # e.g. "tìm học bổng"
                elif text_len < 30:
                    n_results = 4
                else:
                    n_results = 3   # long, specific query

            # Cap at collection size to avoid ChromaDB ValueError
            try:
                _total = self.collection.count()
                if n_results > _total:
                    n_results = max(1, _total)
            except Exception:
                pass

            # --- Keyword-only search when no embedding provider is available ---
            if not self.has_api:
                return self.collection.query(
                    query_texts=[query_text], n_results=n_results,
                    include=["documents", "metadatas", "distances"],
                    where=where,
                )

            query_embedding = self.get_embedding(query_text)

            # --- Hybrid search: keyword + semantic, merged by alpha weight ---
            if hybrid:
                # ChromaDB supports query_embeddings + query_texts simultaneously
                # (HYBRID search, chromadb>=0.5.0). If the installed version
                # rejects the combined call, we fall back to vector-only below.
                try:
                    return self.collection.query(
                        query_embeddings=[query_embedding],
                        query_texts=[query_text],
                        n_results=n_results,
                        include=["documents", "metadatas", "distances"],
                        where=where,
                        # hybrid_compose is the chroma>=0.5.0 parameter that
                        # signals "merge results from both query paths".
                        hybrid_compose=hybrid_alpha,
                    )
                except TypeError:
                    # Older chroma version — fall back to vector-only query.
                    return self.collection.query(
                        query_embeddings=[query_embedding], n_results=n_results,
                        include=["documents", "metadatas", "distances"],
                        where=where,
                    )

            # --- Pure semantic search (default) ---
            # Exclude embedding vectors from the result set to halve the
            # ChromaDB→Python payload on every chat turn. Each result
            # embedding is a 384-3072-dim float array — never needed by
            # callers (they only read documents, metadatas, distances).
            # `ids` is always returned by ChromaDB regardless of `include`.
            return self.collection.query(
                query_embeddings=[query_embedding], n_results=n_results,
                include=["documents", "metadatas", "distances"],
                where=where,
            )
        except Exception as e:
            print(f"Error querying vector store: {e}")
            raise

    def semantic_career_search(self, skills: List[str], n_results: int = 3) -> list:
        """Tìm kiếm career paths trong ChromaDB bằng semantic similarity với skill của user.

        Thay thế approach if-else keyword matching trong career.service.ts.
        Trả về danh sách career kèm metadata, match_score (dựa trên distance),
        và missing_skills (skills_required không có trong input).
        """
        import json as _json

        if not self.collection:
            print("Vector store collection is None — semantic search disabled.")
            return []
        if not self.has_api:
            # ChromaDB can still do keyword query without an embedding provider
            query_text = " ".join(skills) if skills else ""
        else:
            query_text = " ".join(skills) if skills else ""
        if not query_text.strip():
            return []

        try:
            # Push the category filter into ChromaDB's `where` clause so the
            # server prunes non-career documents BEFORE ranking — avoids
            # embedding/scanning irrelevant rows (scholarships, wifi, etc.).
            results = self.query(
                query_text,
                n_results=max(n_results, 5),
                where={"category": "career"},
                hybrid=True,
            )
            docs = results.get('documents', [[]])[0] or []
            metas = results.get('metadatas', [[]])[0] or []
            ids = results.get('ids', [[]])[0] or []
            distances = (results.get('distances', [[]])[0] or [])

            user_skills_lower = set(s.lower() for s in (skills or []))

            careers = []
            for i, doc in enumerate(docs):
                meta = metas[i] if i < len(metas) else {}
                # Only include career-path documents
                if meta.get('category') != 'career':
                    continue

                # Parse skills_required from metadata (JSON string or comma-separated)
                skills_required = []
                raw_skills = meta.get('skills_required', '')
                if isinstance(raw_skills, str):
                    try:
                        parsed = _json.loads(raw_skills)
                        if isinstance(parsed, list):
                            skills_required = [str(s).strip() for s in parsed if str(s).strip()]
                        else:
                            skills_required = [s.strip() for s in str(parsed).split(',') if s.strip()]
                    except Exception:
                        skills_required = [s.strip() for s in str(raw_skills).split(',') if s.strip()]
                elif isinstance(raw_skills, list):
                    skills_required = [str(s).strip() for s in raw_skills if str(s).strip()]

                matched = [s for s in skills_required if s.lower() in user_skills_lower]
                missing = [s for s in skills_required if s.lower() not in user_skills_lower]

                # Convert ChromaDB distance to a 0-100 match score.
                # Smaller distance = more similar. Using a sigmoid-like transform.
                dist = distances[i] if i < len(distances) and distances[i] is not None else 0.0
                sim = max(0.0, min(1.0, 1.0 / (1.0 + float(dist)))) if dist > 0 else 0.8
                match_score = int(round(sim * 100))

                # Ensure at least the skill-overlap ratio influences the score
                if skills_required:
                    overlap_ratio = len(matched) / len(skills_required)
                    match_score = int(round(match_score * 0.6 + overlap_ratio * 100 * 0.4))
                    match_score = max(0, min(100, match_score))

                careers.append({
                    'doc_id': ids[i] if i < len(ids) else f'career_{i}',
                    'title': meta.get('title', 'N/A'),
                    'category': meta.get('category', 'career'),
                    'field': meta.get('field', ''),
                    'description': doc[:500],
                    'skills_required': skills_required,
                    'matched_skills': matched,
                    'missing_skills': missing[:5],
                    'match_score': match_score,
                })

            return careers
        except Exception as e:
            print(f"Error in semantic_career_search (graceful fallback): {e}")
            return []

    def search_similar(self, query: str, top_k: int = 2, where: dict = None, hybrid: bool = False) -> list:
        try:
            results = self.query(query, n_results=max(top_k, 3), where=where, hybrid=hybrid)
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
            print(f"Error in search_similar (graceful fallback): {e}")
            return []

vector_store = VectorStoreService()
