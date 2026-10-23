import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backendUrl = getBackendUrl();
    const targetUrl = `${backendUrl}/auth/refresh`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data), { status: response.status });
  } catch (error: any) {
    console.error('API Route Refresh Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ xác thực.' },
      { status: 500 }
    );
  }
}

