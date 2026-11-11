#!/bin/bash


set -o pipefail

PY=/usr/bin/python3
LOG_FILE="/tmp/ai-service.log"

















if [ -r /proc/1/environ ]; then
    PARENT_ENV=$(tr '\0' '\n' < /proc/1/environ 2>/dev/null || true)
    # List of all env vars that might be set as platform secrets
    SECRET_VARS="CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_MODEL \
CLOUDFLARE_EMBEDDING_MODEL OPENAI_API_KEY ADZUNA_APP_ID \
ADZUNA_APP_KEY ADZUNA_COUNTRY ORS_API_KEY JWT_SECRET \
GEMINI_API_KEY GEMINI_MODEL GEMINI_EMBEDDING_MODEL GEMINI_TIMEOUT_SECONDS \
DEEPSEEK_API_KEY DEEPSEEK_BASE_URL DEEPSEEK_MODEL DEEPSEEK_TIMEOUT_SECONDS \
CF_AI_GATEWAY_ID CF_AI_GATEWAY_ENABLED \
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
[ -n "$DEEPSEEK_API_KEY" ] && echo "  DEEPSEEK_API_KEY: ✓ set (primary LLM provider)" || echo "  DEEPSEEK_API_KEY: ✗ NOT set (falling back to Gemini/Cloudflare)"
[ -n "$CLOUDFLARE_API_TOKEN" ] && echo "  CLOUDFLARE_API_TOKEN: ✓ set (fallback LLM provider)" || echo "  CLOUDFLARE_API_TOKEN: ✗ NOT set"
[ -n "$CLOUDFLARE_ACCOUNT_ID" ] && echo "  CLOUDFLARE_ACCOUNT_ID: ✓ set" || echo "  CLOUDFLARE_ACCOUNT_ID: ✗ NOT set"
[ -n "$GEMINI_API_KEY" ] && echo "  GEMINI_API_KEY: ✓ set (fallback LLM + embeddings)" || echo "  GEMINI_API_KEY: ✗ NOT set"
[ -n "$CF_AI_GATEWAY_ID" ] && echo "  CF_AI_GATEWAY_ID: ✓ set" || echo "  CF_AI_GATEWAY_ID: ✗ NOT set (direct Workers AI)"
[ -n "$OWM_API_KEY" ] && echo "  OWM_API_KEY: ✓ set (OpenWeatherMap for Climate Guardian)" || echo "  OWM_API_KEY: ✗ NOT set"
[ -n "$GOOGLE_TTS_API_KEY" ] && echo "  GOOGLE_TTS_API_KEY: ✓ set (Google Cloud TTS for Language Bridge)" || echo "  GOOGLE_TTS_API_KEY: ✗ NOT set (will use edge-tts / gTTS fallback)"
[ -n "$TAVILY_API_KEY" ] && echo "  TAVILY_API_KEY: ✓ set (crawlers: jobs, internships, events, etc.)" || echo "  TAVILY_API_KEY: ✗ NOT set (crawlers degrade to curated snapshot / 0 rows)"


exec $PY -m uvicorn main:app --host 0.0.0.0 --port 8000 --timeout-graceful-shutdown 5
