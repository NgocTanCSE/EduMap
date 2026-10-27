import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * GET /api/map/data-gaps — BFF proxy to the NestJS backend.
 *
 * Query params:
 *   grid_size_km  (float, default 1.0) — grid cell side in km
 *   top_n         (int,   default 50)   — max gap cells to return
 *   min_lat,max_lat,min_lng,max_lng    — optional bounding box
 *   categories    (comma-separated)     — optional category filter
 *
 * The backend (MapService.getDataGaps) fetches POIs from SQLite, POSTs them
 * to the ai-service /api/ai/data/gaps, and caches the GeoJSON result for
 * 3600 s (in-process TTL on HF Spaces). Returns a GeoJSON FeatureCollection
 * of gap cells + attribute_gaps summary.
 *
 * Public (no auth) — mirrors /api/map/gap-forecast and /api/map/stats so the
 * data-hunter map renders for anonymous visitors.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const url = new URL(`${getBackendUrl()}/map/data-gaps`);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

    const response = await fetch(url.toString(), { headers, next: { revalidate: 0 } });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải phân tích khoảng trống dữ liệu' },
        { status: response.status },
      );
    }

    const data = await response.json();
    // Backend wraps as { success, data } — unwrap to the GeoJSON payload.
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ bản đồ' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
