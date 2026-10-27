import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export const dynamic = 'force-dynamic';

/**
 * BFF proxy: GET /api/learning-spaces/recommend
 * → NestJS backend GET /api/learning-spots/recommend
 * (query params forward lat, lng, radius, filters, weights)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(`${getBackendUrl()}/learning-spots/recommend`);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

    const response = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data), { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}
