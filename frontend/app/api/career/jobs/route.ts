import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const query = new URLSearchParams();
  
  searchParams.forEach((value, key) => {
    query.set(key, value);
  });

    
  try {
    const response = await fetch(`${getBackendUrl()}/career/jobs?${query.toString()}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tìm kiếm việc làm' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ nghề nghiệp' },
      { status: 500 }
    );
  }
}