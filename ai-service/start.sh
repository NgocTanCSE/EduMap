#!/bin/bash
# Startup wrapper for AI service (FastAPI + uvicorn)
# Uses explicit /usr/bin/python3 path to avoid any PATH/shadowing issues.
set -o pipefail

PY=/usr/bin/python3
LOG_FILE="/tmp/ai-service.log"

# ── Recover secrets from PID 1 environ ──────────────────────────────────────
# On HF Spaces (Docker-based), env vars set as "Secrets" in the Spaces UI are
# injected into PID 1 (supervisord) environ, BUT the `environment` directive in
# supervisord.conf for [program:ai-service] does NOT propagate ALL of them to
# the Python subprocess. Only PYTHONUNBUFFERED, PYTHONPATH, and PATH are
# explicitly listed — CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, HF_TOKEN,
# etc. are silently dropped.
#
# This block recovers ALL known secrets from /proc/1/environ so the AI service
# (uvicorn subprocess) has access to them on HF Spaces, matching local Docker
# behavior where `docker run -e` passes them through.
#
# On local Docker: env vars come from `docker run -e` → inherited normally,
#   this block is a harmless no-op (vars already set).
# On HF Spaces: env vars are in PID 1 environ but lost by environment= directive,
#   this block recovers them.
if [ -r /proc/1/environ ]; then
    PARENT_ENV=$(tr '\0' '\n' < /proc/1/environ 2>/dev/null || true)
    # List of all env vars that might be set as HF Spaces secrets
    SECRET_VARS="CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_MODEL \
CLOUDFLARE_EMBEDDING_MODEL HF_TOKEN HUGGING_FACE_HUB_TOKEN \
HF_LLM_MODEL HF_EMBEDDING_MODEL OPENAI_API_KEY ADZUNA_APP_ID \
ADZUNA_APP_KEY ADZUNA_COUNTRY ORS_API_KEY JWT_SECRET \
GEMINI_API_KEY GEMINI_MODEL GEMINI_EMBEDDING_MODEL GEMINI_TIMEOUT_SECONDS \
CF_AI_GATEWAY_ID CF_AI_GATEWAY_ENABLED"
    for var in $SECRET_VARS; do
        if [ -z "${!var}" ]; then
            val=$(echo "$PARENT_ENV" | grep "^${var}=" | head -1 | cut -d= -f2-)
            [ -n "$val" ] && export "$var=$val"
        fi
    done
fi

# ── Recover HF_TOKEN from token file (HF Spaces auto-set) ───────────────────
# If HF_TOKEN is still empty after PID 1 recovery, try HF token files.
if [ -z "$HF_TOKEN" ] && [ -z "$HUGGING_FACE_HUB_TOKEN" ]; then
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

# ── Debug: print which AI sources are available (without revealing secrets) ─
echo "AI service env check:"
[ -n "$GEMINI_API_KEY" ] && echo "  GEMINI_API_KEY: ✓ set" || echo "  GEMINI_API_KEY: ✗ NOT set"
[ -n "$CLOUDFLARE_API_TOKEN" ] && echo "  CLOUDFLARE_API_TOKEN: ✓ set" || echo "  CLOUDFLARE_API_TOKEN: ✗ NOT set"
[ -n "$CLOUDFLARE_ACCOUNT_ID" ] && echo "  CLOUDFLARE_ACCOUNT_ID: ✓ set" || echo "  CLOUDFLARE_ACCOUNT_ID: ✗ NOT set"
[ -n "$CF_AI_GATEWAY_ID" ] && echo "  CF_AI_GATEWAY_ID: ✓ set" || echo "  CF_AI_GATEWAY_ID: ✗ NOT set (direct Workers AI)"
[ -n "$HF_TOKEN" ] && echo "  HF_TOKEN: ✓ set" || echo "  HF_TOKEN: ✗ NOT set"

# ── Launch AI service ───────────────────────────────────────────────────────
exec $PY -m uvicorn main:app --host 0.0.0.0 --port 8000 --timeout-graceful-shutdown 5
