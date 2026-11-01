#!/bin/bash
# Deploy script for HuggingFace Spaces — MIRRORS the local tree (deletions included).
#
# Why mirror: the Space repo accumulates files that were deleted locally
# (e.g. `frontend/components/AgentationToolbar.tsx`). A plain push can be
# rejected as non-fast-forward, and `upload_folder` without mirroring only
# overwrites files — it never removes them. Orphan .tsx files still get
# type-checked by `next build` (tsconfig `include: **/*.tsx`), so a deleted
# component can fail the production build even though nothing imports it.
#
# Usage: HF_TOKEN=<your_token> ./deploy-hf.sh [--git]
#   default   : huggingface_hub mirror upload (delete_patterns=["*"])
#   --git     : force-push git HEAD:main (also mirrors deletions)
set -e

cd "$(dirname "$0")"

SPACE="tancse2005/Edumap"

if [ -z "$HF_TOKEN" ]; then
    echo "❌ HF_TOKEN not set. Get it from https://huggingface.co/settings/tokens"
    echo "Usage: HF_TOKEN=<your_token> ./deploy-hf.sh [--git]"
    exit 1
fi

if [ "$1" = "--git" ]; then
    # Force push: the Space repo has its own history, so a normal push is
    # rejected (non-fast-forward) and the tree silently stays stale.
    if ! git remote | grep -q '^hf$'; then
        git remote add hf https://huggingface.co/spaces/${SPACE}
    fi
    git push --force https://oauth2:${HF_TOKEN}@huggingface.co/spaces/${SPACE} HEAD:main
    echo "✅ Force-pushed HEAD:main → https://huggingface.co/spaces/${SPACE}"
    exit 0
fi

# Default: mirror upload. `delete_patterns=["*"]` removes every remote file
# that is not part of this folder, so deletions propagate.
HF_TOKEN="$HF_TOKEN" SPACE="$SPACE" python3 - <<'PY'
import os, sys
from huggingface_hub import HfApi

repo = os.environ["SPACE"]
api = HfApi(token=os.environ["HF_TOKEN"])

commit = api.upload_folder(
    folder_path=".",
    repo_id=repo,
    repo_type="space",
    delete_patterns=["*"],          # mirror: drop files deleted locally
    ignore_patterns=[
        ".git/*", ".git",
        "**/node_modules/*", "**/node_modules",
        "**/.next/*", "**/.next",
        "**/__pycache__/*", "**/*.pyc",
        "**/.venv/*", "**/venv/*",
        "**/dist/*", "**/coverage/*",
        ".env", "**/.env.local",
        "**/*.db.bak*", "**/*.bak",
        "**/.pytest_cache/*", "**/.mypy_cache/*",
    ],
    commit_message="deploy: mirror local tree",
)
print(f"✅ Mirrored to https://huggingface.co/spaces/{repo} ({commit.commit_id[:8]})")
PY

echo "ℹ️  Build starts automatically. If the build was already running, HF will rebuild on this commit."
