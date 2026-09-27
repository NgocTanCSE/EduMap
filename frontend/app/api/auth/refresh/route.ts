import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backendUrl = getBackendUrl();
    const targetUrl = backendUrl.endsWith('/api')
      ? `${backendUrl}/auth/refresh`
      : `${backendUrl}/api/auth/refresh`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('API Route Refresh Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ xác thực.' },
      { status: 500 }
    );
  }
}

