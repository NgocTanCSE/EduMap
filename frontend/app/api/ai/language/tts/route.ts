import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * POST /api/ai/language/tts — BFF proxy → backend NestJS
 *            POST /api/ai/language/tts (AiController).
 *
 * Body: { text, language?, voice? }
 * Returns: { audio_base64, audio_format, duration_ms, provider, degraded, ... }
 *
 * TTS is NOT cached on the backend (audio size + user params are volatile).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const body = await req.json();
    const response = await fetch(`${getBackendUrl()}/ai/language/tts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const detail = data?.message || data?.detail || 'Không thể tạo giọng nói.';
      return NextResponse.json(
        {
          message: detail,
          audio_base64: null,
          audio_format: 'mp3',
          duration_ms: 0,
          provider: null,
          degraded: true,
          reason: 'TTS không khả dụng.',
          language: body?.language || 'vi',
        },
        { status: response.status },
      );
    }

    return NextResponse.json(unwrapApiResponse(data));
  } catch (error: any) {
    console.error('Language TTS BFF error:', error);
    return NextResponse.json(
      {
        message: 'Lỗi kết nốp tới AI Service.',
        audio_base64: null,
        audio_format: 'mp3',
        duration_ms: 0,
        provider: null,
        degraded: true,
        reason: error?.message || 'Lỗi kết nối.',
        language: '',
      },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
