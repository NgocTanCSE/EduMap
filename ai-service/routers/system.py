"""AI service system status router — /api/ai/system/status

Provides RAM monitoring and provider chain status for OOM guard +
observability. No local models are loaded anymore — AI answers come from
remote APIs (DeepSeek / Gemini / Cloudflare) or template fallbacks.
"""
import subprocess
import json
import time

from fastapi import APIRouter
from typing import Dict, Any

from services.llm_service import llm_service
from services.vector_store import vector_store
from utils.memory_guard import _get_ram_info, check_oom, OOM_STATUS, RAM_THRESHOLD_GB

router = APIRouter(tags=["system"])

# Reachability results: URL -> (status_code, monotonic timestamp).
_reachable_cache: Dict[str, tuple] = {}
_REACHABLE_CACHE_TTL = 60.0


def _endpoint_reachable(url, timeout: float = 4.0) -> int:
    """Return the HTTP status code (or 0) of a GET, via curl --ipv4.

    Mirrors the provider chain (curl --ipv4 --insecure), so the value reported
    here is what the real AI flows actually experience on this host.

    Result is cached for ``CACHE_TTL`` seconds so a status request never adds
    a full network round-trip (unreachable hosts time out, which is slow).
    """
    import time as _time

    cache_key = url
    cached = _reachable_cache.get(cache_key)
    if cached is not None and _time.monotonic() - cached[1] < _REACHABLE_CACHE_TTL:
        return cached[0]
    try:
        proc = subprocess.run(
            ["curl", "--ipv4", "--insecure", "-sS", "-m", str(int(timeout)), "-o", "/dev/null", "-w", "%{http_code}", url],
            capture_output=True, text=True, timeout=timeout + 2,
        )
        code = (proc.stdout or "0").strip()
        result = int(code) if code and code.isdigit() else 0
    except Exception:
        result = 0
    _reachable_cache[cache_key] = (result, _time.monotonic())
    return result


@router.get("/api/ai/system/status")
async def system_status() -> Dict[str, Any]:
    """Full system status: RAM, loaded models, provider chain, OOM guard."""
    ram = _get_ram_info()


    models = {
        "embedding_model": {
            "note": "Embeddings come from Gemini/Cloudflare API — no local model now"
        },
        "reranker_model": {
            "note": "Reranking no longer used — ChromaDB returns results unchanged"
        },
    }


    _cf_url = (
        "https://api.cloudflare.com/client/v4/accounts/"
        f"{getattr(vector_store, 'cf_account_id', '')}/ai/run/@cf/baai/bge-base-en-v1.5"
    )
    _cf_reachable = _endpoint_reachable(_cf_url) if vector_store.has_cf_api else 0

    providers = {
        "deepseek": {
            "configured": bool(getattr(llm_service, "has_deepseek", False)),
            "model": getattr(llm_service, "deepseek_model_name", None),
            "reachable": _endpoint_reachable("https://api.deepseek.com/") if llm_service.has_deepseek else 0,
            "note": "Primary text generation (set DEEPSEEK_API_KEY as host secret)",
        },
        "google_gemini": {
            "configured": bool(getattr(vector_store, "has_gemini_api", False)),
            "reachable": _endpoint_reachable("https://generativelanguage.googleapis.com/") if vector_store.has_gemini_api else 0,
            "note": "First fallback (set GEMINI_API_KEY as host secret)",
        },
        "cloudflare_workers_ai": {
            "configured": bool(getattr(vector_store, "has_cf_api", False)),
            "reachable": _cf_reachable,
            "note": "Second fallback (free tier)",
        },
    }



    oom_risk = "LOW" if ram["available_gb"] > RAM_THRESHOLD_GB else "HIGH"

    return {
        "ram": ram,
        "ram_threshold_gb": RAM_THRESHOLD_GB,
        "oom_risk": oom_risk,
        "oom_guard": {
            "enabled": OOM_STATUS["enabled"],
            "checks_count": OOM_STATUS["checks_count"],
            "last_triggered": OOM_STATUS["last_triggered"],
        },
        "models": models,
        "providers": providers,
        "status": "healthy" if ram["available_gb"] > 2.0 else "critical",
    }


@router.get("/api/ai/system/health")
async def system_health() -> Dict[str, Any]:
    """Lightweight health check — minimal overhead for load balancers."""
    ram = _get_ram_info()
    return {
        "status": "ok" if ram["available_gb"] > 2.0 else "critical",
        "ram_available_gb": round(ram["available_gb"], 2),
        "ram_total_gb": round(ram["total_gb"], 2),
    }


__all__ = ["router", "system_status", "system_health"]
