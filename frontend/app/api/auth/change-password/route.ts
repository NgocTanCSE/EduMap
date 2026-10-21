import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
import { requireAuth } from '@/src/lib/auth-utils';

export async function POST(req: NextRequest) {
  // Defense-in-depth: reject forged/expired bearer tokens at the BFF before
  // they ever reach the backend auth/change-password handler.
  const authError = requireAuth(req);
  if (authError) return authError;
  try {
    const body = await req.json();
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) headers['Authorization'] = authHeader;

    const response = await fetch(`${getBackendUrl()}/auth/change-password`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Đổi mật khẩu thất bại' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ xác thực' },
      { status: 500 }
    );
  }
}