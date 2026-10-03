import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

// GET: list POIs by optional category + bounds. Proxies to backend GET /map/pois.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const searchParams = req.nextUrl.searchParams;
  const minLat = searchParams.get('minLat');
  const maxLat = searchParams.get('maxLat');
  const minLng = searchParams.get('minLng');
  const maxLng = searchParams.get('maxLng');
  const category = searchParams.get('category');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    let url = `${getBackendUrl()}/map/pois`;
    const params = new URLSearchParams();
    if (minLat) params.set('minLat', minLat);
    if (maxLat) params.set('maxLat', maxLat);
    if (minLng) params.set('minLng', minLng);
    if (maxLng) params.set('maxLng', maxLng);
    if (category && category !== 'all') params.set('category', category);
    if (params.toString()) url += `?${params.toString()}`;

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

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
  const body = await req.json();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const response = await fetch(`${getBackendUrl()}/map/pois`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tạo điểm địa lý mới' },
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