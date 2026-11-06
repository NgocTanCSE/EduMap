import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return NextResponse.json({ message: 'Vui lòng đăng nhập để xem dashboard' }, { status: 401 });
    }
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: authHeader,
    };
    const allowed = ['minLat', 'maxLat', 'minLng', 'maxLng', 'lat', 'lng', 'radiusKm', 'deploymentDate', 'region'];
    const params = new URLSearchParams();
    for (const k of allowed) {
        const v = req.nextUrl.searchParams.get(k);
        if (v !== null)
            params.set(k, v);
    }
    const qs = params.toString();
    const url = `${getBackendUrl()}/impact-measurement/measure${qs ? `?${qs}` : ''}`;
    try {
        const response = await fetch(url, { headers, next: { revalidate: 0 } });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend impact-measurement error:', response.status, errorText);
            return NextResponse.json({ message: 'Không thể tải báo cáo đo lường tác động' }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        console.error('Impact Measurement BFF error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ đo lường tác động' }, { status: 500 });
    }
}
