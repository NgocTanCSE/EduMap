import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
const TICKETMASTER_ENDPOINT = 'https://app.ticketmaster.com/discovery/v2/events.json';
const BIEN_HOA = { lat: 10.957, lng: 106.843 };
const DEFAULT_RADIUS_KM = 100;
function tmToEvent(e: any): any {
    const venue = (e._embedded && e._embedded.venues && e._embedded.venues[0]) || {};
    const start = e.dates?.start;
    let startDate = '';
    if (start?.localDate) {
        startDate = start.localTime ? `${start.localDate}T${start.localTime}` : start.localDate;
    }
    const end = e.dates?.end;
    let endDate = startDate;
    if (end?.localDate) {
        endDate = end.localTime ? `${end.localDate}T${end.localTime}` : end.localDate;
    }
    const image = e.images && e.images[0]?.url;
    const status = startDate && new Date(startDate) > new Date() ? 'active' : 'inactive';
    const location = [venue.name, venue.city?.name].filter(Boolean).join(', ');
    return {
        id: `tm:${e.id}`,
        title: e.name || 'Sự kiện',
        description: (e.info || venue.name || '').slice(0, 1000),
        location: location || 'Chưa rõ địa điểm',
        start_date: startDate,
        end_date: endDate,
        capacity: 100,
        registered_count: 0,
        organizer_id: '',
        status,
        image_url: image || undefined,
        created_at: new Date().toISOString(),
    };
}
async function resolveGeo(location: string): Promise<{
    lat: number;
    lng: number;
}> {
    if (location) {
        try {
            const np = new URL('https://nominatim.openstreetmap.org/search');
            np.searchParams.set('q', location);
            np.searchParams.set('format', 'json');
            np.searchParams.set('limit', '1');
            np.searchParams.set('email', 'edumap@example.com');
            const nres = await fetch(np.toString(), {
                method: 'GET',
                headers: { Accept: 'application/json', 'User-Agent': 'EduMap-BFF/1.0' },
                next: { revalidate: 0 },
            });
            if (nres.ok) {
                const njson = await nres.json().catch(() => null);
                if (Array.isArray(njson) && njson[0]) {
                    return { lat: parseFloat(njson[0].lat), lng: parseFloat(njson[0].lon) };
                }
            }
        }
        catch {
        }
    }
    return BIEN_HOA;
}
export async function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams;
    const keyword = sp.get('keyword') || sp.get('q') || '';
    const location = sp.get('location') || '';
    const size = Math.min(Math.max(1, parseInt(sp.get('size') || '50', 10)), 50);
    const { lat, lng } = await resolveGeo(location);
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (apiKey) {
        try {
            const url = new URL(TICKETMASTER_ENDPOINT);
            url.searchParams.set('apikey', apiKey);
            if (keyword)
                url.searchParams.set('keyword', keyword);
            url.searchParams.set('latitude', String(lat));
            url.searchParams.set('longitude', String(lng));
            url.searchParams.set('unit', 'k');
            url.searchParams.set('radius', String(DEFAULT_RADIUS_KM));
            url.searchParams.set('size', String(size));
            url.searchParams.set('sort', 'date,asc');
            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: { Accept: 'application/json', 'User-Agent': 'EduMap-BFF/1.0' },
                next: { revalidate: 0 },
            });
            if (!res.ok) {
                console.error('[api/events] Ticketmaster error:', res.status);
                throw new Error(`ticketmaster ${res.status}`);
            }
            const raw: any = await res.json().catch(() => ({}));
            const events = (raw._embedded?.events || []).map(tmToEvent);
            return NextResponse.json(events);
        }
        catch (e) {
            console.error('[api/events] Ticketmaster failed, falling back to backend:', e);
        }
    }
    try {
        const burl = new URL(`${getBackendUrl()}/events`);
        if (keyword)
            burl.searchParams.set('keyword', keyword);
        if (location)
            burl.searchParams.set('location', location);
        const authHeader = req.headers.get('Authorization');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authHeader)
            headers['Authorization'] = authHeader;
        const bres = await fetch(burl.toString(), { headers, next: { revalidate: 0 } });
        const bjson: any = await bres.json().catch(() => null);
        const arr = Array.isArray(bjson)
            ? bjson
            : bjson && Array.isArray(bjson.data)
                ? bjson.data
                : [];
        return NextResponse.json(arr, { status: bres.status });
    }
    catch (e2) {
        console.error('[api/events] backend fallback also failed:', e2);
        return NextResponse.json([], { status: 404 });
    }
}
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return NextResponse.json({ message: 'Vui lòng đăng nhập để tạo sự kiện' }, { status: 401 });
    }
    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ message: 'Dữ liệu sự kiện không hợp lệ' }, { status: 400 });
        }
        const bres = await fetch(`${getBackendUrl()}/events`, {
            method: 'POST',
            headers: {
                Authorization: authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            next: { revalidate: 0 },
        });
        const data = await bres.json().catch(() => ({}));
        return NextResponse.json(unwrapApiResponse(data), { status: bres.status });
    }
    catch (error) {
        console.error('[api/events] POST failed:', error);
        return NextResponse.json({ message: 'Không thể tạo sự kiện' }, { status: 502 });
    }
}
export const dynamic = 'force-dynamic';
