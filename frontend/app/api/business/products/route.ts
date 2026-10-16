import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const businessProfileId = searchParams.get('businessProfileId');
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    if (!businessProfileId) {
      return NextResponse.json(
        { message: 'businessProfileId là bắt buộc' },
        { status: 422 }
      );
    }

    const response = await fetch(`${getBackendUrl()}/business/${businessProfileId}/products`, { headers });
    const data = await response.json();
    return NextResponse.json(data.data ?? data, { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const businessProfileId = searchParams.get('businessProfileId');
    const body = await req.json();
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const bpId = businessProfileId || body.businessProfileId;
    if (!bpId) {
      return NextResponse.json(
        { message: 'businessProfileId là bắt buộc' },
        { status: 422 }
      );
    }

    const response = await fetch(`${getBackendUrl()}/business/${bpId}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data.data ?? data, { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}