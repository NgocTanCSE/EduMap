import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
import { authService } from '@/src/services/auth.service';

/**
 * BFF proxy → NestJS backend POST /api/admin/data-quality/report
 * Auth: JWT Bearer token forwarded to backend, which enforces JwtAuthGuard
 *       + RolesGuard (admin || moderator).
 */
export async function POST(req: NextRequest) {
  const token = authService.getAccessToken();
  if (!token) {
    return NextResponse.json({ message: 'Vui lòng đăng nhập' }, { status: 401 });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  try {
    const body = await req.json();
    const response = await fetch(
      `${getBackendUrl()}/admin/data-quality/report`,
      { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { message: 'Không thể tạo báo cáo chất lượng dữ liệu' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error: any) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json(
        { message: 'Báo cáo chất lượng dữ liệu đang thời gian chờ (timeout). Vui lòng thử lại.' },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ admin' },
      { status: 500 },
    );
  }
}
