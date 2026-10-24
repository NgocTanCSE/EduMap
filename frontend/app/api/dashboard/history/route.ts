import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return NextResponse.json(
      { message: 'Vui lòng đăng nhập để xem lịch sử hoạt động' },
      { status: 401 }
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
  };

  try {
    const response = await fetch(`${getBackendUrl()}/dashboard/history`, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải lịch sử hoạt động' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // NestJS wraps every response as { success, data, timestamp }. Unwrap it so
    // the client receives the raw array instead of the envelope object.
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ dashboard' },
      { status: 500 }
    );
  }
}
