/**
 * EduMap Frontend — backend URL resolver for the BFF (Backend-for-Frontend)
 * route handlers in `app/api/*`.
 *
 * Every BFF handler calls `fetch(`${getBackendUrl()}/scholarships`, ...)`
 * (and similarly for every other resource) WITHOUT prepending `/api`. The
 * NestJS backend, however, mounts ALL of its controllers under a global
 * `/api` prefix (e.g. `/api/scholarships`, `/api/auth/login`). This function
 * therefore MUST return an ABSOLUTE url ending in `/api`.
 *
 * Priority:
 *   1. BACKEND_URL          -> absolute base, e.g. http://backend:3000 (Docker Compose)
 *   2. NEXT_PUBLIC_API_URL / API_URL -> only when already absolute (http(s)://)
 *   3. local-dev fallback   -> http://127.0.0.1:3000 (backend: PORT || 3000)
 *
 * A trailing `/api` (or `/`) is normalized so we never produce `.../api/api`.
 */
export function getBackendUrl(): string {
  const raw =
    process.env.BACKEND_URL ||
    (process.env.NEXT_PUBLIC_API_URL?.startsWith('http') ? process.env.NEXT_PUBLIC_API_URL : undefined) ||
    (process.env.API_URL?.startsWith('http') ? process.env.API_URL : undefined) ||
    'http://127.0.0.1:3000';

  const base = raw
    .replace(/\/+$/, '') // strip trailing slashes
    .replace(/\/api$/, ''); // strip a trailing /api so we don't double it

  return `${base}/api`;
}

/**
 * Resolve the AI Service (FastAPI) URL for BFF routes that proxy directly
 * to the ai-service (e.g. PDF upload, streaming SSE). In HF Spaces the
 * ai-service runs on 127.0.0.1:8000 inside the same container.
 */
export function getAIServiceUrl(): string {
  const raw =
    process.env.AI_SERVICE_URL ||
    'http://127.0.0.1:8000';

  return raw.replace(/\/+$/, ''); // strip trailing slash
}
