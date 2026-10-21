import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * GET /api/career/jobs/:id — Job detail (app/career/jobs/[id]/page.tsx).
 *
 * The career service calls `/api/career/jobs/:id` (relative BFF), but no
 * `[id]/route.ts` existed under `app/api/career/jobs/` — so every job detail
 * page 404'd at the BFF layer before ever reaching the backend. This route
 * proxies to the NestJS backend GET /career/jobs/:id.
 */
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.pathname.split('/').filter(Boolean).pop();
    const response = await fetch(`${getBackendUrl()}/career/jobs/${id}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 0 },
    });
    const data = await response.json().catch(() => ({}));
    // Backend may wrap as { success, data: <job> } or return the raw entity.
    return NextResponse.json(unwrapApiResponse(data), { status: response.status });
  } catch (error) {
    console.error('[api/career/jobs/:id] Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ công việc' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
