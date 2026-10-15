import { NextRequest, NextResponse } from 'next/server';

// The ai-service runs on the same Docker network as the frontend container
// (the backend reaches it at http://ai-service:8000). The frontend compose
// override does not export AI_SERVICE_URL, so fall back to that address.
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://ai-service:8000').replace(/\/$/, '');

/** Decode a JWT payload (base64url) WITHOUT verifying the signature. */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate via the bearer token forwarded by the client page.
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ message: 'Chưa xác thực người dùng' }, { status: 401 });
    }

    // 2. Derive user_id from the JWT `sub` claim. The NestJS backend is a
    //    baked image (no source bind-mount) and its learning-path controller
    //    normally augments user_id from req.user — but `/api/ai/learning-path`
    //    is now handled right here (excluded from the backend rewrite), so we
    //    extract the identity ourselves. The ai-service requires user_id.
    const payload = decodeJwtPayload(token);
    const userId = payload?.sub;
    if (!userId) {
      return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }

    // 3. Re-build the learning-path payload (page sends target_level fields).
    const body = await req.json();
    const data = {
      user_id: userId,
      current_level: body.current_level || 'Beginner',
      target_role: body.target_role || 'AI Developer',
      time_commitment_hours_per_week: body.time_commitment_hours_per_week || 10,
    };

    // 4. Call ai-service with the CORRECT trailing slash so the FastAPI route
    //    is hit directly (POST /api/ai/learning-path/), avoiding the 307 that
    //    axios in the baked backend could not follow (which surfaced as 503).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    let aiRes: Response;
    try {
      aiRes = await fetch(`${AI_SERVICE_URL}/api/ai/learning-path/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const result = await aiRes.json().catch(() => null);
    if (!aiRes.ok) {
      return NextResponse.json(
        { message: result?.detail || result?.message || 'ai-service trả về lỗi' },
        { status: aiRes.status }
      );
    }

    // Forward the ai-service roadmap shape directly: {target_role,
    // total_estimated_months, steps} — the page renders `roadmap.steps` etc.
    //
    // 5. Enrich the roadmap with per-step sub-topics + learning resources by
    //    routing a single expansion request through the ai-service chat model.
    //    This is optional / best-effort: if the model times out or replies with
    //    unusable content, we gracefully fall back to the base role-specific
    //    roadmap so the page still renders a valid path.
    let detailed: string | undefined;
    try {
      const enrichController = new AbortController();
      const enrichTimeout = setTimeout(() => enrichController.abort(), 75_000);
      const chatRes = await fetch(`${AI_SERVICE_URL}/api/ai/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Bạn là trợ lý giáo dục. Dựa trên lộ trình: ${JSON.stringify(result)}. ` +
            `Mở rộng CHI TIẾT cho từng bước: mỗi bước liệt kê 2-3 sub-topic cụ thể và ` +
            `1-2 nguồn học (tên + URL). Trả về text thường, mỗi bước bắt đầu bằng "Bước N: <title>". ` +
            `Không cần lời chào, không dùng markdown đặc biệt.`,
          user_id: userId,
        }),
        signal: enrichController.signal,
      });
      clearTimeout(enrichTimeout);

      const chatJson = await chatRes.json().catch(() => null);
      const reply = typeof chatJson?.reply === 'string' ? chatJson.reply : '';
      // Sanity gate: only keep a reply that actually enumerates steps, which
      // filters out generic/empty model output.
      if (reply.length > 60 && /Bước\s*\d+/i.test(reply)) {
        const idx = reply.search(/Bước\s*\d+/i);
        detailed = (idx >= 0 ? reply.slice(idx) : reply).trim();
      }
    } catch (e: any) {
      console.warn(
        'learning-path enrichment skipped:',
        e?.name === 'AbortError' ? 'timeout' : e?.message
      );
    }

    return NextResponse.json(
      detailed ? { ...(result as object), detailed } : result,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('learning-path BFF error:', error);
    const isTimeout = error?.name === 'AbortError';
    return NextResponse.json(
      { message: isTimeout ? 'Dịch vụ AI phản hồi quá chậm' : 'Lỗi kết nối với AI Service' },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
