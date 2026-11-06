import { NextRequest, NextResponse } from 'next/server';
import { getAIServiceUrl } from '@/src/lib/api-config';
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        const body = await req.arrayBuffer();
        const aiServiceUrl = getAIServiceUrl();
        const response = await fetch(`${aiServiceUrl}/api/ai/route/explain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { Authorization: authHeader } : {}),
            },
            body,
        });
        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }
        return NextResponse.json(data);
    }
    catch (error: any) {
        console.error('SafeRoute explain BFF error:', error);
        return NextResponse.json({
            success: false,
            explanation: '',
            route_reasons: [],
            degraded: true,
            reason: `BFF proxy error: ${error?.message || 'unknown error'}`,
            source: 'bff-error',
        }, { status: 200 });
    }
}
