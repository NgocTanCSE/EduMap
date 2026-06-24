import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
    
  try {
    const response = await fetch(`${getBackendUrl()}/career/paths/${id}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không tìm thấy lộ trình nghề nghiệp' },
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