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
 * Prior to the fix this returned:
 *   - a relative `/api` (Docker Compose `NEXT_PUBLIC_API_URL=/api`) → caused a
 *     server-side `fetch('/api/...')` to loop back onto Next itself; and
 *   - a wrong fallback port `http://127.0.0.1:3001` (backend listens on 3000).
 *
 * It must also avoid sending a relative URL to `fetch` (which would loop).
 * Priority:
 *   1. BACKEND_URL          -> absolute base, e.g. http://backend:3000 (Compose)
 *   2. NEXT_PUBLIC_API_URL / API_URL -> only when already absolute (http(s)://),
 *      e.g. the HF Dockerfile sets NEXT_PUBLIC_API_URL=http://backend:3000/api
 *   3. local-dev fallback   -> http://127.0.0.1:3000  (backend: PORT || 3000)
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
