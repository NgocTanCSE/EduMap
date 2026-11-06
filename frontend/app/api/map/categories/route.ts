import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
import { DEFAULT_CATEGORIES } from '@/src/lib/map-constants';
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader)
        headers['Authorization'] = authHeader;
    try {
        const response = await fetch(`${getBackendUrl()}/map/categories`, { headers });
        if (response.ok) {
            const data = await response.json();
            return NextResponse.json(unwrapApiResponse(data));
        }
    }
    catch (error) {
    }
    return NextResponse.json({ data: DEFAULT_CATEGORIES });
}
export const dynamic = 'force-dynamic';
