import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * BFF: POST /api/offline/tutor
 *
 * Forwards the offline tutor request to the NestJS backend
 * (POST /api/offline/tutor → ai-service POST /api/offline/tutor).
 *
 * Auth is OPTIONAL — the offline tutor works without login, using
 * template fallback + local model. If a token is present it is forwarded
 * so the ai-service can log user interactions.
 *
 * The response is unwrapped from the NestJS ResponseInterceptor envelope
 * ({ success, data, timestamp }) before returning to the client.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Forward auth header if present (best-effort — endpoint is public)
    const authHeader = req.headers.get('Authorization');

    const response = await fetch(`${getBackendUrl()}/offline/tutor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = null;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        /* not JSON */
      }

      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          {
            message: 'Bạn cần đăng nhập để sử dụng tính năng này.',
            error: 'AUTH_REQUIRED',
            detail: errorData?.message || errorText.slice(0, 200),
          },
          { status: response.status },
        );
      }

      return NextResponse.json(
        {
          message: 'Offline tutor trả về lỗi.',
          status: response.status,
          detail: errorData?.message || errorData?.detail || errorText.slice(0, 300),
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error: any) {
    console.error('[BFF /api/offline/tutor] Error:', error);

    // Last-resort fallback: return a template-based response so the
    // user always sees *something* instead of a blank screen.
    return NextResponse.json(
      {
        action: 'explain',
        topic: 'chương học',
        degraded: true,
        source: 'bff-fallback',
        text: 'Hiện tại không thể kết nối tới trợ lý AI. Vui lòng thử lại sau.',
        model_used: null,
      },
      { status: 200 },
    );
  }
}

/**
 * BFF: GET /api/offline/tutor/status
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');

    const response = await fetch(`${getBackendUrl()}/offline/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { model_loaded: false, model_failed: true, source: 'bff-fallback' },
        { status: 200 },
      );
    }

    const data = await response.json();
    return NextResponse.json(unwrapApiResponse(data));
  } catch (error: any) {
    console.error('[BFF /api/offline/status] Error:', error);
    return NextResponse.json(
      { model_loaded: false, model_failed: true, source: 'bff-fallback' },
      { status: 200 },
    );
  }
}
