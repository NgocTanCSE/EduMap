import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * GET /api/map/resource-optimization — BFF proxy to the NestJS backend.
 *
 * Forwards budget / coverage / center / region query params and returns the
 * cached (TTL 3600 s) GeoJSON A/B/C plan result.  The heavy scipy MCLP solver
 * runs inside the ai-service; the backend transparently proxies + caches.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const url = new URL(`${getBackendUrl()}/map/resource-optimization`);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

    const response = await fetch(url.toString(), { headers, next: { revalidate: 0 } });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tối ưu phân bổ nguồn lực' },
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

export const dynamic = 'force-dynamic';
