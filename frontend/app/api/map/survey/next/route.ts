import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * GET /api/map/survey/next — BFF proxy to the NestJS backend.
 *
 * Forwards the same survey query params as /api/map/survey/priorities and
 * returns the single best next survey point (top-1 priority cell). The backend
 * proxies to the ai-service POST /api/ai/survey/next, cached 3600 s.
 *
 * Public (no auth) — mirrors /api/map/survey/priorities.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const url = new URL(`${getBackendUrl()}/map/survey/next`);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

    const response = await fetch(url.toString(), { headers, next: { revalidate: 0 } });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải gợi ý điểm khảo sát tiếp theo' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nốp tới dịch vụ bản đồ' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
