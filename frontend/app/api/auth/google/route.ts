import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backendUrl = getBackendUrl();
    const targetUrl = `${backendUrl}/auth/google`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: data.message || 'Đăng nhập Google thất bại.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error: any) {
    console.error('API Route Google Auth Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới máy chủ xác thực.' },
      { status: 500 }
    );
  }
}
