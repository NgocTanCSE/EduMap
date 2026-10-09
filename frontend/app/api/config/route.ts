import { NextResponse } from 'next/server';

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
  const config = {
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
  };

  return NextResponse.json({ config });
}
