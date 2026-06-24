import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const minLat = searchParams.get('minLat');
  const maxLat = searchParams.get('maxLat');
  const minLng = searchParams.get('minLng');
  const maxLng = searchParams.get('maxLng');
  const category = searchParams.get('category');

    
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    let url = `${getBackendUrl()}/map/locations`;
    const queryParams = new URLSearchParams();
    if (minLat) queryParams.set('minLat', minLat);
    if (maxLat) queryParams.set('maxLat', maxLat);
    if (minLng) queryParams.set('minLng', minLng);
    if (maxLng) queryParams.set('maxLng', maxLng);
    if (category && category !== 'all') queryParams.set('category', category);
    
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải dữ liệu bản đồ từ server' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ bản đồ' },
      { status: 500 }
    );
  }
}