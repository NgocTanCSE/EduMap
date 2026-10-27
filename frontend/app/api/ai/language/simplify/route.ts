import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

/**
 * POST /api/ai/language/simplify — BFF proxy → backend NestJS
 *            POST /api/ai/language/simplify (AiController).
 *
 * Body: { text, difficulty?, context? }
 * Returns: { simplified, explained_terms, degraded, reason, difficulty, ... }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  try {
    const body = await req.json();
    const response = await fetch(`${getBackendUrl()}/ai/language/simplify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const detail = data?.message || data?.detail || 'Không thể đơn giản hóa văn bản.';
      return NextResponse.json({ message: detail, degraded: true, simplified: '', explained_terms: {} }, { status: response.status });
    }

    return NextResponse.json(unwrapApiResponse(data));
  } catch (error: any) {
    console.error('Language simplify BFF error:', error);
    return NextResponse.json(
      {
        message: 'Lỗi kết nối tới AI Service.',
        simplified: '',
        explained_terms: {},
        degraded: true,
        reason: error?.message || 'Lỗi kết nối.',
      },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
