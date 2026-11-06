import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Vui lòng đăng nhập để quyên góp' }, { status: 401 });
        }
        const body = await req.json();
        const response = await fetch(`${getBackendUrl()}/donations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authHeader,
            },
            body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return NextResponse.json({ message: (data as any)?.message || 'Quyên góp thất bại' }, { status: response.status });
        }
        return NextResponse.json(unwrapApiResponse(data), { status: response.status });
    }
    catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ quyên góp' }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic';
