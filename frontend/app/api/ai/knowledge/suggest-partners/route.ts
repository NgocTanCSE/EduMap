import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

/**
 * POST /api/ai/knowledge/suggest-partners  →  proxy to NestJS /ai/knowledge/suggest-partners
 *
 * Gợi ý nhà tài trợ / đối tác phù hợp từ knowledge graph + NLP extraction.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const response = await fetch(`${getBackendUrl()}/ai/knowledge/suggest-partners`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('knowledge/suggest-partners route error:', error);
    return NextResponse.json(
      { query: '', count: 0, suggestions: [], degraded: true, reason: 'Lỗi kết nối' },
      { status: 500 }
    );
  }
}
