import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * BFF: GET /api/admin/auto-scheduler/health
 *
 * Trả về trạng thái Auto-Scheduler: task nào đang chạy, cache có data không,
 * số lượng hit/miss. Dành cho trang admin theo dõi.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authHeader ? { Authorization: authHeader } : {}),
  };

  const url = `${getBackendUrl()}/admin/auto-scheduler/health`;

  try {
    const response = await fetch(url, { headers, next: { revalidate: 0 } });
    if (!response.ok) {
      return NextResponse.json(
        { message: 'Không thể lấy trạng thái auto-scheduler' },
        { status: response.status }
      );
    }
    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('Auto-scheduler health BFF error:', error);
    return NextResponse.json(
      {
        message: 'Lỗi kết nối tới backend',
        scheduler_enabled: false,
        running: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
