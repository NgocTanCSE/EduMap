import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * GET /api/map/survey/priorities — BFF proxy to the NestJS backend.
 *
 * Query params:
 *   current_lat, current_lng          — survey team location (defaults: Biên Hòa)
 *   min_lat, max_lat, min_lng, max_lng — optional bounding box
 *   grid_size_km                      — grid cell side in km (default 1.0)
 *   top_n                             — max candidates returned (default 15)
 *   survey_time_hours                 — fixed survey overhead hours (default 1.0)
 *   surveyor_speed_kmh                — ground speed between cells (default 30)
 *   influence_radius_km               — POI influence radius (default 2.0)
 *   spatial_weight                    — neighbourhood coupling weight (default 0.25)
 *
 * The backend (MapService.getSurveyPriorities) fetches POIs from SQLite,
 * POSTs them to the ai-service POST /api/ai/survey/priorities, and caches the
 * ranked GeoJSON result for 3600 s. The whole computation is pure
 * server-side entropy + cost scoring (NO LLM).
 *
 * Public (no auth) — mirrors /api/map/gap-forecast and /api/map/data-gaps so
 * the survey planner renders for anonymous visitors.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const url = new URL(`${getBackendUrl()}/map/survey/priorities`);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

    const response = await fetch(url.toString(), { headers, next: { revalidate: 0 } });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải kế hoạch khảo sát' },
        { status: response.status },
      );
    }

    const data = await response.json();
    // Backend wraps as { success, data } — unwrap to the GeoJSON payload.
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
