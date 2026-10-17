#!/bin/bash
# Startup wrapper for AI service (FastAPI + uvicorn)
# Uses explicit /usr/bin/python3 path to avoid any PATH/shadowing issues.
set -o pipefail

PY=/usr/bin/python3
LOG_FILE="/tmp/ai-service.log"

# ── Recover HF_TOKEN from /proc/1/environ or ~/.huggingface/token ──────────
# On HF Spaces (Docker-based), HF_TOKEN is NOT auto-injected as a simple env var
# into the Python subprocess. Recover it from PID 1 environ or token file.
if [ -z "$HF_TOKEN" ] && [ -z "$HUGGING_FACE_HUB_TOKEN" ]; then
    if [ -r /proc/1/environ ]; then
        PARENT_ENV=$(tr '\0' '\n' < /proc/1/environ 2>/dev/null || true)
        HF_TOK=$(echo "$PARENT_ENV" | grep "^HF_TOKEN=" | head -1 | cut -d= -f2-)
        HF_HUB=$(echo "$PARENT_ENV" | grep "^HUGGING_FACE_HUB_TOKEN=" | head -1 | cut -d= -f2-)
        [ -n "$HF_TOK" ] && export HF_TOKEN="$HF_TOK"
        [ -n "$HF_HUB" ] && export HUGGING_FACE_HUB_TOKEN="$HF_HUB"
    fi
    if [ -z "$HF_TOKEN" ]; then
        for token_file in "$HOME/.huggingface/token" "$HOME/.huggingface/HF_TOKEN" "/etc/huggingface/token" "/root/.huggingface/token"; do
            if [ -r "$token_file" ]; then
                HF_TOK=$(cat "$token_file" 2>/dev/null | tr -d '\n\r')
                if [ -n "$HF_TOK" ] && [ ${#HF_TOK} -gt 10 ]; then
                    export HF_TOKEN="$HF_TOK"
                    break
                fi
            fi
        done
    fi
fi

# ── Launch AI service ───────────────────────────────────────────────────────
exec $PY -m uvicorn main:app --host 0.0.0.0 --port 8000 --timeout-graceful-shutdown 5
