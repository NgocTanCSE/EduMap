import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
export async function GET(req: NextRequest) {
    try {
        const id = req.nextUrl.pathname.split('/').filter(Boolean).pop();
        const response = await fetch(`${getBackendUrl()}/career/jobs/${id}`, {
            headers: { 'Content-Type': 'application/json' },
            next: { revalidate: 0 },
        });
        const data = await response.json().catch(() => ({}));
        return NextResponse.json(unwrapApiResponse(data), { status: response.status });
    }
    catch (error) {
        console.error('[api/career/jobs/:id] Error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ công việc' }, { status: 500 });
    }
}
export const dynamic = 'force-dynamic';
