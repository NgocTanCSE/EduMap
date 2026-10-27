import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

/**
 * POST /api/ai/knowledge/sync  →  proxy to NestJS /ai/knowledge/sync
 *
 * Trigger (re)build of the knowledge graph from source tables (ai-service).
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json().catch(() => ({}));

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const response = await fetch(`${getBackendUrl()}/ai/knowledge/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('knowledge/sync route error:', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi kết nối knowledge graph sync' },
      { status: 500 }
    );
  }
}
