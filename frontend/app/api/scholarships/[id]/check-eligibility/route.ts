import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * BFF proxy for scholarship eligibility check.
 *
 * Frontend `scholarship.service.ts` sends POST w/ an optional JSON body
 * containing transcript data (GPA, courses — extracted from an uploaded PDF).
 * The NestJS backend (`@Post(':id/check-eligibility')`) expects POST + body.
 *
 * Previously this route was GET-only and did **not** forward the body, causing
 * the frontend's POST to receive 405 and transcript data to be silently lost.
 * Now both GET (legacy, no body) and POST (with transcript body) are supported.
 */

async function _proxyToBackend(
  id: string,
  authHeader: string | null,
  method: 'GET' | 'POST',
  body: any,
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  const response = await fetch(`${getBackendUrl()}/scholarships/${id}/check-eligibility`, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(unwrapApiResponse(data), { status: response.status });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const authHeader = req.headers.get('Authorization');
  const body = await req.json().catch(() => ({}));
  try {
    return await _proxyToBackend(id, authHeader, 'POST', body);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const authHeader = req.headers.get('Authorization');
  try {
    return await _proxyToBackend(id, authHeader, 'GET', undefined);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
