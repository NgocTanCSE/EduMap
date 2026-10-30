#!/usr/bin/env python3
"""Pre-cache local AI model weights into HF cache directory.

Uses huggingface_hub.snapshot_download to fetch model weights into the
HF cache directory — avoids loading models into RAM, which would cause
OOMKilled (exit 137) on HF Spaces Docker build (Gemma 2B = ~4GB RAM).
"""
from huggingface_hub import snapshot_download

MODELS = [
    "google/owlv2-base-patch16-ensemble",           # GeoVision local vision fallback (zero-shot OD)
    "google/gemma-2b-it",                            # general text LLM (gated — SKIPPED w/o HF_TOKEN at build; DeepSeek/Gemini are the text providers)
    "intfloat/multilingual-e5-small",                # local embeddings fallback (~270 MB, 768-dim)
    "cross-encoder/ms-marco-MiniLM-L6-v2",           # local reranker (~80 MB)
]

for model_id in MODELS:
    try:
        snapshot_download(model_id)
        print(f"[cache_models] {model_id} — OK")
    except Exception as e:
        # Don't crash the build if one model fails — runtime will lazy-load
        print(f"[cache_models] {model_id} — SKIPPED ({e})")

print("[cache_models] Model caching complete")
