import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${getBackendUrl()}/summer-campaigns`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Kh�ng th? t?i danh s�ch chi?n d?ch m�a h�' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'L?i k?t n?i t?i d?ch v? m�a h�' },
      { status: 500 }
    );
  }
}
