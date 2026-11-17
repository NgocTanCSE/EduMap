import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

// GET /api/audit-logs -- nhật ký hoạt động (admin / moderator), có phân trang
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const query = new URLSearchParams();
    searchParams.forEach((value, key) => {
        query.set(key, value);
    });
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (authHeader)
        headers['Authorization'] = authHeader;
    try {
        const response = await fetch(`${getBackendUrl()}/audit-logs?${query.toString()}`, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend error:', errorText);
            return NextResponse.json({ message: 'Không thể tải nhật ký hoạt động' }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ nhật ký' }, { status: 500 });
    }
}
