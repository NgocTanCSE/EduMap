import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
    const authHeader = req.headers.get('Authorization');
  const body = await req.json();

  if (!authHeader) {
    return NextResponse.json(
      { message: 'Vui lòng đăng nhập để đặt thiết bị' },
      { status: 401 }
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
  };

  try {
    const response = await fetch(`${getBackendUrl()}/stem/labs/${id}/book`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể đặt thiết bị STEM Lab' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ STEM' },
      { status: 500 }
    );
  }
}