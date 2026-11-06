import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        const body = await req.json();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authHeader)
            headers['Authorization'] = authHeader;
        const response = await fetch(`${getBackendUrl()}/ai/speech/to-text`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        const data = await response.json();
        return NextResponse.json(data, { status: response.ok ? 200 : response.status });
    }
    catch (error: any) {
        console.error('speech/to-text route error:', error);
        return NextResponse.json({
            text: '',
            language: 'vi',
            method: 'fallback',
            degraded: true,
            error: 'Không thể kết nối tới dịch vụ chuyển đổi giọn (STT). Vui lòng dùng nhận dạng giọng nói trên trình duyệt.',
        }, { status: 200 });
    }
}
