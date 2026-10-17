#!/bin/bash
# Startup wrapper for AI service — logs diagnostics to a file
# served by the Next.js frontend at /ai-startup.log
# Uses explicit /usr/bin/python3 path to avoid any PATH/shadowing issues.
set -o pipefail

PY=/usr/bin/python3
LOG_FILE="/app/frontend/public/ai-startup.log"
RECOVERY_SOURCE=""

# ── Recover HF_TOKEN from every possible source ──────────────────────────
# On HF Spaces (Docker-based), HF_TOKEN is NOT auto-injected as an env var.
# It may be available via:
#   1. /proc/1/environ  (supervisord / Space runtime env)
#   2. ~/.huggingface/token  (file written by huggingface_hub / HF CLI)
#   3. huggingface_hub.HfFolder.get_token()  (checks env + file + CLI)
if [ -z "$HF_TOKEN" ] && [ -z "$HUGGING_FACE_HUB_TOKEN" ]; then
    # Source 1: PID 1 env
    if [ -r /proc/1/environ ]; then
        PARENT_ENV=$(tr '\0' '\n' < /proc/1/environ 2>/dev/null || true)
        HF_TOK=$(echo "$PARENT_ENV" | grep "^HF_TOKEN=" | head -1 | cut -d= -f2-)
        HF_HUB=$(echo "$PARENT_ENV" | grep "^HUGGING_FACE_HUB_TOKEN=" | head -1 | cut -d= -f2-)
        [ -n "$HF_TOK" ] && export HF_TOKEN="$HF_TOK" && RECOVERY_SOURCE="PID 1 env"
        [ -n "$HF_HUB" ] && export HUGGING_FACE_HUB_TOKEN="$HF_HUB" && RECOVERY_SOURCE="${RECOVERY_SOURCE:-PID 1 env}"
    fi
    # Source 2: ~/.huggingface/token file
    if [ -z "$HF_TOKEN" ]; then
        for token_file in "$HOME/.huggingface/token" "$HOME/.huggingface/HF_TOKEN" "/etc/huggingface/token" "/root/.huggingface/token"; do
            if [ -r "$token_file" ]; then
                HF_TOK=$(cat "$token_file" 2>/dev/null | tr -d '\n\r')
                if [ -n "$HF_TOK" ] && [ ${#HF_TOK} -gt 10 ]; then
                    export HF_TOKEN="$HF_TOK"
                    RECOVERY_SOURCE="$token_file"
                    break
                fi
            fi
        done
    fi
    # Source 3: huggingface_hub library (checks env + file + CLI token)
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
            RECOVERY_SOURCE="huggingface_hub.HfFolder.get_token()"
        fi
    fi
fi

echo "=== AI Service Startup Debug ===" > "$LOG_FILE"
echo "Timestamp: $(date -u)" >> "$LOG_FILE"
echo "Python3 path: $(which python3 2>&1)" >> "$LOG_FILE"
echo "Python version: ($PY --version 2>&1)" >> "$LOG_FILE"
echo "PYTHONPATH: $PYTHONPATH" >> "$LOG_FILE"
echo "CHROMA_DB_PATH: $CHROMA_DB_PATH" >> "$LOG_FILE"
echo "HF_TOKEN: $([ -n "$HF_TOKEN" ] && echo 'SET' || echo 'NOT SET')" >> "$LOG_FILE"
if [ -n "$RECOVERY_SOURCE" ]; then
    echo "  (recovered from: $RECOVERY_SOURCE)" >> "$LOG_FILE"
fi
echo "HUGGING_FACE_HUB_TOKEN: $([ -n "$HUGGING_FACE_HUB_TOKEN" ] && echo 'SET' || echo 'NOT SET')" >> "$LOG_FILE"
echo "CLOUDFLARE_API_TOKEN: $([ -n "$CLOUDFLARE_API_TOKEN" ] && echo 'SET' || echo 'NOT SET')" >> "$LOG_FILE"
echo "CLOUDFLARE_ACCOUNT_ID: $([ -n "$CLOUDFLARE_ACCOUNT_ID" ] && echo 'SET' || echo 'NOT SET')" >> "$LOG_FILE"
echo "CLOUDFLARE_MODEL: $CLOUDFLARE_MODEL" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "--- ALL ENV VARS (subprocess) ---" >> "$LOG_FILE"
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
echo "--- Network connectivity tests ---" >> "$LOG_FILE"
$PY -c "
import socket, ssl, urllib.request

# DNS resolution tests
for host in ['api.cloudflare.com', 'api-inference.huggingface.co', 'api-inference.hf.co', 'huggingface.co', 'api.github.com']:
    try:
        ip = socket.gethostbyname(host)
        print(f'  DNS {host}: {ip}')
    except Exception as e:
        print(f'  DNS {host}: FAILED — {e}')

# HTTP GET tests
for name, url in [('Cloudflare API', 'https://api.cloudflare.com/client/v4/user/tokens/verify'), ('HF Inference API', 'https://api-inference.huggingface.co')]:
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(url, headers={'User-Agent': 'EduMap-AI-Service/1.0'})
        resp = urllib.request.urlopen(req, timeout=15, context=ctx)
        print(f'  {name} GET ({url}): HTTP {resp.status}')
    except Exception as e:
        print(f'  {name} GET ({url}): ERROR — {type(e).__name__}: {e}')
" >> "$LOG_FILE" 2>&1
# Cloudflare POST test (actual LLM endpoint) + HF POST test (api-inference.hf.co)
if [ -n "$CLOUDFLARE_API_TOKEN" ] && [ -n "$CLOUDFLARE_ACCOUNT_ID" ]; then
    CF_TOKEN="$CLOUDFLARE_API_TOKEN" CF_ACCOUNT="$CLOUDFLARE_ACCOUNT_ID" $PY -c "
import ssl, json, urllib.request, os
cf_url = f'https://api.cloudflare.com/client/v4/accounts/{os.environ[\"CF_ACCOUNT\"]}/ai/run/@cf/meta/llama-3.1-8b-instruct-fp8'
cf_body = json.dumps({'prompt': 'test', 'max_tokens': 10, 'temperature': 0.7}).encode('utf-8')
cf_headers = {'Authorization': 'Bearer ' + os.environ['CF_TOKEN'], 'Content-Type': 'application/json'}
req = urllib.request.Request(cf_url, data=cf_body, headers=cf_headers, method='POST')
try:
    resp = urllib.request.urlopen(req, timeout=15, context=ssl.create_default_context())
    print(f'  Cloudflare POST (urllib): HTTP {resp.status} — {resp.read().decode()[:200]}')
except Exception as e:
    print(f'  Cloudflare POST (urllib): ERROR — {type(e).__name__}: {e}')
try:
    import requests
    r = requests.post(cf_url, headers=cf_headers, json={'prompt': 'test', 'max_tokens': 10, 'temperature': 0.7}, timeout=15)
    print(f'  Cloudflare POST (requests): HTTP {r.status_code} — {r.text[:200]}')
except Exception as e:
    print(f'  Cloudflare POST (requests): ERROR — {type(e).__name__}: {e}')
" >> "$LOG_FILE" 2>&1
else
    echo "  Cloudflare POST: CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not set" >> "$LOG_FILE"
fi
# HF token validation + Inference API POST tests
if [ -n "$HF_TOKEN" ]; then
    HF_TOKEN="$HF_TOKEN" $PY -c "
import ssl, json, urllib.request, urllib.error, os, socket

hf_token = os.environ.get('HF_TOKEN', '')
hf_llm_model = os.environ.get('HF_LLM_MODEL', 'mistralai/Mistral-7B-Instruct-v0.2')
ctx = ssl.create_default_context()
payload = json.dumps({'inputs': 'test', 'parameters': {'max_new_tokens': 10, 'temperature': 0.7}}).encode('utf-8')
base_headers = {'Authorization': 'Bearer ' + hf_token, 'Content-Type': 'application/json'}

# 1. Token validation (whoami)
try:
    req = urllib.request.Request('https://huggingface.co/api/whoami', headers=base_headers)
    resp = urllib.request.urlopen(req, timeout=15, context=ctx)
    whoami_data = json.loads(resp.read().decode())
    print(f'  HF token validation: HTTP {resp.status} — user={whoami_data.get(\"name\", \"?\")}')
except Exception as e:
    print(f'  HF token validation: ERROR — {type(e).__name__}: {e}')

# 2a. Check huggingface_hub version + InferenceClient with explicit task
try:
    import huggingface_hub
    print(f'  huggingface_hub version: {huggingface_hub.__version__}')
    try:
        from huggingface_hub import InferenceClient
        print(f'  InferenceClient: available')
        client = InferenceClient(token=hf_token, model=hf_llm_model, task='text-generation')
        result = client.text_generation('Hello', max_new_tokens=10)
        print(f'  InferenceClient text_gen: OK — {result[:200]}')
    except Exception as e:
        print(f'  InferenceClient test: ERROR — {type(e).__name__}: {e}')
except ImportError:
    print('  huggingface_hub: NOT installed')

# 2b. DNS override + unverified SSL (cert SNI mismatch when DNS-overriding)
#     api-inference.huggingface.co doesn't resolve; patch socket to use
#     api-inference.hf.co's IP, with check_hostname=False
_real_getaddrinfo = socket.getaddrinfo
def _patched_getaddrinfo(host, *args, **kwargs):
    if host == 'api-inference.huggingface.co':
        return _real_getaddrinfo('api-inference.hf.co', *args, **kwargs)
    return _real_getaddrinfo(host, *args, **kwargs)
socket.getaddrinfo = _patched_getaddrinfo
unverified_ctx = ssl._create_unverified_context()
url = f'https://api-inference.huggingface.co/models/{hf_llm_model}'
req = urllib.request.Request(url, data=payload, headers=base_headers, method='POST')
try:
    resp = urllib.request.urlopen(req, timeout=30, context=unverified_ctx)
    print(f'  HF POST (DNS override + unverified SSL): HTTP {resp.status} — {resp.read().decode()[:200]}')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', 'ignore')[:200]
    print(f'  HF POST (DNS override + unverified SSL): HTTP {e.code} — {body[:200]}')
except Exception as e:
    print(f'  HF POST (DNS override + unverified SSL): ERROR — {type(e).__name__}: {e}')

# Restore original
socket.getaddrinfo = _real_getaddrinfo
" >> "$LOG_FILE" 2>&1
else
    echo "  HF token tests: HF_TOKEN not set" >> "$LOG_FILE"
fi
echo "" >> "$LOG_FILE"
echo "--- Testing main.py import ---" >> "$LOG_FILE"
cd /app/ai-service && $PY -c "import main; print('main.py import OK')" >> "$LOG_FILE" 2>&1 || echo "main.py import FAILED" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "--- Starting uvicorn ---" >> "$LOG_FILE"
exec $PY -m uvicorn main:app --host 0.0.0.0 --port 8000 --timeout-graceful-shutdown 5 >> "$LOG_FILE" 2>&1
