import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/src/lib/auth-utils';
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        if (!token) {
            return NextResponse.json({ message: 'Chưa xác thực người dùng' }, { status: 401 });
        }
        const payload = verifyJwt(token);
        const userId = payload?.sub;
        if (!userId) {
            return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
        }
        const body = await req.json();
        const data = {
            user_id: String(userId),
            current_level: body.current_level || 'Beginner',
            target_role: body.target_role || 'AI Developer',
            time_commitment_hours_per_week: body.time_commitment_hours_per_week || 10,
        };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        let aiRes: Response;
        try {
            aiRes = await fetch(`${AI_SERVICE_URL}/api/ai/learning-path/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: controller.signal,
            });
        }
        finally {
            clearTimeout(timeoutId);
        }
        const result = await aiRes.json().catch(() => null);
        if (!aiRes.ok) {
            return NextResponse.json({ message: result?.detail || result?.message || 'ai-service trả về lỗi' }, { status: aiRes.status });
        }
        let detailed: string | undefined;
        try {
            const enrichController = new AbortController();
            const enrichTimeout = setTimeout(() => enrichController.abort(), 75000);
            const chatRes = await fetch(`${AI_SERVICE_URL}/api/ai/chat/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Bạn là trợ lý giáo dục. Dựa trên lộ trình: ${JSON.stringify(result)}. ` +
                        `Mở rộng CHI TIẾT cho từng bước: mỗi bước liệt kê 2-3 sub-topic cụ thể và ` +
                        `1-2 nguồn học (tên + URL). Trả về text thường, mỗi bước bắt đầu bằng "Bước N: <title>". ` +
                        `Không cần lời chào, không dùng markdown đặc biệt.`,
                    user_id: String(userId),
                }),
                signal: enrichController.signal,
            });
            clearTimeout(enrichTimeout);
            const chatJson = await chatRes.json().catch(() => null);
            const reply = typeof chatJson?.reply === 'string' ? chatJson.reply : '';
            if (reply.length > 60 && /Bước\s*\d+/i.test(reply)) {
                const idx = reply.search(/Bước\s*\d+/i);
                detailed = (idx >= 0 ? reply.slice(idx) : reply).trim();
            }
        }
        catch (e: any) {
            console.warn('learning-path enrichment skipped:', e?.name === 'AbortError' ? 'timeout' : e?.message);
        }
        return NextResponse.json(detailed ? { ...(result as object), detailed } : result, { status: 200 });
    }
    catch (error: any) {
        console.error('learning-path BFF error:', error);
        const isTimeout = error?.name === 'AbortError';
        return NextResponse.json({ message: isTimeout ? 'Dịch vụ AI phản hồi quá chậm' : 'Lỗi kết nối với AI Service' }, { status: isTimeout ? 504 : 500 });
    }
}
