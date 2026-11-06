import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
import { bboxFromParams, selectorsForCategory, buildQl, elToLocation, fetchFromOverpassCached, } from '@/src/lib/map-constants';
export async function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams;
    const category = sp.get('category');
    const { minLat, maxLat, minLng, maxLng } = bboxFromParams(sp);
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader)
        headers['Authorization'] = authHeader;
    try {
        const burl = new URL(`${getBackendUrl()}/map/pois`);
        if (category && category !== 'all')
            burl.searchParams.set('category', category);
        burl.searchParams.set('minLat', String(minLat));
        burl.searchParams.set('maxLat', String(maxLat));
        burl.searchParams.set('minLng', String(minLng));
        burl.searchParams.set('maxLng', String(maxLng));
        const bres = await fetch(burl.toString(), { headers, next: { revalidate: 0 } });
        if (bres.ok) {
            const bjson = await bres.json();
            const items = unwrapApiResponse<any[]>(bjson).filter((p: any) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))).slice(0, 1000);
            if (items.length > 0)
                return NextResponse.json({ data: items });
        }
    }
    catch (error) {
        console.error('[api/map/pois] backend DB unavailable, falling back to Overpass:', error);
    }
    const selectors = selectorsForCategory(category);
    const ql = buildQl(minLat, minLng, maxLat, maxLng, selectors);
    const cacheKey = `${category || 'all'}|${minLat}|${minLng}|${maxLat}|${maxLng}`;
    try {
        const raw = await fetchFromOverpassCached(ql, cacheKey);
        const items = (raw.elements || [])
            .slice(0, 1000)
            .map(elToLocation)
            .filter(Boolean);
        return NextResponse.json({ data: items });
    }
    catch (error) {
        console.error('[api/map/pois] Overpass unavailable, backend fallback also failed:', error);
        return NextResponse.json({ data: [], message: 'Không tải được dữ liệu bản đồ' }, { status: 502 });
    }
}
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader)
        headers['Authorization'] = authHeader;
    try {
        const response = await fetch(`${getBackendUrl()}/map/pois`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ message: 'Không thể tạo điểm địa lý mới' }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ bản đồ' }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic';
