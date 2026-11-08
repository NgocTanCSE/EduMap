"""AI service system status router — /api/ai/system/status

Provides RAM monitoring and provider chain status for OOM guard +
observability. No local models are loaded anymore — AI answers come from
remote APIs (DeepSeek / Gemini / Cloudflare) or template fallbacks.
"""
from fastapi import APIRouter
from typing import Dict, Any

from services.llm_service import llm_service
from services.vector_store import vector_store
from utils.memory_guard import _get_ram_info, check_oom, OOM_STATUS, RAM_THRESHOLD_GB

router = APIRouter(tags=["system"])


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
