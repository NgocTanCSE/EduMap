#!/bin/bash
# Deploy script for HuggingFace Spaces
# Usage: HF_TOKEN=<your_token> ./deploy-hf.sh
set -e

cd /home/ngoctan/Downloads/EduMap

if [ -z "$HF_TOKEN" ]; then
    echo "❌ HF_TOKEN not set. Get it from https://huggingface.co/settings/tokens"
    echo "Usage: HF_TOKEN=<your_token> ./deploy-hf.sh"
    exit 1
fi

# Add HF remote if not present
if ! git remote | grep -q '^hf$'; then
    git remote add hf https://huggingface.co/spaces/tancse2005/Edumap
fi

# Push to HF Spaces (uses token as password)
git push https://oauth2:${HF_TOKEN}@huggingface.co/spaces/tancse2005/Edumap HEAD:main

echo "✅ Deployed to https://huggingface.co/spaces/tancse2005/Edumap"
