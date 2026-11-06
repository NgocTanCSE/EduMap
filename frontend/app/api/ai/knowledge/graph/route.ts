import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        const headers: Record<string, string> = {};
        if (authHeader)
            headers['Authorization'] = authHeader;
        const url = new URL(req.url);
        const backendUrl = `${getBackendUrl()}/ai/knowledge/graph?${url.search}`;
        const response = await fetch(backendUrl, { headers });
        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }
        return NextResponse.json(data, { status: response.status });
    }
    catch (error) {
        console.error('knowledge/graph route error:', error);
        return NextResponse.json({ message: 'Lỗi kết nối knowledge graph', nodes: [], edges: [], meta: {}, degraded: true }, { status: 500 });
    }
}
