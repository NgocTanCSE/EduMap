import os
import json
import time
import threading
import hashlib
import subprocess
import urllib.request
import urllib.error
import urllib.parse
from typing import List, Dict, Optional, Any

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
except ImportError as e:
    print(f"ChromaDB import failed: {type(e).__name__}: {e}")
    chromadb = None
except Exception as e:
    print(f"ChromaDB import failed (non-ImportError): {type(e).__name__}: {e}")
    chromadb = None


class VectorStoreService:
    """Semantic search. Cloudflare Workers AI + Google Gemini for embeddings.

    - Embedding -> Cloudflare Workers AI : CLOUDFLARE_API_TOKEN / CLOUDFLARE_EMBEDDING_MODEL
    - Embedding -> Google Gemini       : GEMINI_API_KEY / GEMINI_EMBEDDING_MODEL
    On HF Spaces Cloudflare is blackholed so Gemini is the primary path.
    """

    # Mutex to prevent the seeding thread and the staggered-warmup thread
    # from double-loading the ~600MB embedding model + ~100MB reranker
    # simultaneously (which would spike RAM and OOM on the 2-vCPU free tier).
    # Class-level (not instance-level) so it's always available even when
    # __init__ is bypassed in tests (object.__new__ pattern).
    _model_load_lock: threading.Lock = threading.Lock()

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
        # --- Embedding timeouts (seconds) — must stay below NestJS 10s stream ---
        self.embed_global_timeout = float(os.getenv("EMBED_GLOBAL_TIMEOUT_SECONDS", "6"))
        self.embed_provider_timeout = float(os.getenv("EMBED_PROVIDER_TIMEOUT_SECONDS", "4"))
        # --- Embedding provider summary ---
        # Cloudflare Workers AI and Google Gemini are the primary two embedding
        # providers. On HF Spaces Cloudflare is blackholed so Gemini is the
        # primary path; locally both are available.
        # has_api = True if at least one embedding provider is configured
        self.has_api = self.has_gemini_api or self.has_cf_api
        # Pin the embedding dimension to the first model that successfully embeds.
        # Prevents silently falling back to a different-dim model, which would
        # crash the existing ChromaDB collection with a dimension mismatch.
        self._embed_dim = None
        # --- Local embedding model (100% offline fallback) ---
        # intfloat/multilingual-e5-small runs locally on CPU. This is the
        # GUARANTEED fallback — when Cloudflare AND Gemini are both unreachable
        # (no API keys, HF Spaces network blackhole, quota exhausted), the
        # local SentenceTransformer model takes over so RAG never returns empty.
        # Lazy-loaded on first use via _load_local_embedder().
        # Env-tunable: LOCAL_EMBEDDING_MODEL (default: intfloat/multilingual-e5-small)
        #            : LOCAL_EMBEDDING_DISABLED=true to skip local embedder
        #            : LOCAL_EMBEDDING_THREADS=1 (limit CPU threads on HF 2-vCPU)
        self.local_embed_model_name = os.getenv(
            "LOCAL_EMBEDDING_MODEL", "intfloat/multilingual-e5-small"
        )
        self.local_embedding_disabled = os.getenv(
            "LOCAL_EMBEDDING_DISABLED", "false"
        ).lower() in ("1", "true", "yes", "on")
        self.local_embed_threads = int(os.getenv("LOCAL_EMBEDDING_THREADS", "1"))
        self._local_embedder = None  # lazy-loaded singleton
        self._local_embedder_loaded = False
        self._local_embedder_failed = False
        # The local model always produces 768-dim vectors (multilingual-e5-small).
        # If the collection is already seeded with a different dimension from
        # Gemini/Cloudflare, we pad/truncate to match at the call site.
        self.local_embed_dim = 768
        # LRU + TTL cache for embeddings: avoid re-computing the (slow) curl/subprocess
        # embedding call for identical queries. Repeated chat questions like
        # "tìm học bổng" or "lộ trình học AI" would otherwise burn 5-20s on
        # every turn. Keys are md5(text); values are (vector, timestamp) tuples.
        self._embed_cache: Dict[str, List[float]] = {}
        self._embed_cache_meta: Dict[str, float] = {}  # cache_key -> insert timestamp
        # Expanded from 128 → 1024 to leverage the ~10GB free RAM on HF Spaces.
        # 1024 entries × 768 dims × 4 bytes ≈ 3 MB — negligible RAM cost.
        self._embed_cache_max = int(os.getenv("EMBED_CACHE_MAX", "1024"))
        # TTL in seconds: cached embeddings expire after 30 minutes to prevent
        # stale vectors from dominating long-running chat sessions. The LRU
        # eviction (FIFO by insertion order) remains as the secondary guard.
        self._embed_cache_ttl = float(os.getenv("EMBED_CACHE_TTL_SECONDS", "1800"))
        if not self.has_api and not self.local_embedding_disabled:
            # Even with no external API, the local model keeps RAG functional.
            print("INFO: No external embedding API configured — will use local SentenceTransformer model as fallback.")
        elif not self.has_api and self.local_embedding_disabled:
            print("WARNING: Vector store without any embeddings (no API keys + local disabled). Set GEMINI_API_KEY or enable LOCAL_EMBEDDING_DISABLED=false.")
        if self.has_gemini_api:
            print(f"INFO: Gemini embeddings enabled with models={','.join(self.gemini_embedding_models)}")
        if not os.getenv("CLOUDFLARE_EMBEDDING_MODEL"):
            print("WARNING: CLOUDFLARE_EMBEDDING_MODEL not set -> default @cf/baai/bge-base-en-v1.5")
        print(
            f"INFO: Embedding budget: global={self.embed_global_timeout}s, "
            f"per-provider={self.embed_provider_timeout}s "
            f"(EMBED_GLOBAL_TIMEOUT_SECONDS / EMBED_PROVIDER_TIMEOUT_SECONDS)"
        )
        print(
            f"INFO: Local embedding fallback: "
            f"model={self.local_embed_model_name}, "
            f"disabled={self.local_embedding_disabled}, "
            f"threads={self.local_embed_threads}, "
            f"dim={self.local_embed_dim}"
        )

        # --- Local reranker (cross-encoder, CPU, 100% offline) ---
        # cross-encoder/ms-marco-MiniLM-L6-v2 (~80MB, ~100MB RAM on CPU).
        # Improves RAG relevance by 15-30% when cosine-similarity results from
        # ChromaDB are returned in a suboptimal order (common with local
        # embeddings that have slightly different distributions than Gemini).
        # Lazily loaded like the embedding model; skipped if loading fails.
        # Env-tunable: LOCAL_RERANKER_MODEL, LOCAL_RERANKER_DISABLED,
        # LOCAL_RERANKER_THRESHOLD (min score to keep; default 0.0 = keep all)
        self.local_reranker_model_name = os.getenv(
            "LOCAL_RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L6-v2"
        )
        self.local_reranker_disabled = os.getenv(
            "LOCAL_RERANKER_DISABLED", "false"
        ).lower() in ("1", "true", "yes", "on")
        self.local_reranker_threshold = float(
            os.getenv("LOCAL_RERANKER_THRESHOLD", "0.0")
        )
        self._local_reranker = None
        self._local_reranker_loaded = False
        self._local_reranker_failed = False

        # --- ChromaDB collection (optional; not required for get_embedding) ---
        self.collection = None
        self._collection_next_retry = 0.0
        self._collection_init_attempts = 0
        # Mutex to prevent the seeding thread and the staggered-warmup thread
        # from double-loading the ~600MB embedding model + ~100MB reranker
        # simultaneously. Defined as a class attribute above; not re-set here
        # so that `object.__new__` test instances inherit the class-level lock.
        self._init_collection()

    # ChromaDB init knobs (HF Spaces free tier boot can be slow: chromadb import
    # + persistent client + collection creation on 2 vCPU).
    CHROMA_INIT_TIMEOUT_SECONDS = float(os.getenv("CHROMA_INIT_TIMEOUT_SECONDS", "30"))
    CHROMA_RETRY_SECONDS = float(os.getenv("CHROMA_RETRY_SECONDS", "60"))

    def _init_collection(self) -> bool:
        """Create (or re-create) the ChromaDB client + ``edumap_docs`` collection.

        Called once from ``__init__`` and again lazily from ``_ensure_collection``
        when a later query finds ``self.collection is None``.

        Previously a failed first attempt (15 s SIGALRM on a cold 2-vCPU boot,
        corrupt/stale ``/tmp/chroma_db``, chromadb import error) latched
        ``collection = None`` **for the lifetime of the process** — the HF log
        then printed ``Vector store collection is None — returning empty RAG
        results`` on every chat request, so RAG was permanently empty. Retrying
        at most once per ``CHROMA_RETRY_SECONDS`` lets a slow boot recover
        without restarting the Space.

        Returns True when the collection is usable.
        """
        if self.collection is not None:
            return True
        if chromadb is None:
            print("ChromaDB module not available. Vector store disabled.")
            return False

        self._collection_init_attempts += 1
        # Cooldown: never retry more often than CHROMA_RETRY_SECONDS (a retry
        # under load is what the SIGALRM guard exists to prevent).
        self._collection_next_retry = time.monotonic() + self.CHROMA_RETRY_SECONDS

        try:
            import signal as _signal
            import threading

            # signal.SIGALRM only works in the main thread. When the AI service
            # is imported from a worker thread (tests, scripts), installing the
            # handler raises ValueError and used to abort initialization — so
            # only arm the alarm in the main thread.
            use_alarm = threading.current_thread() is threading.main_thread()
            if use_alarm:
                def _chroma_timeout_handler(signum, frame):
                    raise TimeoutError(
                        "ChromaDB initialization exceeded "
                        f"{self.CHROMA_INIT_TIMEOUT_SECONDS:.0f}s — likely stale/corrupt data files."
                    )

                _signal.signal(_signal.SIGALRM, _chroma_timeout_handler)
                _signal.alarm(int(self.CHROMA_INIT_TIMEOUT_SECONDS))
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
                if use_alarm:
                    _signal.alarm(0)
        except Exception as e:
            print(
                f"Vector store initialization failed: {e} "
                f"(attempt {self._collection_init_attempts}, retry in {self.CHROMA_RETRY_SECONDS:.0f}s)"
            )
            self.collection = None
            return False
        return True

    def _ensure_collection(self) -> bool:
        """Lazily (re)initialize ChromaDB if the first attempt failed."""
        if self.collection is not None:
            return True
        if chromadb is None:
            return False
        if time.monotonic() < getattr(self, "_collection_next_retry", 0.0):
            return False
        return self._init_collection()

    @property
    def has_embedding(self) -> bool:
        """True if ANY embedding path is available (external API OR local model).

        Unlike ``has_api`` (which only checks external APIs), this also
        considers the local SentenceTransformer fallback. Methods that gate
        on ``has_api`` should use ``has_embedding`` so they don't bail out
        when only the local model is available.

        Uses getattr() with defaults so that partially-constructed mock objects
        (e.g. in tests via object.__new__) don't raise AttributeError.
        """
        if getattr(self, "has_api", False):
            return True
        _disabled = getattr(self, "local_embedding_disabled", False)
        _failed = getattr(self, "_local_embedder_failed", False)
        return not _disabled and not _failed

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
        fallback chain (the original long-timeout bug)."""
        return max(1.5, min(getattr(self, "embed_provider_timeout", 4.0), self._embed_remaining(started)))


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
        if not text:
            return []

        # If NO embedding path is available at all (no external API + local
        # disabled or failed), raise with a clear message. Note: the local
        # SentenceTransformer fallback is handled later in this method, so
        # we only raise here when has_embedding (external OR local) is False.
        if not self.has_embedding:
            raise RuntimeError("Embedding service chưa sẵn sàng. Cấu hình GEMINI_API_KEY (primary), CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, hoặc bật local embedding (LOCAL_EMBEDDING_DISABLED=false).")
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
        cf_last_err = None
        gemini_last_err = None

        # --- Cloudflare Workers AI embeddings (primary) ---
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
            # for Gemini fallback. Mirrors llm_service._cloudflare_generate.
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

        # --- Google Gemini embeddings (fallback — reachable from HF Spaces) ---
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

        # --- Local embedding fallback (SentenceTransformer, 100% offline) ---
        # This is the GUARANTEED backup: runs on CPU with no API key. When both
        # Cloudflare and Gemini are unreachable (common on HF Spaces free tier
        # without secrets, or during outages), this keeps RAG semantic search
        # alive. Model is lazy-loaded on first use (~30s one-time cost + ~300MB RAM).
        # Uses getattr for resilience with partially-constructed mock objects
        # (e.g. in tests that exercise only the provider cascade).
        if not getattr(self, "local_embedding_disabled", False):
            local_vec = self._local_get_embedding(text, _cache_key)
            if local_vec is not None:
                print(f"  -> Local SentenceTransformer embedding OK (dim={len(local_vec)})")
                return local_vec

        raise RuntimeError(
            f"Khong the lay embedding (gioi han {_EMBED_GLOBAL_TIMEOUT}s). "
            f"Cloudflare: {cf_last_err or ('khong cau hinh' if not self.has_cf_api else 'khong kha dung')}, "
            f"Gemini: {gemini_last_err or ('khong cau hinh' if not self.has_gemini_api else 'khong kha dung')}"
        )

    # ── Local embedding fallback (100% offline, no API key needed) ─────────
    # intfloat/multilingual-e5-small runs on CPU. Lazy-loaded once and cached
    # as a singleton so the ~30s model load + ~300MB RAM only happens on the
    # first fallback, not at every request. This guarantees embeddings work
    # even when ALL external APIs (Cloudflare + Gemini) are unreachable on
    # HF Spaces — RAG never returns empty, per AGENTS.md "never 502s" rule.

    def _load_local_embedder(self):
        """Lazily load and cache the SentenceTransformer model (singleton).

        Returns the model instance or None if loading fails. On failure, sets
        ``_local_embedder_failed`` so subsequent calls skip the expensive retry.
        Uses getattr() for resilience with partially-constructed mock objects.
        Thread-safe via ``_model_load_lock`` — prevents the seeding thread and
        the staggered-warmup thread from loading the same ~600 MB model twice.
        """
        with self._model_load_lock:
            if self._local_embedder is not None:
                return self._local_embedder
        if getattr(self, "_local_embedder_failed", False):
            return None
        if getattr(self, "local_embedding_disabled", False):
            return None
        try:
            from sentence_transformers import SentenceTransformer
            import torch as _torch
            # Limit CPU threads to avoid starving the FastAPI/NestJS processes.
            # HF Spaces free plan = 2 vCPU; reserve 1 for web serving.
            _torch.set_num_threads(self.local_embed_threads)
            print(f"  [embed] Loading local model {self.local_embed_model_name} ...")
            self._local_embedder = SentenceTransformer(self.local_embed_model_name)
            self._local_embedder_loaded = True
            self._embed_dim = self._embed_dim or self.local_embed_dim
            print(f"  -> Local embedding model loaded (dim={self.local_embed_dim})")
            return self._local_embedder
        except Exception as e:
            print(f"  [embed] Local model load FAILED: {type(e).__name__}: {e}")
            self._local_embedder_failed = True
            return None

    def _local_get_embedding(self, text: str, cache_key: str) -> Optional[List[float]]:
        """Get embedding from local SentenceTransformer model (offline fallback).

        Returns a 768-dim list[float] or None if the model cannot be loaded/used.
        Results are cached in the shared _embed_cache so repeated queries
        (same md5 key) don't hit the model again.
        """
        import time as _local_time

        model = self._load_local_embedder()
        if model is None:
            return None

        try:
            # SentenceTransformer returns np.ndarray; convert to list[float].
            # normalize_embeddings=True for cosine-similarity compatibility with
            # the ChromaDB collection that was seeded by Gemini (gemini-embedding-001
            # returns L2-normalized vectors by default).
            vec = model.encode(text, normalize_embeddings=True)
            vec = [float(x) for x in vec]

            # Dimension guard: pad/truncate to match the collection's pinned dim.
            if self._embed_dim and len(vec) != self._embed_dim:
                if len(vec) > self._embed_dim:
                    vec = vec[:self._embed_dim]
                else:
                    vec = vec + [0.0] * (self._embed_dim - len(vec))
            self._embed_dim = self._embed_dim or len(vec)

            # Cache this result (TTL + LRU eviction via _store_embed_cache)
            self._store_embed_cache(cache_key, vec)
            print(f"  -> Local embedding OK (dim={len(vec)}, source=local_model)")
            return vec
        except Exception as e:
            print(f"  [embed] Local model inference failed: {type(e).__name__}: {e}")
            return None

    # ── Local reranker (cross-encoder, CPU, 100% offline) ──────────────────
    # cross-encoder/ms-marco-MiniLM-L6-v2 re-ranks top-k ChromaDB results by
    # computing a cross-attention relevance score between [query × doc]. This
    # improves precision by 15-30% over pure cosine similarity, especially when
    # using local embeddings whose distribution differs from Gemini's.

    def _load_local_reranker(self):
        """Lazily load and cache the cross-encoder reranker (singleton).

        Returns the model instance or None if loading fails/disabled.
        RAM: ~100MB. Download: ~80MB (cached by huggingface_hub on disk).
        Uses getattr() for resilience with partially-constructed mock objects.
        Thread-safe via ``_model_load_lock``.
        """
        with self._model_load_lock:
            if self._local_reranker is not None:
                return self._local_reranker
        if getattr(self, "_local_reranker_failed", False):
            return None
        if getattr(self, "local_reranker_disabled", False):
            return None
        try:
            from sentence_transformers import CrossEncoder
            print(f"  [rerank] Loading local reranker {self.local_reranker_model_name} ...")
            self._local_reranker = CrossEncoder(self.local_reranker_model_name)
            self._local_reranker_loaded = True
            print(f"  -> Local reranker loaded (model={self.local_reranker_model_name})")
            return self._local_reranker
        except Exception as e:
            print(f"  [rerank] Local reranker load FAILED: {type(e).__name__}: {e}")
            self._local_reranker_failed = True
            return None

    def _warmup_local_embedding(self):
        """Pre-load the local embedding model (no-op if disabled or already loaded)."""
        if getattr(self, "local_embedding_disabled", False):
            print("[warmup] Local embedding disabled — skipping warmup")
            return
        if getattr(self, "_local_embedder_loaded", False):
            print("[warmup] Local embedding already loaded")
            return
        self._load_local_embedder()

    def _warmup_local_reranker(self):
        """Pre-load the local reranker (no-op if disabled or already loaded)."""
        if getattr(self, "local_reranker_disabled", False):
            print("[warmup] Local reranker disabled — skipping warmup")
            return
        if getattr(self, "_local_reranker_loaded", False):
            print("[warmup] Local reranker already loaded")
            return
        self._load_local_reranker()

    def rerank_results(
        self, query: str, results: Dict[str, Any], top_k: int = 5
    ) -> Dict[str, Any]:
        """Re-rank ChromaDB query results using the local cross-encoder.

        Args:
            query: The user's query string.
            results: The dict returned by ChromaDB's collection.query() —
                must contain "documents", "metadatas", "ids", "distances".
            top_k: Number of top results to return after re-ranking.

        Returns:
            Same dict structure but with entries re-ordered by reranker score.
            If the reranker fails to load, returns results unchanged (graceful).
        """
        if not results or not results.get("documents"):
            return results

        docs_list = results.get("documents", [[]])
        if not docs_list or not docs_list[0]:
            return results

        docs = docs_list[0]
        if len(docs) <= 1:
            return results  # nothing to re-rank

        reranker = self._load_local_reranker()
        if reranker is None:
            return results  # graceful: return original order

        try:
            # Cross-encoder scores: [(doc, score), ...]
            pairs = [(query, doc) for doc in docs]
            scores = reranker.predict(pairs)  # list of floats

            # Build (index, score) tuples, sort descending, take top_k
            ranked = sorted(
                enumerate(scores), key=lambda x: float(x[1]), reverse=True
            )[:top_k]

            # Reconstruct the result dict with re-ordered entries.
            # ChromaDB returns ids/documents/metadatas as list-of-lists (one
            # inner list per query), but we also handle flat lists for robustness.
            ranked_indices = [i for i, _ in ranked]
            docs = docs_list[0]
            new_docs = [[docs[i] for i in ranked_indices]]

            _metas_raw = results.get("metadatas", [])
            if _metas_raw and isinstance(_metas_raw[0], list):
                _metas_flat = _metas_raw[0]
            else:
                _metas_flat = _metas_raw
            new_metas = [[_metas_flat[i] for i in ranked_indices]] if _metas_flat else [[]]

            _ids_raw = results.get("ids", [])
            if _ids_raw and isinstance(_ids_raw[0], list):
                _ids_flat = _ids_raw[0]
            else:
                _ids_flat = _ids_raw
            new_ids = [_ids_flat[i] for i in ranked_indices] if _ids_flat else []

            new_dist = [float(s) for _, s in ranked]  # reranker score as new distance

            return {
                "documents": new_docs,
                "metadatas": new_metas,
                "ids": new_ids,
                "distances": new_dist,
            }
        except Exception as e:
            print(f"  [rerank] Failed to re-rank: {type(e).__name__}: {e}")
            return results  # graceful: return original order

    def add_documents(self, documents: List[str], metadatas: List[Dict], ids: List[str]) -> Dict[str, int]:
        """Upsert documents into ChromaDB, tolerating per-document failures.

        Previous behaviour embedded the WHOLE batch in one list comprehension,
        so a single slow/unavailable embedding provider lost every document and
        `seed_data()` reported `0 documents, status=error` (observed on HF
        Spaces free tier). Now each document is embedded independently:
        documents whose embedding succeeds are stored, failures are skipped and
        counted, and the caller can report an honest partial sync.

        Returns {"added": int, "failed": int, "total": int}.
        """
        total = len(documents)
        stats = {"added": 0, "failed": 0, "total": total}
        try:
            if not self.collection and not self._ensure_collection():
                raise RuntimeError("Vector store collection chưa được khởi tạo.")
            save_fn = getattr(self.collection, "upsert", self.collection.add)

            if not self.has_embedding:
                save_fn(documents=documents, metadatas=metadatas, ids=ids)
                stats["added"] = total
                return stats

            ok_docs, ok_meta, ok_ids, ok_emb = [], [], [], []
            failures = []
            for doc, meta, doc_id in zip(documents, metadatas, ids):
                try:
                    ok_emb.append(self.get_embedding(doc))
                    ok_docs.append(doc)
                    ok_meta.append(meta)
                    ok_ids.append(doc_id)
                except Exception as doc_err:  # noqa: BLE001 - per-document isolation
                    failures.append(f"{doc_id}: {doc_err}")
                    print(f"[add_documents] skipped '{doc_id}': {doc_err}")

            if ok_docs:
                save_fn(documents=ok_docs, embeddings=ok_emb, metadatas=ok_meta, ids=ok_ids)
            stats["added"] = len(ok_docs)
            stats["failed"] = len(failures)
            if failures:
                print(
                    f"[add_documents] partial sync: {stats['added']}/{total} stored, "
                    f"{stats['failed']} skipped (embedding unavailable)"
                )
            return stats
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
            if not self.collection and not self._ensure_collection():
                print("[embed_document] Vector store collection is None — skipping (graceful degradation).")
                return False
            if not self.has_embedding:
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
            if not self.collection and not self._ensure_collection():
                # ChromaDB still not initialized (cold-boot timeout, corrupt
                # /tmp state, chromadb missing). Return empty results so RAG
                # degrades gracefully instead of crashing the chat endpoint —
                # the LLM will answer from its own knowledge + conversation
                # history. `_ensure_collection()` retries at most once per
                # CHROMA_RETRY_SECONDS so a slow boot can recover.
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
            if not self.has_embedding:
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
                    _results = self.collection.query(
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
                    _results = self.collection.query(
                        query_embeddings=[query_embedding], n_results=n_results,
                        include=["documents", "metadatas", "distances"],
                        where=where,
                    )

                # Local reranker (cross-encoder) for hybrid results too
                if not getattr(self, "local_reranker_disabled", False):
                    _results = self.rerank_results(query_text, _results, top_k=n_results)

                return _results

            # --- Pure semantic search (default) ---
            # Exclude embedding vectors from the result set to halve the
            # ChromaDB→Python payload on every chat turn. Each result
            # embedding is a 384-3072-dim float array — never needed by
            # callers (they only read documents, metadatas, distances).
            # `ids` is always returned by ChromaDB regardless of `include`.
            _results = self.collection.query(
                query_embeddings=[query_embedding], n_results=n_results,
                include=["documents", "metadatas", "distances"],
                where=where,
            )

            # --- Local reranker (cross-encoder, CPU, 100% offline) ---
            # Re-ranks the semantic results to improve precision by 15-30%.
            # Skips entirely if the reranker model fails to load (graceful).
            if not getattr(self, "local_reranker_disabled", False):
                _results = self.rerank_results(query_text, _results, top_k=n_results)

            return _results
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

        if not self.collection and not self._ensure_collection():
            print("Vector store collection is None — semantic search disabled.")
            return []
        if not self.has_embedding:
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
