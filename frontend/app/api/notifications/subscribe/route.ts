import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = {
        'Accept': 'text/event-stream',
    };
    if (authHeader)
        headers['Authorization'] = authHeader;

    try {
        const backendResponse = await fetch(`${getBackendUrl()}/notifications/subscribe`, {
            method: 'GET',
            headers,
        });
        if (!backendResponse.ok) {
            const errorText = await backendResponse.text();
            return new NextResponse(errorText, { status: backendResponse.status });
        }
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();
        const reader = backendResponse.body?.getReader();
        if (!reader) {
            return new Response('No response body', { status: 502 });
        }
        const pump = async () => {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        writer.close();
                        break;
                    }
                    writer.write(value);
                }
            } catch (e) {
                writer.close();
                console.error('Stream forwarding error:', e);
            } finally {
                reader.releaseLock();
            }
        };
        pump();
        return new NextResponse(stream.readable, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });
    } catch (error) {
        console.error('API Route Error:', error);
        return new NextResponse(
            JSON.stringify({ message: 'Lỗi kết nối tới dịch vụ thông báo' }),
            { status: 500 }
        );
    }
}

export const dynamic = 'force-dynamic';
