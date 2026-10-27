import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

/**
 * POST /api/ai/knowledge/query  →  proxy to NestJS /ai/knowledge/query
 *
 * 1-degree graph traversal from a starting node.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const response = await fetch(`${getBackendUrl()}/ai/knowledge/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('knowledge/query route error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối knowledge graph', start_node: null, neighbors: [], edges: [] },
      { status: 500 }
    );
  }
}
