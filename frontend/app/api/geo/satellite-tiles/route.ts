import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export async function GET(req: NextRequest) {
    const url = new URL(`${getBackendUrl()}/geo/satellite-tiles`);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            next: { revalidate: 0 },
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend satellite-tiles error:', errorText);
            return NextResponse.json({ message: 'Không thể tải bTile vệ tinh. Vui lòng thử lại.', error: errorText }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        console.error('GeoVision satellite-tiles BFF error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ bản đồ', error: String(error) }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic';
