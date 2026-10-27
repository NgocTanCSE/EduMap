import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * GET /api/map/climate-risk?minLat=...&maxLat=...&minLng=...&maxLng=...
 *      (or &lat=...&lng=...&radiusKm=...)
 *
 * BFF proxy → backend GET /api/map/climate-risk (MapController), which proxies
 * the ai-service POST /api/ai/climate/risk and caches the GeoJSON result.
 * Returns a GeoJSON risk heatmap with heat_points, risk_ranking, and metadata.
 *
 * Public (no auth) — the climate risk map renders for anonymous visitors.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  const params = new URLSearchParams();
  for (const key of ['minLat', 'maxLat', 'minLng', 'maxLng', 'lat', 'lng', 'radiusKm', 'date']) {
    const val = searchParams.get(key);
    if (val) params.set(key, val);
  }
  const qs = params.toString();

  try {
    const url = `${getBackendUrl()}/map/climate-risk${qs ? `?${qs}` : ''}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải bản đồ rủi ro khí hậu' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ Bảo Vệ Khí Hậu' },
      { status: 500 },
    );
  }
}
