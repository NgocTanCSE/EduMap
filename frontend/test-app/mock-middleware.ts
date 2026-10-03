/**
 * Next.js middleware integration for EduMap mock app.
 *
 * When NEXT_PUBLIC_USE_MOCK=true, the middleware intercepts /api/* calls
 * and returns mock data instead of proxying to the NestJS backend.
 *
 * This is ONLY for local development testing — NOT used in Docker/HF.
 *
 * Install in frontend root:
 *   cp test-app/mock-middleware.ts middleware.ts
 *   (or reference this file in next.config.js)
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { mockHandlers, findMockHandler } from './mock-handlers';

export function mockMiddleware(req: NextRequest) {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
  if (!useMock) return NextResponse.next();

  const url = req.nextUrl.pathname;

  // Only intercept API calls
  if (!url.startsWith('/api/')) return NextResponse.next();

  const handler = findMockHandler(req.method, url);
  if (!handler) return NextResponse.next();

  let body: any = {};
  try {
    // @ts-ignore — body is available in NextRequest
    body = req.body ? JSON.parse(req.body) : {};
  } catch {
    body = {};
  }

  const result = handler.handler({ body, query: {}, params: {} });
  return NextResponse.json(result);
}

export const config = {
  matcher: '/api/:path*',
};
