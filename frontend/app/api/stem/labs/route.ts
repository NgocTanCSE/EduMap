import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export async function GET(req: NextRequest) {
    
  try {
    const response = await fetch(`${getBackendUrl()}/stem/labs`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải danh sách STEM Lab' },
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
      { message: 'Lỗi kết nối tới dịch vụ STEM' },
      { status: 500 }
    );
  }
}