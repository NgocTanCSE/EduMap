import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';
import { requireAuth } from '@/src/lib/auth-utils';

export async function GET(req: NextRequest) {
  // Defense-in-depth: verify JWT at BFF layer before forwarding
  const authError = requireAuth(req);
  if (authError) return authError;

  const authHeader = req.headers.get('Authorization');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': authHeader || '',
  };

  try {
    const response = await fetch(`${getBackendUrl()}/gamification/my-progress`, { headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể tải tiến độ cá nhân' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi kết nối tới dịch vụ gamification' },
      { status: 500 }
    );
  }
}