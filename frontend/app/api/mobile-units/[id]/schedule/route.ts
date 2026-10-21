import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers['Authorization'] = authHeader;
  try {
    const response = await fetch(`${getBackendUrl()}/mobile-units/${id}/schedule`, { headers });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(unwrapApiResponse(data), { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
