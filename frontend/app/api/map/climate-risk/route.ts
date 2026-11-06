import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (authHeader)
        headers['Authorization'] = authHeader;
    const params = new URLSearchParams();
    for (const key of ['minLat', 'maxLat', 'minLng', 'maxLng', 'lat', 'lng', 'radiusKm', 'date']) {
        const val = searchParams.get(key);
        if (val)
            params.set(key, val);
    }
    const qs = params.toString();
    try {
        const url = `${getBackendUrl()}/map/climate-risk${qs ? `?${qs}` : ''}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend error:', errorText);
            return NextResponse.json({ message: 'Không thể tải bản đồ rủi ro khí hậu' }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ Bảo Vệ Khí Hậu' }, { status: 500 });
    }
}
