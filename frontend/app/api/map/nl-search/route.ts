import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * BFF proxy for Talk2Map (Idea #4).
 *
 * GET /api/map/nl-search?q=<vietnamese query>&limit=20
 * → proxies to backend GET /map/nl-search?q=...
 * → backend calls ai-service POST /api/ai/map/query (parse) + SQLite (results)
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get('q');
  const limit = searchParams.get('limit');

  if (!q || !q.trim()) {
    return NextResponse.json(
      { message: 'Tham số "q" (câu hỏi) là bắt buộc' },
      { status: 400 }
    );
  }

  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const url = `${getBackendUrl()}/map/nl-search`;
    const params = new URLSearchParams();
    params.set('q', q.trim());
    if (limit) params.set('limit', limit);

    const response = await fetch(`${url}?${params.toString()}`, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tìm kiếm bản đồ từ server' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ bản đồ' },
      { status: 500 }
    );
  }
}
