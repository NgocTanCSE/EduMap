import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history, context, session_id } = body;

    // Backend URL from env or fallback to local NestJS
    
    // Lấy token từ header của request đến Next.js
    const authHeader = req.headers.get('Authorization');

    const response = await fetch(`${getBackendUrl()}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
      body: JSON.stringify({ message, history, context, session_id }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = null;
      try { errorData = JSON.parse(errorText); } catch { /* not JSON */ }

      // Pass through auth errors with a clear, actionable message
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          {
            message: 'Bạn cần đăng nhập để sử dụng tính năng chat AI.',
            error: 'AUTH_REQUIRED',
            detail: errorData?.message || errorText.slice(0, 200),
          },
          { status: response.status }
        );
      }

      // For other errors, propagate the backend's status + detail
      return NextResponse.json(
        {
          message: 'AI Backend trả về lỗi.',
          status: response.status,
          detail: errorData?.message || errorData?.detail || errorText.slice(0, 300),
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi xử lý yêu cầu Chat AI.' },
      { status: 500 }
    );
  }
}
