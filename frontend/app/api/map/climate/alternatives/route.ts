import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * POST /api/map/climate/alternatives
 *
 * BFF proxy → backend POST /api/map/climate/alternatives (MapController),
 * which proxies the ai-service POST /api/ai/climate/alternatives and returns
 * safe alternative learning locations as GeoJSON.
 *
 * Body: { lat, lng, minLat, maxLat, minLng, maxLng, radiusKm, category }
 *
 * Public (no auth) — anonymous visitors can find safe learning spots.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const url = `${getBackendUrl()}/map/climate/alternatives`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải phương án thay thế' },
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
