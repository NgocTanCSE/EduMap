import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers['Authorization'] = authHeader;
  try {
    const url = new URL(`${getBackendUrl()}/summer/campaigns/${id}/daily-report`);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
    const response = await fetch(url.toString(), { headers });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(unwrapApiResponse(data), { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
