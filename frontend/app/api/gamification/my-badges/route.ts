import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return NextResponse.json(
      { message: 'Vui lòng đăng nhập để xem huy hiệu' },
      { status: 401 }
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
  };

  try {
    const response = await fetch(`${getBackendUrl()}/gamification/my-badges`, { headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải huy hiệu cá nhân' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ gamification' },
      { status: 500 }
    );
  }
}