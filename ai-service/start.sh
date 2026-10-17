#!/bin/bash
# Startup wrapper for AI service — logs diagnostics to a file
# served by the Next.js frontend at /ai-startup.log
set -o pipefail

LOG_FILE="/app/frontend/public/ai-startup.log"

echo "=== AI Service Startup Debug ===" > "$LOG_FILE"
echo "Timestamp: $(date -u)" >> "$LOG_FILE"
echo "Python3: $(which python3 2>&1)" >> "$LOG_FILE"
echo "Python3 version: $(python3 --version 2>&1)" >> "$LOG_FILE"
echo "PYTHONPATH: $PYTHONPATH" >> "$LOG_FILE"
echo "CHROMA_DB_PATH: $CHROMA_DB_PATH" >> "$LOG_FILE"
echo "HF_TOKEN: $([ -n "$HF_TOKEN" ] && echo 'SET' || echo 'NOT SET')" >> "$LOG_FILE"
echo "CLOUDFLARE_API_TOKEN: $([ -n "$CLOUDFLARE_API_TOKEN" ] && echo 'SET' || echo 'NOT SET')" >> "$LOG_FILE"
echo "CLOUDFLARE_ACCOUNT_ID: $([ -n "$CLOUDFLARE_ACCOUNT_ID" ] && echo 'SET' || echo 'NOT SET')" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "--- sys.path ---" >> "$LOG_FILE"
python3 -c "import sys; print(sys.executable); [print(f'  {p}') for p in sys.path]" >> "$LOG_FILE" 2>&1
echo "" >> "$LOG_FILE"
echo "--- Import tests ---" >> "$LOG_FILE"
python3 -c "import uvicorn; print(f'  uvicorn {uvicorn.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  uvicorn: FAILED" >> "$LOG_FILE"
python3 -c "import fastapi; print(f'  fastapi {fastapi.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  fastapi: FAILED" >> "$LOG_FILE"
python3 -c "import pandas; print(f'  pandas {pandas.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  pandas: FAILED" >> "$LOG_FILE"
python3 -c "import chromadb; print(f'  chromadb {chromadb.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  chromadb: FAILED" >> "$LOG_FILE"
python3 -c "import psycopg2; print(f'  psycopg2 {psycopg2.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  psycopg2: FAILED" >> "$LOG_FILE"
python3 -c "import numpy; print(f'  numpy {numpy.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  numpy: FAILED" >> "$LOG_FILE"
python3 -c "import sklearn; print(f'  sklearn {sklearn.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  sklearn: FAILED" >> "$LOG_FILE"
python3 -c "import redis; print(f'  redis {redis.__version__}')" >> "$LOG_FILE" 2>&1 || echo "  redis: FAILED" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "--- Testing main.py import ---" >> "$LOG_FILE"
cd /app/ai-service && python3 -c "import main; print('main.py import OK')" >> "$LOG_FILE" 2>&1 || echo "main.py import FAILED" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo "--- Starting uvicorn ---" >> "$LOG_FILE"
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 >> "$LOG_FILE" 2>&1
