import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const query = new URLSearchParams();
  
  searchParams.forEach((value, key) => {
    query.set(key, value);
  });

    const authHeader = req.headers.get('Authorization');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const response = await fetch(`${getBackendUrl()}/admin/users?${query.toString()}`, { headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải danh sách người dùng' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ admin' },
      { status: 500 }
    );
  }
}