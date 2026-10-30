"""AI service system status router — /api/ai/system/status

Provides RAM usage monitoring, model loading state, and provider chain
status for OOM guard + observability on HF Spaces free tier.
"""
from fastapi import APIRouter
from typing import Dict, Any

from services.llm_service import (
    llm_service,
    _local_llm_loaded,
    _local_llm_model,
    _local_llm_load_failed,
)
from services.vector_store import vector_store
from utils.memory_guard import _get_ram_info, check_oom, OOM_STATUS, RAM_THRESHOLD_GB

router = APIRouter(tags=["system"])


@router.get("/api/ai/system/status")
async def system_status() -> Dict[str, Any]:
    """Full system status: RAM, loaded models, provider chain, OOM guard."""
    ram = _get_ram_info()

    # Model loading state (singletons across modules)
    models = {
        "gemma_2b_chat": {
            "loaded": _local_llm_loaded and _local_llm_model is not None,
            "load_failed": _local_llm_load_failed,
            "model": "google/gemma-2b-it (4-bit NF4, ~1.5GB)",
        },
        "embedding_model": {
            "loaded": getattr(vector_store, "_local_embedder_loaded", False)
            and getattr(vector_store, "_local_embedder", None) is not None,
            "model": "intfloat/multilingual-e5-small (~300MB)",
        },
        "reranker_model": {
            "loaded": getattr(vector_store, "_local_reranker_loaded", False)
            and getattr(vector_store, "_local_reranker", None) is not None,
            "model": "cross-encoder/ms-marco-MiniLM-L6-v2 (~100MB)",
        },
    }

    # Provider chain status (order matters: DeepSeek is primary)
    providers = {
        "deepseek": {
            "configured": bool(getattr(llm_service, "has_deepseek", False)),
            "model": getattr(llm_service, "deepseek_model_name", None),
            "note": "Primary text generation (set DEEPSEEK_API_KEY as HF Secret)",
        },
        "google_gemini": {
            "configured": bool(getattr(vector_store, "has_gemini_api", False)),
            "note": "First fallback (set GEMINI_API_KEY as HF Secret)",
        },
        "cloudflare_workers_ai": {
            "configured": bool(getattr(vector_store, "has_cf_api", False)),
            "note": "Second fallback (free tier)",
        },
        "local_gemma_2b": {
            "enabled": models["gemma_2b_chat"]["loaded"],
            "note": "Local text generation — no API key required",
        },
    }

    # OOM guard status
    oom_check = check_oom()
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
