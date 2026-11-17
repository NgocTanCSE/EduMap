import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

// GET /api/bookmarks -- danh sách mục đã lưu (title join theo loại)
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (authHeader)
        headers['Authorization'] = authHeader;
    try {
        const response = await fetch(`${getBackendUrl()}/bookmarks`, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend error:', errorText);
            return NextResponse.json({ message: 'Không thể tải mục đã lưu' }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ bookmarks' }, { status: 500 });
    }
}

// POST /api/bookmarks -- toggle giữ/bỏ một mục (bookmarked: true/false)
export async function POST(req: NextRequest) {
    const body = await req.json();
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (authHeader)
        headers['Authorization'] = authHeader;
    try {
        const response = await fetch(`${getBackendUrl()}/bookmarks`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend error:', errorText);
            return NextResponse.json({ message: 'Không thể cập nhật mục đã lưu' }, { status: response.status });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ bookmarks' }, { status: 500 });
    }
}
