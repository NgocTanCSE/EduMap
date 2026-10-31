import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * BFF: GET /api/impact-measurement/auto-cached/:regionId
 *
 * Trả về báo cáo đo lường tác động đã được AI Auto-Scheduler tính toán
 * cho một vùng (24h/lần). Không chờ LLM — trả cache ngay.
 */
export async function GET(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Extract regionId from path: /api/impact-measurement/auto-cached/:regionId
  const parts = pathname.split('/');
  const regionId = parts[parts.length - 1];

  const refresh = req.nextUrl.searchParams.get('refresh') === 'true';
  const qs = refresh ? '?refresh=true' : '';
  const url = `${getBackendUrl()}/impact-measurement/auto-cached/${regionId}${qs}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const response = await fetch(url, { headers, next: { revalidate: 0 } });
    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('Impact-measurement auto-cached BFF error:', error);
    return NextResponse.json(
      {
        message: `Không thể tải báo cáo đo lường tác động cho ${regionId}`,
        degraded: true, reason: 'BFF proxy error',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
