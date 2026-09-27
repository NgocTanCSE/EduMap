import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backendUrl = getBackendUrl();
    const targetUrl = backendUrl.endsWith('/api')
      ? `${backendUrl}/auth/login`
      : `${backendUrl}/api/auth/login`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email hoặc mật khẩu.' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API Route Login Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới máy chủ xác thực.' },
      { status: 500 }
    );
  }
}

