import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${getBackendUrl()}/surveys`);
    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data), { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const response = await fetch(`${getBackendUrl()}/surveys`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(unwrapApiResponse(data), { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
