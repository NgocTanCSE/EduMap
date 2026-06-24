import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const searchParams = req.nextUrl.searchParams;
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';

    
  try {
    const response = await fetch(`${getBackendUrl()}/community/posts/${id}/comments?page=${page}&limit=${limit}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải bình luận' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ cộng đồng' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
    const authHeader = req.headers.get('Authorization');
  const body = await req.json();

  if (!authHeader) {
    return NextResponse.json(
      { message: 'Vui lòng đăng nhập để bình luận' },
      { status: 401 }
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
  };

  try {
    const response = await fetch(`${getBackendUrl()}/community/posts/${id}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể gửi bình luận' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ cộng đồng' },
      { status: 500 }
    );
  }
}