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

# 2a. Check huggingface_hub version + InferenceClient signatures + tests
try:
    import huggingface_hub
    import inspect
    print(f'  huggingface_hub version: {huggingface_hub.__version__}')
    try:
        from huggingface_hub import InferenceClient
        print(f'  InferenceClient: available')
        sig = inspect.signature(InferenceClient.__init__)
        print(f'  init params: {list(sig.parameters.keys())}')
        try:
            sig2 = inspect.signature(InferenceClient.text_generation)
            print(f'  text_gen params: {list(sig2.parameters.keys())}')
        except Exception:
            print(f'  text_gen params: (could not inspect)')
        # Try gpt2 with stream=False (default URL)
        client = InferenceClient(token=hf_token, model='gpt2')
        try:
            result = client.text_generation('Hello', max_new_tokens=10, stream=False)
            print(f'  InferenceClient (gpt2, stream=False): OK — {result[:200]}')
        except TypeError:
            result = client.text_generation('Hello', max_new_tokens=10)
            print(f'  InferenceClient (gpt2, no stream kwarg): OK — {result[:200]}')
        except Exception as e:
            print(f'  InferenceClient (gpt2, stream=False): ERROR — {type(e).__name__}: {e}')
        # Try base_url=hf.co + model= in text_generation call
        try:
            client_b = InferenceClient(token=hf_token, base_url='https://api-inference.hf.co')
            try:
                result_b = client_b.text_generation('Hello', model='gpt2', max_new_tokens=10, stream=False)
            except TypeError:
                result_b = client_b.text_generation('Hello', model='gpt2', max_new_tokens=10)
            print(f'  InferenceClient (base_url+model in call): OK — {result_b[:200]}')
        except Exception as e:
            _hc = getattr(e, 'response_code', None) or (getattr(getattr(e, 'response', None), 'status_code', None))
            _hb = ''
            try:
                _r = getattr(e, 'response', None)
                if _r is not None:
                    _hb = _r.text[:200]
            except Exception:
                pass
            print(f'  InferenceClient (base_url+model): ERROR — {type(e).__name__} (HTTP={_hc}) — {str(e)[:300]} | body: {_hb}')
        # Try URL as model
        try:
            client_c = InferenceClient(token=hf_token, model='https://api-inference.hf.co/models/gpt2')
            try:
                result_c = client_c.text_generation('Hello', max_new_tokens=10, stream=False)
            except TypeError:
                result_c = client_c.text_generation('Hello', max_new_tokens=10)
            print(f'  InferenceClient (URL as model): OK — {result_c[:200]}')
        except Exception as e:
            _hc = getattr(e, 'response_code', None) or (getattr(getattr(e, 'response', None), 'status_code', None))
            print(f'  InferenceClient (URL as model): ERROR — {type(e).__name__} (HTTP={_hc}) — {str(e)[:300]}')
    except Exception as e:
        print(f'  InferenceClient: ERROR — {type(e).__name__}: {e}')
except ImportError:
    print('  huggingface_hub: NOT installed')

