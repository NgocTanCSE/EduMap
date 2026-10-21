import * as crypto from 'crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * JWT secret shared with the NestJS backend. When unset, BFF-level verification
 * is skipped (verifyJwt returns null) and the backend's own JwtAuthGuard remains
 * the authority — this keeps the BFF safe to run in environments where only the
 * backend holds the secret.
 */
const JWT_SECRET = process.env.JWT_SECRET || '';

/**
 * Verify an HS256 JWT signature and expiration using the Node.js crypto module.
 *
 * Returns the decoded payload only if the signature is valid AND the token has
 * not expired; otherwise returns null.
 *
 * This logic was originally copy-pasted inline in
 * `frontend/app/api/ai/learning-path/route.ts`. It is centralised here so every
 * protected BFF route shares ONE vetted implementation (defense-in-depth at the
 * BFF layer, before requests are forwarded to the backend).
 */
export function verifyJwt(token: string): Record<string, any> | null {
  if (!JWT_SECRET) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;

    // Reconstruct the signing input and recompute the HMAC.
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks.
    const valid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig),
    );
    if (!valid) return null;

    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(
      Buffer.from(padded, 'base64').toString('utf8'),
    );

    // Reject expired tokens.
    if (payload.exp && Date.now() >= payload.exp * 1000) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Defense-in-depth: verify the bearer JWT at the BFF layer BEFORE forwarding
 * the request to the backend.
 *
 * - Token present but **invalid / expired** → returns a 401 NextResponse (the
 *   backend is never hit, reducing attack surface and load).
 * - Token **missing** → returns null. The request is forwarded to the backend,
 *   whose JwtAuthGuard decides whether to reject (this keeps public-ish flows
 *   working and avoids breaking endpoints that the backend may allow
 *   anonymously).
 * - Token present & **valid** → returns null (request proceeds).
 *
 * Usage at the top of a protected handler:
 *   const authError = requireAuth(req);
 *   if (authError) return authError; // 401
 */
export function requireAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null; // no token — let the backend decide
  if (!verifyJwt(token)) {
    return NextResponse.json(
      { message: 'Token không hợp lệ' },
      { status: 401 },
    );
  }
  return null;
}
