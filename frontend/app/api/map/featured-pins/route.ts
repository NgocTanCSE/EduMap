import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export async function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams;
    const minLat = sp.get('minLat');
    const maxLat = sp.get('maxLat');
    const minLng = sp.get('minLng');
    const maxLng = sp.get('maxLng');
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader)
        headers['Authorization'] = authHeader;
    try {
        const url = new URL(`${getBackendUrl()}/map/featured-pins`);
        if (minLat && maxLat && minLng && maxLng) {
            url.searchParams.set('minLat', minLat);
            url.searchParams.set('maxLat', maxLat);
            url.searchParams.set('minLng', minLng);
            url.searchParams.set('maxLng', maxLng);
        }
        const response = await fetch(url.toString(), { headers, next: { revalidate: 0 } });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend error (featured-pins):', errorText);
            return NextResponse.json({ message: 'Không thể tải ghim bản đồ' }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        console.error('API Route Error (featured-pins):', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ bản đồ', data: [] }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic';
