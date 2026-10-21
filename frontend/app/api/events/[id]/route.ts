import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * GET /api/events/:id — Event detail (app/events/[id]/page.tsx).
 *
 * This BFF route was MISSING, which caused every event detail page to 404
 * ("Không tìm thấy sự kiện này") even though the backend controller already
 * exposed GET /events/:id. It now proxies to the NestJS backend and unwraps the
 * ResponseInterceptor envelope ({ success, data, timestamp }).
 */
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.pathname.split('/').filter(Boolean).pop();
    const response = await fetch(`${getBackendUrl()}/events/${id}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 0 },
    });
    const data = await response.json().catch(() => ({}));
    // Backend may wrap as { success, data: <event> } or return the raw entity.
    return NextResponse.json(unwrapApiResponse(data), { status: response.status });
  } catch (error) {
    console.error('[api/events/:id] Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ sự kiện' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
