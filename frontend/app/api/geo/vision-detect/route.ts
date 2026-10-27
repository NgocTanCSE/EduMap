import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * POST /api/geo/vision-detect — BFF proxy to NestJS backend GeoController.
 *
 * Forwards { bbox, zoom?, source?, labels? } to the backend which runs the
 * full T1+T2+T3 pipeline (tile stitching → HF Inference API owlV2 → cross-check).
 *
 * Auth is forwarded so the backend can optionally log detections per user.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const body = await req.json();

    const response = await fetch(`${getBackendUrl()}/geo/vision-detect`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend vision-detect error:', errorText);
      return NextResponse.json(
        { message: errorText || 'Không thể chạy phát hiện GeoVision' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('GeoVision vision-detect BFF error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ GeoVision', error: String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
