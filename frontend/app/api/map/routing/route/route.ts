import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

// GET /api/map/routing/route?lng1=&lat1=&lng2=&lat2=&alternatives=...
// Proxies EduMap's INTERNAL OSRM-based routing to the backend
// (backend route: GET /map/routing/route, public — no Google Maps).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const searchParams = req.nextUrl.searchParams;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    let url = `${getBackendUrl()}/map/routing/route`;
    // Pass through every routing query param (lng1/lat1/lng2/lat2/...) untouched.
    const params = new URLSearchParams();
    searchParams.forEach((v, k) => {
      if (v !== null && v !== undefined) params.set(k, v);
    });
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Routing backend error:', errorText);
      return NextResponse.json(
        { success: false, message: 'Không thể tính lộ trình từ server' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Routing API Route Error:', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi kết nối tới dịch vụ chỉ đường' },
      { status: 500 }
    );
  }
}
