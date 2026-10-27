import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

/**
 * GET /api/ai/knowledge/graph  →  proxy to NestJS backend /ai/knowledge/graph
 *
 * Trả về toàn bộ knowledge graph (nodes + edges) để render D3 force-directed
 * graph trên frontend. Backend lại proxy sang ai-service FastAPI.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = {};
    if (authHeader) headers['Authorization'] = authHeader;

    const url = new URL(req.url);
    const backendUrl = `${getBackendUrl()}/ai/knowledge/graph?${url.search}`;

    const response = await fetch(backendUrl, { headers });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('knowledge/graph route error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối knowledge graph', nodes: [], edges: [], meta: {}, degraded: true },
      { status: 500 }
    );
  }
}
