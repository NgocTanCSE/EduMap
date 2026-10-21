import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(`${getBackendUrl()}/opportunities`);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));
    const response = await fetch(url.toString());
    const data = await response.json();
    // Backend ResponseInterceptor wraps: { success, data: <payload>, timestamp }
    // Unwrap to the payload so frontend array ops (filter, map, length) work
    return NextResponse.json(unwrapApiResponse(data), { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}
