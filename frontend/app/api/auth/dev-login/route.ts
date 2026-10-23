import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * BFF proxy: POST /api/auth/dev-login (frontend)
 *            → POST /api/auth/dev-login (backend)
 *
 * Dev-only bypass that creates a real DB-backed user and returns a
 * properly-signed JWT so both frontend isLoggedIn() and backend JwtAuthGuard pass.
 */
export async function POST(req: NextRequest) {
  // Dev-only route. Keep it unavailable in production builds even if the
  // backend is misconfigured.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ENABLE_DEV_LOGIN !== 'true'
  ) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  try {
    const backendUrl = getBackendUrl();
    const targetUrl = `${backendUrl}/auth/dev-login`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Dev login thất bại.' },
        { status: response.status }
      );
    }

    return NextResponse.json(unwrapApiResponse(data));
  } catch (error: any) {
    console.error('API Route DevLogin Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới máy chủ xác thực.' },
      { status: 500 }
    );
  }
}
