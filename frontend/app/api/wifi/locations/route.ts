import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest) {
    
  try {
    const response = await fetch(`${getBackendUrl()}/wifi/locations`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải danh sách Wifi' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ wifi' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
  const body = await req.json();

  if (!authHeader) {
    return NextResponse.json(
      { message: 'Vui lòng đăng nhập để báo cáo Wifi' },
      { status: 401 }
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
  };

  try {
    const response = await fetch(`${getBackendUrl()}/wifi/locations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể báo cáo Wifi mới' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ wifi' },
      { status: 500 }
    );
  }
}