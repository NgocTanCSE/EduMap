import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
import { requireAuth } from '@/src/lib/auth-utils';

export async function GET(req: NextRequest) {
  // Defense-in-depth: reject forged/expired bearer tokens at the BFF.
  const authError = requireAuth(req);
  if (authError) return authError;
  const url = `${getBackendUrl()}/auth/me`;
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return NextResponse.json(
        { message: 'Không thể lấy thông tin người dùng' },
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

export async function PATCH(req: NextRequest) {
  // Defense-in-depth: reject forged/expired bearer tokens at the BFF.
  const authError = requireAuth(req);
  if (authError) return authError;
  const url = `${getBackendUrl()}/auth/profile`;
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const body = await req.json();
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể cập nhật hồ sơ' },
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
