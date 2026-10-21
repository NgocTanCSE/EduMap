import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '10';

    
  try {
    const response = await fetch(`${getBackendUrl()}/scholarships?page=${page}&limit=${limit}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải danh sách học bổng' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Backend ResponseInterceptor wraps: { success, data: <payload>, timestamp }
    // Unwrap to the payload so frontend array ops (filter, map, length) work
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ học bổng' },
      { status: 500 }
    );
  }
}