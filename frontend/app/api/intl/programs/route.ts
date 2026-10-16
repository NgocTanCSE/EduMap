import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(`${getBackendUrl()}/intl/programs`);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
    const response = await fetch(url.toString());
    const data = await response.json();
    return NextResponse.json(data.data ?? data, { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const response = await fetch(`${getBackendUrl()}/intl/programs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data.data ?? data, { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
