import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

/**
 * BFF proxy for AI-powered semantic search.
 * Always URL-encodes the query parameter so that non-ASCII characters
 * (e.g. Vietnamese) are transmitted safely and the backend HTTP parser
 * never rejects the request with a 400.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const limit = searchParams.get('limit') || '5';

    // Double-encode-safety: encodeURIComponent on already-encoded input is a no-op
    const encodedQuery = encodeURIComponent(query);

    const backendUrl = getBackendUrl();
    const targetUrl = `${backendUrl}/ai/search?q=${encodedQuery}&limit=${limit}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json().catch(() => null);

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('AI Search BFF error:', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi kết nối tới AI Service' },
      { status: 500 }
    );
  }
}
