#!/bin/bash
# Startup wrapper for AI service — logs diagnostics to a file
# served by the Next.js frontend at /ai-startup.log
# Uses explicit /usr/bin/python3 path to avoid any PATH/shadowing issues.
set -o pipefail

PY=/usr/bin/python3
LOG_FILE="/app/frontend/public/ai-startup.log"

# ── Recover HF_TOKEN from every possible source ──────────────────────────
# Sources checked (in order):
#   1. /proc/1/environ  (supervisord / Space runtime env)
#   2. ~/.huggingface/token  (file written by huggingface_hub / HF runtime)
#   3. huggingface_hub.HfFolder.get_token()  (checks env + file + HF CLI)
if [ -z "$HF_TOKEN" ] && [ -z "$HUGGING_FACE_HUB_TOKEN" ]; then
    # Source 1: PID 1 env
    if [ -r /proc/1/environ ]; then
        PARENT_ENV=$(tr '\0' '\n' < /proc/1/environ 2>/dev/null || true)
        HF_TOK=$(echo "$PARENT_ENV" | grep "^HF_TOKEN=" | head -1 | cut -d= -f2-)
        HF_HUB=$(echo "$PARENT_ENV" | grep "^HUGGING_FACE_HUB_TOKEN=" | head -1 | cut -d= -f2-)
        [ -n "$HF_TOK" ] && export HF_TOKEN="$HF_TOK"
        [ -n "$HF_HUB" ] && export HUGGING_FACE_HUB_TOKEN="$HF_HUB"
    fi
    # Source 2: ~/.huggingface/token file
    if [ -z "$HF_TOKEN" ]; then
        for token_file in "$HOME/.huggingface/token" "$HOME/.huggingface/HF_TOKEN" "/etc/huggingface/token" "/root/.huggingface/token"; do
            if [ -r "$token_file" ]; then
                HF_TOK=$(cat "$token_file" 2>/dev/null | tr -d '\n\r')
                if [ -n "$HF_TOK" ] && [ ${#HF_TOK} -gt 10 ]; then
                    export HF_TOKEN="$HF_TOK"
                    echo "  (recovered HF_TOKEN from $token_file)" >> "$LOG_FILE"
                    break
                fi
            fi
        done
    fi
    # Source 3: huggingface_hub library
    if [ -z "$HF_TOKEN" ]; then
        HF_TOK=$($PY -c "
try:
    from huggingface_hub import HfFolder
    t = HfFolder.get_token()
    print(t or '')
except Exception:
    print('')
" 2>/dev/null || echo '')
        if [ -n "$HF_TOK" ] && [ ${#HF_TOK} -gt 10 ]; then
            export HF_TOKEN="$HF_TOK"
            echo "  (recovered HF_TOKEN via huggingface_hub.HfFolder.get_token())" >> "$LOG_FILE"
        fi
    fi
fi

echo "=== AI Service Startup Debug ===" > "$LOG_FILE"
echo "Timestamp: $(date -u)" >> "$LOG_FILE"
echo "Python3 path: $(which python3 2>&1)" >> "$LOG_FILE"
echo "Python3 version: ($PY --version 2>&1)" >> "$LOG_FILE"
echo "PYTHONPATH: $PYTHONPATH" >> "$LOG_FILE"
echo "CHROMA_DB_PATH: $CHROMA_DB_PATH" >> "$LOG_FILE"
echo "HF_TOKEN: $([ -n "$HF_TOKEN" ] && echo 'SET' || echo 'NOT SET')" >> "$LOG_FILE"
echo "HUGGING_FACE_HUB_TOKEN: $([ -n "$HUGGING_FACE_HUB_TOKEN" ] && echo 'SET' || echo 'NOT SET')" >> "$LOG_FILE"
echo "CLOUDFLARE_API_TOKEN: $([ -n "$CLOUDFLARE_API_TOKEN" ] && echo 'SET' || echo 'NOT SET')" >> "$LOG_FILE"
echo "CLOUDFLARE_ACCOUNT_ID: $([ -n "$CLOUDFLARE_ACCOUNT_ID" ] && echo 'SET' || echo 'NOT SET')" >> "$LOG_FILE"
echo "CLOUDFLARE_MODEL: $CLOUDFLARE_MODEL" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "--- ALL ENV VARS ---" >> "$LOG_FILE"
env | sort >> "$LOG_FILE" 2>&1
echo "" >> "$LOG_FILE"
echo "--- PID 1 / SUPERVISORD ENV VARS ---" >> "$LOG_FILE"
if [ -r /proc/1/environ ]; then
    tr '\0' '\n' < /proc/1/environ | sort >> "$LOG_FILE" 2>&1
else
    echo "  (cannot read /proc/1/environ)" >> "$LOG_FILE"
fi
echo "" >> "$LOG_FILE"
echo "--- sys.path ---" >> "$LOG_FILE"
$PY -c "import sys; print(sys.executable); [print(f'  {p}') for p in sys.path]" >> "$LOG_FILE" 2>&1
echo "" >> "$LOG_FILE"
echo "--- Import tests ---" >> "$LOG_FILE"
$PY -c "import uvicorn; print(f'  uvicorn {uvicorn.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  uvicorn: FAILED" >> "$LOG_FILE"
$PY -c "import fastapi; print(f'  fastapi {fastapi.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  fastapi: FAILED" >> "$LOG_FILE"
$PY -c "import pandas; print(f'  pandas {pandas.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  pandas: FAILED" >> "$LOG_FILE"
$PY -c "import chromadb; print(f'  chromadb {chromadb.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  chromadb: FAILED" >> "$LOG_FILE"
$PY -c "import psycopg2; print(f'  psycopg2 {psycopg2.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  psycopg2: FAILED" >> "$LOG_FILE"
$PY -c "import numpy; print(f'  numpy {numpy.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  numpy: FAILED" >> "$LOG_FILE"
$PY -c "import sklearn; print(f'  sklearn {sklearn.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  sklearn: FAILED" >> "$LOG_FILE"
$PY -c "import redis; print(f'  redis {redis.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  redis: FAILED" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "--- Testing main.py import ---" >> "$LOG_FILE"
cd /app/ai-service && $PY -c "import main; print('main.py import OK')" >> "$LOG_FILE" 2>&1 || echo "main.py import FAILED" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "--- Starting uvicorn ---" >> "$LOG_FILE"
exec $PY -m uvicorn main:app --host 0.0.0.0 --port 8000 --timeout-graceful-shutdown 5 >> "$LOG_FILE" 2>&1
