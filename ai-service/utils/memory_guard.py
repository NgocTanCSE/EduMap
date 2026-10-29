"""OOM guard — monitors RAM and prevents model loading when memory is too tight.

Integrated into all local model loaders (Gemma 2B, TinyLlama, embeddings,
reranker, vision) to prevent the 16GB HF Spaces free-tier container from
being OOM-killed by the kernel.

Usage in model loaders:
    ram = _get_ram_info()
    if ram["available_gb"] < RAM_THRESHOLD_GB:
        return False  # skip loading
    ...
"""
import os
import time
import threading
from typing import Dict, Any

# Minimum free RAM (GB) required to load a local LLM model on HF Spaces.
# Other services (Next.js, NestJS, OSRM, vision, embedding) use ~6GB.
# Each LLM needs ~1.5GB. Keeping 4GB headroom prevents OOM kills.
RAM_THRESHOLD_GB = float(os.getenv("RAM_THRESHOLD_GB", "4.0"))

# Global OOM status tracker (updated by check_oom / guard_load)
OOM_STATUS: Dict[str, Any] = {
    "enabled": True,
    "checks_count": 0,
    "last_triggered": None,
    "oom_prevented": 0,
}
_OOM_LOCK = threading.Lock()


def _read_meminfo() -> Dict[str, float]:
    """Read /proc/meminfo (Linux). Returns {total_gb, available_gb, used_gb, free_gb}."""
    try:
        with open("/proc/meminfo", "r") as f:
            lines = f.readlines()
        info = {}
        for line in lines:
            parts = line.split(":")
            if len(parts) == 2:
                key = parts[0].strip()
                val = parts[1].strip().split()[0]
                info[key] = int(val) * 1024  # kB → bytes
        total = info.get("MemTotal", 0)
        available = info.get("MemAvailable", info.get("MemFree", 0))
        free = info.get("MemFree", 0)
        return {
            "total_gb": total / (1024 ** 3),
            "available_gb": available / (1024 ** 3),
            "used_gb": (total - available) / (1024 ** 3),
            "free_gb": free / (1024 ** 3),
        }
    except Exception:
        # Non-Linux (e.g., macOS test env) — assume HF Spaces defaults
        return {"total_gb": 16.0, "available_gb": 6.0, "used_gb": 10.0, "free_gb": 6.0}


def _get_ram_info() -> Dict[str, float]:
    """Public RAM info reader (re-exported for routers/system.py)."""
    return _read_meminfo()


def check_oom() -> Dict[str, Any]:
    """Check current RAM state. Thread-safe, increments check count.

    Returns {ram, threshold_gb, oom_risk, safe_to_load_models}.
    """
    with _OOM_LOCK:
        OOM_STATUS["checks_count"] += 1

    ram = _read_meminfo()
    oom_risk = "HIGH" if ram["available_gb"] < RAM_THRESHOLD_GB else "LOW"

    return {
        "ram": ram,
        "threshold_gb": RAM_THRESHOLD_GB,
        "oom_risk": oom_risk,
        "safe_to_load_models": ram["available_gb"] >= RAM_THRESHOLD_GB,
    }


def guard_load(model_name: str, estimated_ram_gb: float = 1.5) -> bool:
    """Pre-flight guard: should we load this model given current RAM?

    Args:
        model_name: human-readable name for logging.
        estimated_ram_gb: RAM this model needs (default 1.5GB for 4-bit LLM).

    Returns True if safe to load, False if RAM too tight.
    """
    ram = _read_meminfo()
    needed = RAM_THRESHOLD_GB + estimated_ram_gb
    if ram["available_gb"] < needed:
        with _OOM_LOCK:
            OOM_STATUS["oom_prevented"] += 1
            OOM_STATUS["last_triggered"] = time.time()
        print(f"[OOM-GUARD] REFUSING to load {model_name} — only "
              f"{ram['available_gb']:.1f}GB free (need {needed:.1f}GB)")
        return False
    print(f"[OOM-GUARD] RAM OK for {model_name} — {ram['available_gb']:.1f}GB free")
    return True


__all__ = ["_get_ram_info", "_read_meminfo", "check_oom", "guard_load",
           "RAM_THRESHOLD_GB", "OOM_STATUS"]
