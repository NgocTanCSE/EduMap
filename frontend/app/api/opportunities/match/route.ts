import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
import { requireAuth } from '@/src/lib/auth-utils';

/**
 * BFF proxy for the Opportunity Radar (F-16b).
 *
 * Forwards the authenticated user's JWT (Bearer token) and an optional body
 * ({ gpa, type, field, limit }) to the NestJS backend
 * POST /api/opportunities/match, which performs the SQLite pre-filter (T1)
 * and then delegates NLP matching to the ai-service (T2).
 *
 * Auth is verified at two layers:
 *   1. BFF (requireAuth) — returns 401 immediately if the JWT is invalid/expired.
 *   2. Backend (JwtAuthGuard) — defence-in-depth; the backend is the authority.
 */
export async function POST(req: NextRequest) {
  // BFF-layer auth guard (defence-in-depth)
  const authError = requireAuth(req);
  if (authError) return authError;

  const authHeader = req.headers.get('Authorization');
  const body = await req.json().catch(() => ({}));

  try {
    const response = await fetch(`${getBackendUrl()}/opportunities/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
      // Keep this well under the 10s NestJS stream timeout on HF Spaces free.
      signal: AbortSignal.timeout(9000),
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(unwrapApiResponse(data), { status: response.status });
  } catch (error: any) {
    // If the backend or AI service is down, return a structured degraded
    // response so the frontend radar can still render a graceful state.
    console.error('Opportunity match BFF error:', error);
    return NextResponse.json(
      unwrapApiResponse({
        matches: [],
        total: 0,
        filtered_count: 0,
        degraded: true,
        reason: `BFF proxy error: ${error?.message || 'connection refused'}`,
      }),
      { status: 200 },
    );
  }
}

export const dynamic = 'force-dynamic';
