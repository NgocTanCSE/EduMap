import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    // Forward the original query string so search/pagination params (limit,
    // keyword, job_type, etc.) reach the NestJS backend correctly.
    const backendUrl = new URL(`${getBackendUrl()}/career/jobs`);
    backendUrl.search = req.nextUrl.search;

    const response = await fetch(backendUrl.toString(), { headers });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}