import * as crypto from 'crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
const JWT_SECRET = process.env.JWT_SECRET || '';
export function verifyJwt(token: string): Record<string, any> | null {
    if (!JWT_SECRET)
        return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const [encodedHeader, encodedPayload, signature] = parts;
        const expectedSig = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest('base64url');
        const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
        if (!valid)
            return null;
        const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
        if (payload.exp && Date.now() >= payload.exp * 1000)
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
export function requireAuth(req: NextRequest): NextResponse | null {
    if (!JWT_SECRET)
        return null;
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token)
        return null;
    if (!verifyJwt(token)) {
        return NextResponse.json({ message: 'Token không hợp lệ' }, { status: 401 });
    }
    return null;
}
