import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * BFF for AI Impact Measurement (Idea #19).
 *
 * Proxies to the NestJS backend `GET /api/impact-measurement/measure`
 * (which itself merges the backend before/after diff with the ai-service
 * trend analysis / confidence interval / impact score / narrative).
 *
 * The auth header is forwarded so the backend JWT guard is honoured.
 * On the free HF plan the ai-service degrades gracefully — this route never
 * 502s: a missing/invalid token surfaces as 401, everything else surfaces as 500
 * with a safe message.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ message: 'Vui lòng đăng nhập để xem dashboard' }, { status: 401 });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: authHeader,
  };

  // Forward only the region-selection query params (ignore unknown ones).
  const allowed = ['minLat', 'maxLat', 'minLng', 'maxLng', 'lat', 'lng', 'radiusKm', 'deploymentDate', 'region'];
  const params = new URLSearchParams();
  for (const k of allowed) {
    const v = req.nextUrl.searchParams.get(k);
    if (v !== null) params.set(k, v);
  }
  const qs = params.toString();
  const url = `${getBackendUrl()}/impact-measurement/measure${qs ? `?${qs}` : ''}`;

  try {
    const response = await fetch(url, { headers, next: { revalidate: 0 } });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend impact-measurement error:', response.status, errorText);
      return NextResponse.json(
        { message: 'Không thể tải báo cáo đo lường tác động' },
        { status: response.status }
      );
    }
    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('Impact Measurement BFF error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối tới dịch vụ đo lường tác động' }, { status: 500 });
  }
}
