import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

/**
 * POST /api/ai/knowledge/extract  →  proxy to NestJS /ai/knowledge/extract
 *
 * NLP entity extraction: trích xuất thực thể từ văn bản, liên kết tới graph nodes.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const response = await fetch(`${getBackendUrl()}/ai/knowledge/extract`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('knowledge/extract route error:', error);
    return NextResponse.json(
      { entities: [], linked_nodes: [], confidence: 0, degraded: true, reason: 'Lỗi kết nối' },
      { status: 500 }
    );
  }
}
