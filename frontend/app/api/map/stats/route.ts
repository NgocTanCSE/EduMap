import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

// GET: map stats (total + per-category counts). Proxies to backend GET /map/stats.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const response = await fetch(`${getBackendUrl()}/map/stats`, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải thống kê bản đồ' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nốn tới dịch vụ bản đồ' },
      { status: 500 }
    );
  }
}
