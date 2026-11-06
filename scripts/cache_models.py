"""Pre-cache local AI model weights into HF cache directory.

Uses huggingface_hub.snapshot_download to fetch model weights into the
HF cache directory — avoids loading models into RAM, which would cause
OOMKilled (exit 137) on HF Spaces Docker build (Gemma 2B = ~4GB RAM).
"""
from huggingface_hub import snapshot_download

MODELS = [
    "google/owlv2-base-patch16-ensemble",           
    "google/gemma-2b-it",                            
    "intfloat/multilingual-e5-small",                
    "cross-encoder/ms-marco-MiniLM-L6-v2",           
]

for model_id in MODELS:
    try:
        snapshot_download(model_id)
        print(f"[cache_models] {model_id} — OK")
    except Exception as e:
        print(f"[cache_models] {model_id} — SKIPPED ({e})")

print("[cache_models] Model caching complete")
