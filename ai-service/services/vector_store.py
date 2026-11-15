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


os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")
os.environ.setdefault("CHROMA_TELEMETRY_ENABLED", "False")


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
    """Semantic search over the ChromaDB ``edumap_docs`` collection.

    No embedding provider is configured on this host; vectors are only stored
    and queried when one is added.
    """

    # Default values for every instance, stored on the CLASS so that an object
    # created without __init__ (e.g. object.__new__() — a test artifact) can
    # still read them instead of blowing up with AttributeError.  __init__
    # always re-reads them from env and overwrites them, so production
    # behaviour is identical.  Mutable state (dicts) is created on demand by
    # _store_embed_cache / get_embedding into the instance.
    jina_key = (os.getenv("JINA_API_KEY") or "").strip().strip('"').strip("'")
    jina_base_url = (
        os.getenv("JINA_BASE_URL", "https://api.jina.ai/v1").strip().rstrip("/")
    )
    jina_models = [
        m.strip()
        for m in os.getenv("JINA_EMBEDDING_MODEL", "jina-embeddings-v5-text-small").split(",")
        if m.strip()
    ] or ["jina-embeddings-v5-text-small"]
    jina_timeout = float(os.getenv("JINA_TIMEOUT_SECONDS", "20"))
    has_jina_api = bool(jina_key)

    _jina_embed_down_until = 0.0

    embed_batch_size = int(os.getenv("EMBED_BATCH_SIZE", "32"))
    embed_batch_timeout = float(os.getenv("EMBED_BATCH_TIMEOUT_SECONDS", "20"))

    embed_global_timeout = float(os.getenv("EMBED_GLOBAL_TIMEOUT_SECONDS", "6"))
    embed_provider_timeout = float(os.getenv("EMBED_PROVIDER_TIMEOUT_SECONDS", "4"))

    _embed_dim = None

    _embed_cache_max = int(os.getenv("EMBED_CACHE_MAX", "1024"))
    _embed_cache_ttl = float(os.getenv("EMBED_CACHE_TTL_SECONDS", "1800"))

    collection = None
    _collection_next_retry = 0.0
    _collection_init_attempts = 0

    def __init__(self):

        self.embed_global_timeout = float(os.getenv("EMBED_GLOBAL_TIMEOUT_SECONDS", "6"))
        self.embed_provider_timeout = float(os.getenv("EMBED_PROVIDER_TIMEOUT_SECONDS", "4"))


        self._embed_dim = None


        self._embed_cache: Dict[str, List[float]] = {}
        self._embed_cache_meta: Dict[str, float] = {}


        self._embed_cache_max = int(os.getenv("EMBED_CACHE_MAX", "1024"))


        self._embed_cache_ttl = float(os.getenv("EMBED_CACHE_TTL_SECONDS", "1800"))
        self.jina_key = (os.getenv("JINA_API_KEY") or "").strip().strip('"').strip("'")
        self.jina_base_url = (
            os.getenv("JINA_BASE_URL", "https://api.jina.ai/v1").strip().rstrip("/")
        )
        self.jina_models = [
            m.strip()
            for m in os.getenv(
                "JINA_EMBEDDING_MODEL", "jina-embeddings-v5-text-small"
            ).split(",")
            if m.strip()
        ] or ["jina-embeddings-v5-text-small"]
        self.jina_timeout = float(os.getenv("JINA_TIMEOUT_SECONDS", "20"))
        self.has_jina_api = bool(self.jina_key)
        self._jina_embed_down_until = 0.0
        self.embed_batch_size = max(1, int(os.getenv("EMBED_BATCH_SIZE", "32")))
        self.embed_batch_timeout = float(os.getenv("EMBED_BATCH_TIMEOUT_SECONDS", "20"))

        if self.has_jina_api:
            print(f"INFO: Jina embeddings enabled (models={','.join(self.jina_models)})")
        else:
            print("INFO: Embedding provider not configured — vector store is query-only.")

        print(
            f"INFO: Embedding budget: global={self.embed_global_timeout}s, "
            f"per-provider={self.embed_provider_timeout}s "
            f"(EMBED_GLOBAL_TIMEOUT_SECONDS / EMBED_PROVIDER_TIMEOUT_SECONDS)"
        )


        self.collection = None
        self._collection_next_retry = 0.0
        self._collection_init_attempts = 0


        self._init_collection()


    CHROMA_INIT_TIMEOUT_SECONDS = float(os.getenv("CHROMA_INIT_TIMEOUT_SECONDS", "30"))
    CHROMA_RETRY_SECONDS = float(os.getenv("CHROMA_RETRY_SECONDS", "60"))

    def _init_collection(self) -> bool:
        """Create (or re-create) the ChromaDB client + ``edumap_docs`` collection.

        Called once from ``__init__`` and again lazily from ``_ensure_collection``
        when a later query finds ``self.collection is None``.

        Previously a failed first attempt (15 s SIGALRM on a cold 2-vCPU boot,
        corrupt/stale ``/tmp/chroma_db``, chromadb import error) latched
        ``collection = None`` **for the lifetime of the process** — the host log
        then printed ``Vector store collection is None — returning empty RAG
        results`` on every chat request, so RAG was permanently empty. Retrying
        at most once per ``CHROMA_RETRY_SECONDS`` lets a slow boot recover
        without restarting the Space.

        Returns True when the collection is usable.
        """
        if getattr(self, "collection", None) is not None:
            return True
        if chromadb is None:
            print("ChromaDB module not available. Vector store disabled.")
            return False

        # (getattr-safe: an instance built without __init__ -- tests use
        # object.__new__ -- would not have this attribute yet.)
        self._collection_init_attempts = getattr(self, "_collection_init_attempts", 0) + 1


        self._collection_next_retry = time.monotonic() + self.CHROMA_RETRY_SECONDS

        try:
            import signal as _signal
            import threading


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
        if getattr(self, "collection", None) is not None:
            return True
        if chromadb is None:
            return False
        if time.monotonic() < getattr(self, "_collection_next_retry", 0.0):
            return False
        return self._init_collection()

    @property
    def has_embedding(self) -> bool:
        """True when the Jina embedding API is configured."""
        return bool(getattr(self, "has_jina_api", False))

    def _embed_remaining(self, started: float) -> float:
        """Seconds left in the global embedding budget."""
        return getattr(self, "embed_global_timeout", 6.0) - (time.monotonic() - started)

    def _embed_attempt_timeout(self, started: float) -> float:
        """Per-provider timeout capped by both the provider cap and the
        remaining global budget. Ensures one slow provider cannot starve the
        fallback chain (the original long-timeout bug)."""
        return max(1.5, min(getattr(self, "embed_provider_timeout", 4.0), self._embed_remaining(started)))


    def _fit_dim(self, vec: List[float]) -> List[float]:
        """Return ``vec`` at the collection dimension (truncate or zero-pad)."""
        if not vec:
            return vec
        out = [float(x) for x in vec]
        dim = getattr(self, "_embed_dim", None)
        if dim and len(out) != dim:
            if len(out) > dim:
                out = out[:dim]
            else:
                out = out + [0.0] * (dim - len(out))
        if not dim:
            self._embed_dim = len(out)
        return out

    def _jina_embed_raw(self, inputs: List[str], timeout_override: float = None) -> List[List[float]]:
        """One ``POST /embeddings`` for the whole ``inputs`` batch.

        Returns one vector per input, in request order. Any failure raises so
        the caller can skip the batch without losing the rest of the corpus.
        """
        import subprocess
        import time

        if not self.has_jina_api:
            raise RuntimeError("JINA_API_KEY not set — cannot embed.")
        if time.monotonic() < getattr(self, "_jina_embed_down_until", 0.0):
            raise RuntimeError("Jina embeddings temporarily disabled after a network failure.")
        if not inputs:
            return []

        last_err = None
        for model in self.jina_models:
            url = f"{self.jina_base_url}/embeddings"
            payload = {"model": model, "input": list(inputs)}
            body_json = json.dumps(payload, ensure_ascii=False)
            _timeout = float(timeout_override or self.jina_timeout)

            try:
                proc = subprocess.run(
                    [
                        "curl", "--ipv4", "--insecure", "-sS",
                        "-X", "POST", url,
                        "-H", f"Authorization: Bearer {self.jina_key}",
                        "-H", "Content-Type: application/json",
                        "-d", body_json,
                        "--connect-timeout", "4",
                        "--max-time", str(_timeout),
                    ],
                    capture_output=True,
                    text=True,
                    timeout=_timeout + 2,
                )
            except Exception as e:
                self._jina_embed_down_until = time.monotonic() + 300
                raise RuntimeError(f"Jina embedding connection failed: {type(e).__name__}: {e}")

            if proc.returncode != 0:
                err = (proc.stderr or "").strip()[:200] or f"curl exit {proc.returncode}"
                self._jina_embed_down_until = time.monotonic() + 300
                raise RuntimeError(f"Jina embedding connection failed: {err}")

            try:
                data = json.loads(proc.stdout or "{}")
            except Exception:
                last_err = f"{model}: invalid JSON response: {(proc.stdout or '')[:160]}"
                print(f"Jina model {model} tra ve JSON khong hop le, thu model ke tiep...")
                continue

            if isinstance(data, dict) and data.get("detail"):
                detail = str(data.get("detail"))[:200]
                low = detail.lower()
                if "api key" in low or "unauthorized" in low or "forbidden" in low:
                    self._jina_embed_down_until = time.monotonic() + 300
                    raise RuntimeError(f"Jina embedding auth error: {detail}")
                if "rate limit" in low or "too many" in low:
                    self._jina_embed_down_until = time.monotonic() + 60
                    raise RuntimeError(f"Jina embedding rate limited: {detail}")
                last_err = f"{model}: {detail}"
                print(f"Jina model {model} loi: {detail[:120]}")
                continue

            items = data.get("data") if isinstance(data, dict) else None
            if not isinstance(items, list) or len(items) != len(inputs):
                last_err = f"{model}: expected {len(inputs)} vectors, got {len(items or [])}"
                print(f"Jina model {model} tra ve so luong vector khong khop, thu model ke tiep...")
                continue

            ordered = sorted(items, key=lambda it: it.get("index", 0) if isinstance(it, dict) else 0)
            vectors = []
            for item in ordered:
                vec = item.get("embedding") if isinstance(item, dict) else None
                if not isinstance(vec, list) or not vec:
                    vectors = []
                    break
                vectors.append([float(x) for x in vec])
            if len(vectors) == len(inputs):
                return vectors

            last_err = f"{model}: empty embedding item"
            print(f"Jina model {model} tra ve vector rong, thu model ke tiep...")

        raise RuntimeError(f"Jina embedding failed: {last_err or 'no model available'}")

    def _jina_get_embeddings_batch(self, inputs: List[str], timeout_override: float = None) -> List[List[float]]:
        """Embed a batch of texts (one HTTP request) — used by ``add_documents``."""
        return self._jina_embed_raw(list(inputs), timeout_override=timeout_override)

    def _jina_get_embedding(self, text: str, timeout_override: float = None) -> List[float]:
        """Embed a single text (query path)."""
        vecs = self._jina_embed_raw([text], timeout_override=timeout_override)
        return vecs[0] if vecs else []

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

        _cache = getattr(self, "_embed_cache", None)
        _meta = getattr(self, "_embed_cache_meta", None)
        _max = getattr(self, "_embed_cache_max", 1024)
        _ttl = getattr(self, "_embed_cache_ttl", 1800.0)
        if _cache is None or _meta is None:
            _cache = {}
            _meta = {}
            self._embed_cache = _cache
            self._embed_cache_meta = _meta

        if len(_cache) >= _max:
            now = time.monotonic()

            expired = [k for k, ts in _meta.items() if now - ts > _ttl]
            for k in expired:
                _cache.pop(k, None)
                _meta.pop(k, None)

            while len(_cache) >= _max:
                oldest = next(iter(_cache))
                _cache.pop(oldest, None)
                _meta.pop(oldest, None)
        now = time.monotonic()
        _cache[cache_key] = vec
        _meta[cache_key] = now

    def get_embedding(self, text: str) -> List[float]:
        """Embed ``text`` for a query (cached, single-document)."""
        if not text:
            return []

        if not self.has_embedding:
            raise RuntimeError("Embedding service chưa sẵn sàng. Cấu hình JINA_API_KEY.")

        import time as _embed_time

        _cache_key = hashlib.md5(text.encode("utf-8")).hexdigest()
        _cache = getattr(self, "_embed_cache", None)
        _meta = getattr(self, "_embed_cache_meta", None)
        _cached = _cache.get(_cache_key) if isinstance(_cache, dict) else None
        _cached_ts = (_meta.get(_cache_key, 0.0) if isinstance(_meta, dict) else 0.0)
        if _cached is not None:
            if _embed_time.monotonic() - _cached_ts <= getattr(self, "_embed_cache_ttl", 1800.0):
                return _cached
            if isinstance(_cache, dict):
                _cache.pop(_cache_key, None)
            if isinstance(_meta, dict):
                _meta.pop(_cache_key, None)

        _embed_start = _embed_time.monotonic()
        _EMBED_GLOBAL_TIMEOUT = getattr(self, "embed_global_timeout", 6.0)

        if self._embed_remaining(_embed_start) <= 0.5:
            raise RuntimeError(
                f"Không thể lấy embedding (giới hạn {_EMBED_GLOBAL_TIMEOUT}s)."
            )

        vec = self._jina_get_embedding(
            text, timeout_override=self._embed_attempt_timeout(_embed_start)
        )
        vec = self._fit_dim(vec)
        print(f"  -> Jina embedding OK (dim={len(vec)})")
        self._store_embed_cache(_cache_key, vec)
        return vec


    def add_documents(self, documents: List[str], metadatas: List[Dict], ids: List[str]) -> Dict[str, int]:
        """Upsert documents into ChromaDB in embedding batches.

        Documents are embedded in batches of ``EMBED_BATCH_SIZE`` (default 32)
        — one HTTP request per batch — because the provider bills per request
        on the free tier. A batch that fails is skipped and counted, so one bad
        batch never loses the whole corpus.

        Returns {"added": int, "failed": int, "total": int}.
        """
        total = len(documents)
        stats = {"added": 0, "failed": 0, "total": total}
        try:
            if not self.collection and not self._ensure_collection():
                raise RuntimeError("Vector store collection chưa được khởi tạo.")
            save_fn = getattr(self.collection, "upsert", self.collection.add)

            if not self.has_embedding:
                raise RuntimeError(
                    "Embedding service chưa sẵn sàng — không thể index tài liệu."
                )

            ok_docs, ok_meta, ok_ids, ok_emb = [], [], [], []
            failures = []
            batch_size = max(1, int(getattr(self, "embed_batch_size", 32) or 32))
            for start in range(0, total, batch_size):
                chunk_docs = documents[start:start + batch_size]
                chunk_meta = metadatas[start:start + batch_size]
                chunk_ids = ids[start:start + batch_size]
                try:
                    vectors = self._jina_get_embeddings_batch(
                        chunk_docs, timeout_override=self.embed_batch_timeout
                    )
                except Exception as batch_err:
                    failures.extend(
                        f"{doc_id}: {batch_err}" for doc_id in chunk_ids
                    )
                    print(
                        f"[add_documents] batch {start}-{start + len(chunk_docs)} failed: {batch_err}"
                    )
                    continue
                for doc, meta, doc_id, vec in zip(chunk_docs, chunk_meta, chunk_ids, vectors):
                    ok_emb.append(self._fit_dim(vec))
                    ok_docs.append(doc)
                    ok_meta.append(meta)
                    ok_ids.append(doc_id)

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
                print("[embed_document] No embedding provider — skipping (graceful degradation).")
                return False

            embedding = self._fit_dim(self.get_embedding(text))

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
            is configured (``has_embedding`` is False).
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


                print("Vector store collection is None — returning empty RAG results (graceful degradation).")
                return {"documents": [[]], "metadatas": [[]], "ids": [[]], "distances": [[]]}


            if n_results is None or n_results <= 0:
                text_len = len(query_text.strip()) if query_text else 0
                if text_len < 10:
                    n_results = 5
                elif text_len < 30:
                    n_results = 4
                else:
                    n_results = 3


            try:
                _total = self.collection.count()
                if n_results > _total:
                    n_results = max(1, _total)
            except Exception:
                pass


            if not self.has_embedding:
                return self.collection.query(
                    query_texts=[query_text], n_results=n_results,
                    include=["documents", "metadatas", "distances"],
                    where=where,
                )

            query_embedding = self.get_embedding(query_text)


            if hybrid:


                try:
                    _results = self.collection.query(
                        query_embeddings=[query_embedding],
                        query_texts=[query_text],
                        n_results=n_results,
                        include=["documents", "metadatas", "distances"],
                        where=where,


                        hybrid_compose=hybrid_alpha,
                    )
                except TypeError:

                    _results = self.collection.query(
                        query_embeddings=[query_embedding], n_results=n_results,
                        include=["documents", "metadatas", "distances"],
                        where=where,
                    )


                return _results


            _results = self.collection.query(
                query_embeddings=[query_embedding], n_results=n_results,
                include=["documents", "metadatas", "distances"],
                where=where,
            )


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

        if not getattr(self, "collection", None) and not self._ensure_collection():
            print("Vector store collection is None — semantic search disabled.")
            return []
        query_text = " ".join(skills) if skills else ""
        if not query_text.strip():
            return []

        try:


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

                if meta.get('category') != 'career':
                    continue


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


                dist = distances[i] if i < len(distances) and distances[i] is not None else 0.0
                sim = max(0.0, min(1.0, 1.0 / (1.0 + float(dist)))) if dist > 0 else 0.8
                match_score = int(round(sim * 100))


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
