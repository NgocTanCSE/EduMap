#!/bin/bash
# Launcher for the HF Spaces reverse proxy (replaces Next.js once the UI
# moves to Vercel). Listens on 0.0.0.0:7680 and forwards /api/* to the
# internal backend / ai-service.
set -o pipefail
exec node /app/scripts/hf_proxy.js
