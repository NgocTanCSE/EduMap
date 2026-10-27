import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * POST /api/ai/language/translate — BFF proxy → backend NestJS
 *            POST /api/ai/language/translate (AiController).
 *
 * Body: { text, target_language, source_language?, glossary? }
 * Returns: { translated, detected_source, degraded, reason, ... }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const body = await req.json();
    const response = await fetch(`${getBackendUrl()}/ai/language/translate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const detail = data?.message || data?.detail || 'Không thể dịch văn bản.';
      return NextResponse.json(
        { message: detail, degraded: true, translated: '', target_language: body?.target_language || 'en' },
        { status: response.status },
      );
    }

    return NextResponse.json(unwrapApiResponse(data));
  } catch (error: any) {
    console.error('Language translate BFF error:', error);
    return NextResponse.json(
      {
        message: 'Lỗi kết nối tới AI Service.',
        translated: '',
        degraded: true,
        reason: error?.message || 'Lỗi kết nối.',
      },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
