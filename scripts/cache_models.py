#!/usr/bin/env python3
"""Pre-cache local AI model weights into HF cache directory.

Uses huggingface_hub.snapshot_download (NOT transformers.from_pretrained)
to avoid loading models into RAM — prevents OOMKilled (exit 137) on HF
Spaces Docker build. snapshot_download only fetches files to ~/.cache/huggingface/.
"""
from huggingface_hub import snapshot_download

MODELS = [
    "facebook/owlv2-tiny",                           # GeoVision local vision fallback
    "google/gemma-2b-it",                            # general text generation
    "TinyLlama/TinyLlama-1.1B-Chat-v1.0",            # Edge AI Tutor
]

for model_id in MODELS:
    snapshot_download(model_id)
    print(f"[cache_models] {model_id} cached successfully")

print("[cache_models] All local models cached")
