import { NextResponse } from 'next/server';

/**
 * Runtime configuration endpoint.
 *
 * NEXT_PUBLIC_* environment variables are inlined at *build* time by Next.js,
 * which means Space Secrets on Hugging Face (available only at *runtime*)
 * cannot reach the client bundle.  This route reads env vars at runtime
 * (server-side) and exposes them to the frontend via a normal fetch call.
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
