#!/bin/bash


set -o pipefail

PY=/usr/bin/python3
LOG_FILE="/tmp/ai-service.log"

















if [ -r /proc/1/environ ]; then
    PARENT_ENV=$(tr '\0' '\n' < /proc/1/environ 2>/dev/null || true)
    # List of all env vars that might be set as platform secrets
    SECRET_VARS="OPENAI_API_KEY ADZUNA_APP_ID \
ADZUNA_APP_KEY ADZUNA_COUNTRY ORS_API_KEY JWT_SECRET \
GROQ_API_KEY GROQ_BASE_URL GROQ_MODEL GROQ_TIMEOUT_SECONDS \
JINA_API_KEY JINA_BASE_URL JINA_EMBEDDING_MODEL JINA_TIMEOUT_SECONDS \
EMBED_BATCH_SIZE EMBED_BATCH_TIMEOUT_SECONDS \
OWM_API_KEY OWM_TIMEOUT_SECONDS \
GOOGLE_TTS_API_KEY \
TAVILY_API_KEY TAVILY_TIMEOUT_SECONDS \
TAVILY_MAX_RESULTS TAVILY_CIRCUIT_BREAKER_FAILURES TAVILY_CIRCUIT_BREAKER_TTL \
DB_TYPE DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_DATABASE DB_SYNC"
    for var in $SECRET_VARS; do
        if [ -z "${!var}" ]; then
            val=$(echo "$PARENT_ENV" | grep "^${var}=" | head -1 | cut -d= -f2-)
            [ -n "$val" ] && export "$var=$val"
        fi
    done
fi







echo "AI service env check:"
[ -n "$GROQ_API_KEY" ] && echo "  GROQ_API_KEY: ✓ set (chat provider)" || echo "  GROQ_API_KEY: ✗ NOT set (chat falls back to templates)"
[ -n "$JINA_API_KEY" ] && echo "  JINA_API_KEY: ✓ set (embedding provider)" || echo "  JINA_API_KEY: ✗ NOT set (RAG semantic search disabled)"
[ -n "$OWM_API_KEY" ] && echo "  OWM_API_KEY: ✓ set (OpenWeatherMap for Climate Guardian)" || echo "  OWM_API_KEY: ✗ NOT set"
[ -n "$GOOGLE_TTS_API_KEY" ] && echo "  GOOGLE_TTS_API_KEY: ✓ set (Google Cloud TTS for Language Bridge)" || echo "  GOOGLE_TTS_API_KEY: ✗ NOT set (will use edge-tts / gTTS fallback)"
[ -n "$TAVILY_API_KEY" ] && echo "  TAVILY_API_KEY: ✓ set (crawlers: jobs, internships, events, etc.)" || echo "  TAVILY_API_KEY: ✗ NOT set (crawlers degrade to curated snapshot / 0 rows)"


exec $PY -m uvicorn main:app --host 0.0.0.0 --port 8000 --timeout-graceful-shutdown 5
