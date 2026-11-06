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
    const url = `${getBackendUrl()}/impact-match/rankings/cached${qs}`;
    try {
        const response = await fetch(url, { headers, next: { revalidate: 0 } });
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        console.error('Impact-match cached rankings BFF error:', error);
        return NextResponse.json({
            message: 'Không thể tải kết quả xếp hạng tự động',
            ranked_matches: [],
            degraded: true, reason: 'BFF proxy error',
        }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic';
