import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

/**
 * POST /api/ai/speech/to-text  →  proxy to NestJS /api/ai/speech/to-text
 *
 * Voice-to-Geo AI (Idea #16, Task 2) — server-side Speech-to-Text fallback.
 *
 * The frontend prefers the client-side Web Speech API (privacy — no audio
 * leaves the browser). When Chrome's Vietnamese recognition is unreliable,
 * the voice-search page base64-encodes the recorded audio and posts it here.
 * The BFF proxies to the NestJS backend, which forwards to the ai-service
 * (XKIRO Whisper via curl).
 *
 * Source: https://docs.xkiro.com/api/api-reference/stt/create-transcription.md
 *
 * Always returns 200 (degraded when Whisper is unavailable) so the frontend
 * can fall back to the client-side transcript.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const response = await fetch(`${getBackendUrl()}/ai/speech/to-text`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    // The backend/ai-service already returns a degraded payload (not a 5xx)
    // on Whisper failure, so just pass it through with the original status.
    return NextResponse.json(data, { status: response.ok ? 200 : response.status });
  } catch (error: any) {
    console.error('speech/to-text route error:', error);
    // Network error to backend → degrade so the frontend keeps the
    // client-side Web Speech transcript.
    return NextResponse.json(
      {
        text: '',
        language: 'vi',
        method: 'fallback',
        degraded: true,
        error: 'Không thể kết nối tới dịch vụ chuyển đổi giọn (STT). Vui lòng dùng nhận dạng giọng nói trên trình duyệt.',
      },
      { status: 200 },
    );
  }
}
