import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

// GET /api/map/safe-route?lng1=&lat1=&lng2=&lat2=&avoidFlood=&avoidTraffic=&safetyWeight=
//
// SafeRoute AI (Idea #12) — proxies to the backend's weighted multi-criteria
// routing endpoint. Returns multiple route alternatives with safety scores.
// Backend route: GET /map/safe-route (MapController).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const searchParams = req.nextUrl.searchParams;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    let url = `${getBackendUrl()}/map/safe-route`;
    const params = new URLSearchParams();
    searchParams.forEach((v, k) => {
      if (v !== null && v !== undefined) params.set(k, v);
    });
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(url, { headers, cache: 'no-store' });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SafeRoute backend error:', errorText);
      return NextResponse.json(
        { success: false, message: 'Không thể tính lộ trình an toàn từ server' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('SafeRoute API Route Error:', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi kết nối tới dịch vụ chỉ đường an toàn' },
      { status: 500 }
    );
  }
}
