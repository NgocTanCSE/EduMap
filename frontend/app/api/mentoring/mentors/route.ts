import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const specialty = searchParams.get('specialty') || '';

    const authHeader = req.headers.get('Authorization');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    let url = `${getBackendUrl()}/mentoring/mentors`;
    if (specialty) url += `?specialty=${encodeURIComponent(specialty)}`;

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải danh sách mentor' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ mentor' },
      { status: 500 }
    );
  }
}