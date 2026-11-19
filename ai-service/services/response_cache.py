"""In-process TTL cache for deterministic, CPU-bound AI endpoints.

The container runs on the free plan (1 vCPU). Endpoints such as
``/api/ai/data/gaps`` and ``/api/ai/resource/optimize`` recompute a grid /
MCLP over ~2000 POIs and take 10-17 s. Their result depends only on the request
body, so identical calls are answered from memory after the first one.

No Redis is required (``services/cache_service.py`` degrades to disabled
without it); this is a plain dict with expiry, bounded by ``MAX_ENTRIES``.
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Dict, Optional

DEFAULT_TTL_SECONDS = 24 * 3600
MAX_ENTRIES = 128

_store: Dict[str, Any] = {}


def key_for(tag: str, payload: Any) -> str:
    """Deterministic key from an endpoint tag + the request payload."""
    raw = json.dumps(payload, default=str, sort_keys=True)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"{tag}:{digest}"


def get(key: str) -> Optional[Any]:
    """Return the cached value, or ``None`` when missing/expired."""
    entry = _store.get(key)
    if not entry:
        return None
    expires, value = entry
    if time.time() > expires:
        _store.pop(key, None)
        return None
    return value


def set(key: str, value: Any, ttl: int = DEFAULT_TTL_SECONDS) -> None:
    """Store ``value`` under ``key`` for ``ttl`` seconds."""
    if len(_store) >= MAX_ENTRIES:
        now = time.time()
        for stale in [k for k, (exp, _) in _store.items() if exp < now]:
            _store.pop(stale, None)
        if len(_store) >= MAX_ENTRIES:
            _store.clear()
    _store[key] = (time.time() + ttl, value)


def mark_hit(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Copy a cached payload with ``metadata.cached = True`` (stored copy is
    left untouched)."""
    result = dict(payload)
    meta = dict(result.get("metadata") or {})
    meta["cached"] = True
    result["metadata"] = meta
    return result


def clear() -> None:
    _store.clear()