import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export async function POST(req: NextRequest) {
    if (process.env.NODE_ENV === 'production' &&
        process.env.ENABLE_DEV_LOGIN !== 'true') {
        return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
    try {
        const backendUrl = getBackendUrl();
        const targetUrl = `${backendUrl}/auth/dev-login`;
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return NextResponse.json({ message: data.message || 'Dev login thất bại.' }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error: any) {
        console.error('API Route DevLogin Error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới máy chủ xác thực.' }, { status: 500 });
    }
}