# 2a2. Check InferenceClient methods + try chat() + URL-as-model with HF_LLM_MODEL
try:
    from huggingface_hub import InferenceClient
    c = InferenceClient(token=hf_token, model='gpt2')
    for m in ['chat', 'conversational', 'post', 'text_generation']:
        print(f'  has method {m}: {hasattr(c, m)}')
    # Try chat with URL as model (bypasses DNS, tests conversational endpoint)
    try:
        cc = InferenceClient(token=hf_token, model=f'https://api-inference.hf.co/models/gpt2')
        chat_result = cc.chat([{'role': 'user', 'content': 'Hello'}], max_tokens=10)
        print(f'  chat return type: {type(chat_result).__name__}')
        print(f'  chat attrs: {dir(chat_result)[:15]}')
        if hasattr(chat_result, 'done'):
            print(f'  chat done(): {chat_result.done()}')
        if hasattr(chat_result, 'result'):
            try:
                r = chat_result.result()
                print(f'  chat result(): {str(r)[:200]}')
            except Exception as e3:
                print(f'  chat result(): ERROR — {type(e3).__name__}: {str(e3)[:200]}')
        if hasattr(chat_result, '__iter__'):
            try:
                chunks = []
                for chunk in chat_result:
                    chunks.append(str(chunk))
                _joined = ''.join(chunks)
                print(f'  chat iter: {_joined[:200]}')
            except Exception as e3:
                print(f'  chat iter: ERROR — {type(e3).__name__}: {str(e3)[:200]}')
    except Exception as e:
        _hc = getattr(e, 'response_code', None) or getattr(getattr(e, 'response', None), 'status_code', None)
        print(f'  InferenceClient (gpt2, chat, URL model): ERROR — {type(e).__name__} (HTTP={_hc}) — {str(e)[:300]}')
    # Also test chat with stream=False — step by step, avoid str() on ProxyClientChat
    print('CHAT_DEBUG_1')
    try:
        cc3 = InferenceClient(token=hf_token, model=f'https://api-inference.hf.co/models/gpt2')
        print('CHAT_DEBUG_2')
        chat_sf = cc3.chat([{'role': 'user', 'content': 'Hello'}], max_tokens=10, stream=False)
        print('CHAT_DEBUG_3')
        print(f'  chat_type: {type(chat_sf).__name__}')
        _dm = getattr(chat_sf, "done", None)
        _rm = getattr(chat_sf, "result", None)
        _im = getattr(chat_sf, "__iter__", None)
        print(f'  done_callable: {callable(_dm)}')
        print(f'  result_callable: {callable(_rm)}')
        print(f'  iter_callable: {callable(_im)}')
        if callable(_dm):
            print('CHAT_DEBUG_4')
            try:
                _d = _dm()
                print(f'  done_val: {type(_d).__name__}')
            except Exception as ee:
                print(f'  done_err: {type(ee).__name__}')
        if callable(_rm):
            print('CHAT_DEBUG_5')
            try:
                _r = _rm()
                print(f'  result_type: {type(_r).__name__}')
            except Exception as ee:
                print(f'  result_err: {type(ee).__name__}')
        if callable(_im):
            print('CHAT_DEBUG_6')
            try:
                _chunks = []
                for _chunk in chat_sf:
                    _chunks.append(repr(_chunk))
                print(f'  iter_count: {len(_chunks)}')
                _joined = chr(39).join(_chunks)
                print(f'  iter_text: {_joined[:200]}')
            except Exception as ee:
                print(f'  iter_err: {type(ee).__name__}')
    except Exception as e3:
        print(f'  chat_sf_error: {type(e3).__name__}: {str(e3)[:200]}')
    # Try text_generation with URL as model for HF_LLM_MODEL (might bypass task validation)
    try:
        cc2 = InferenceClient(token=hf_token, model=f'https://api-inference.hf.co/models/{hf_llm_model}')
        result2 = cc2.text_generation('Hello', max_new_tokens=10, stream=False)
        print(f'  InferenceClient (HF_LLM_MODEL, text_gen, URL model): OK — {result2[:200]}')
    except TypeError:
        result2 = cc2.text_generation('Hello', max_new_tokens=10)
        print(f'  InferenceClient (HF_LLM_MODEL, text_gen, URL model): OK — {result2[:200]}')
    except Exception as e:
        _hc = getattr(e, 'response_code', None) or getattr(getattr(e, 'response', None), 'status_code', None)
        print(f'  InferenceClient (HF_LLM_MODEL, text_gen, URL model): ERROR — {type(e).__name__} (HTTP={_hc}) — {str(e)[:300]}')
except Exception as e:
    print(f'  InferenceClient 2a2: ERROR — {type(e).__name__}: {e}')

# 2b. Try huggingface.co/api/inference endpoint (alternative to api-inference.*)
alt_url = f'https://huggingface.co/api/inference/models/{hf_llm_model}'
req = urllib.request.Request(alt_url, data=payload, headers=base_headers, method='POST')
try:
    resp = urllib.request.urlopen(req, timeout=30, context=ctx)
    print(f'  HF POST (huggingface.co/api/inference): HTTP {resp.status} — {resp.read().decode()[:200]}')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', 'ignore')[:200]
    print(f'  HF POST (huggingface.co/api/inference): HTTP {e.code} — {body[:200]}')
except Exception as e:
    print(f'  HF POST (huggingface.co/api/inference): ERROR — {type(e).__name__}: {e}')

# 2c. DNS override with unverified SSL (api-inference.huggingface.co -> api-inference.hf.co IP)
_real_getaddrinfo = socket.getaddrinfo
def _patched_getaddrinfo(host, *args, **kwargs):
    if host == 'api-inference.huggingface.co':
        return _real_getaddrinfo('api-inference.hf.co', *args, **kwargs)
    return _real_getaddrinfo(host, *args, **kwargs)
socket.getaddrinfo = _patched_getaddrinfo
url = f'https://api-inference.huggingface.co/models/{hf_llm_model}'
for desc, ssl_ctx in [('default SSL', ctx), ('unverified SSL', ssl._create_unverified_context())]:
    req = urllib.request.Request(url, data=payload, headers=base_headers, method='POST')
    try:
        resp = urllib.request.urlopen(req, timeout=30, context=ssl_ctx)
        print(f'  HF POST (DNS override, {desc}): HTTP {resp.status} — {resp.read().decode()[:200]}')
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'ignore')[:200]
        print(f'  HF POST (DNS override, {desc}): HTTP {e.code} — {body[:200]}')
    except Exception as e:
        print(f'  HF POST (DNS override, {desc}): ERROR — {type(e).__name__}: {e}')

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
