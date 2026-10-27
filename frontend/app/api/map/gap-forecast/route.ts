import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * GET /api/map/gap-forecast?region=...&steps=...
 *
 * BFF proxy → backend GET /api/map/gap-forecast (MapController), which caches
 * the ai-service POST /api/ai/forecast/gaps result for 24 h and returns it as a
 * GeoJSON risk heatmap. Used by app/map/gap-predictor/page.tsx.
 *
 * Public (no auth) — mirrors /api/map/stats, /api/map/pois etc. which are all
 * @SkipThrottle and unauthenticated so the map renders for anonymous visitors.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const region = searchParams.get('region');
  const steps = searchParams.get('steps');

  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  const params = new URLSearchParams();
  if (region) params.set('region', region);
  if (steps) params.set('steps', steps);
  const qs = params.toString();

  try {
    const url = `${getBackendUrl()}/map/gap-forecast${qs ? `?${qs}` : ''}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải dự báo khoảng trống giáo dục' },
        { status: response.status },
      );
    }

    const data = await response.json();
    // Backend wraps as { success, data } — unwrap to the GeoJSON payload.
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ dự báo' },
      { status: 500 },
    );
  }
}
