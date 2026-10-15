import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

// GET + params.id. (Was POST w/ split('...').pop() -> grabbed the literal
// 'check-eligibility' token, and POST mismatched the backend @Get route, so the
// scholarship 'Kiểm tra phù hợp' button always failed.)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = {};
  if (authHeader) headers['Authorization'] = authHeader;
  try {
    const response = await fetch(`${getBackendUrl()}/scholarships/${id}/check-eligibility`, {
      headers,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ message: 'Lỗi kết nối' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
