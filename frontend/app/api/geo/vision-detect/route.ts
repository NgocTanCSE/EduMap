import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader)
        headers['Authorization'] = authHeader;
    try {
        const body = await req.json();
        const response = await fetch(`${getBackendUrl()}/geo/vision-detect`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            next: { revalidate: 0 },
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend vision-detect error:', errorText);
            return NextResponse.json({ message: errorText || 'Không thể chạy phát hiện GeoVision' }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        console.error('GeoVision vision-detect BFF error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ GeoVision', error: String(error) }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic';
