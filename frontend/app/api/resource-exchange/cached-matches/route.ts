import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
    };
    const refresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const qs = refresh ? '?refresh=true' : '';
    const url = `${getBackendUrl()}/resource-exchange/cached-matches${qs}`;
    try {
        const response = await fetch(url, { headers, next: { revalidate: 0 } });
        const data = await response.json();
        if (response.status === 202) {
            return NextResponse.json(unwrapApiResponse(data));
        }
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        console.error('Resource-exchange cached-matches BFF error:', error);
        return NextResponse.json({
            message: 'Không thể tải kết quả ghép nối tự động',
            ranked_matches: [], transport_plan: [],
            degraded: true, reason: 'BFF proxy error',
        }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic';
