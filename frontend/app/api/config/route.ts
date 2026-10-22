import { NextResponse } from 'next/server';

// Runtime config MUST be rendered per-request. Without this, Next.js 14
// prerenders this GET handler at build time (it uses no dynamic APIs), so
// `googleClientId` is frozen to the build-time value — and on HF Spaces the
// secret is only available at RUNTIME, not at build time, so it would be ''.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Runtime configuration endpoint.
 *
 * NEXT_PUBLIC_* environment variables are inlined at *build* time by Next.js.
 * This route reads env vars at runtime (server-side) and exposes them to the
 * frontend via a normal fetch call, so values injected by Docker Compose
 * environment are available even when inlined at build time.
 *
 * Add any public config here, e.g.:
 *   { googleClientId: "123-abc.apps.googleusercontent.com" }
 */
export async function GET() {
  // `GOOGLE_CLIENT_ID` first: it is a real runtime env var (HF Spaces secret).
  // `NEXT_PUBLIC_*` is inlined by Next.js at build time, so on HF it is empty
  // unless it was passed as a build arg.
  const config = {
    googleClientId: (
      process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
    ).trim(),
  };

  return NextResponse.json(
    { config },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
