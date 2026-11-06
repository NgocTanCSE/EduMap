import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
import { requireAuth } from '@/src/lib/auth-utils';
export async function POST(req: NextRequest) {
    const authError = requireAuth(req);
    if (authError)
        return authError;
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
            signal: AbortSignal.timeout(9000),
        });
        const data = await response.json().catch(() => ({}));
        return NextResponse.json(unwrapApiResponse(data), { status: response.status });
    }
    catch (error: any) {
        console.error('Opportunity match BFF error:', error);
        return NextResponse.json(unwrapApiResponse({
            matches: [],
            total: 0,
            filtered_count: 0,
            degraded: true,
            reason: `BFF proxy error: ${error?.message || 'connection refused'}`,
        }), { status: 200 });
    }
}
export const dynamic = 'force-dynamic';
