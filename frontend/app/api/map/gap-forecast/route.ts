import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const region = searchParams.get('region');
    const steps = searchParams.get('steps');
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (authHeader)
        headers['Authorization'] = authHeader;
    const params = new URLSearchParams();
    if (region)
        params.set('region', region);
    if (steps)
        params.set('steps', steps);
    const qs = params.toString();
    try {
        const url = `${getBackendUrl()}/map/gap-forecast${qs ? `?${qs}` : ''}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend error:', errorText);
            return NextResponse.json({ message: 'Không thể tải dự báo khoảng trống giáo dục' }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ dự báo' }, { status: 500 });
    }
}
