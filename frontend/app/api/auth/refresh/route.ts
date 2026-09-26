import { NextRequest, NextResponse } from 'next/server';

// --- DEMO MODE: Mock refresh response (no backend call) ---
const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vLXVzZXIiLCJlbWFpbCI6Imd1ZXN0QGVkdW1hcC5sb2NhbCIsInJvbGUiOiJhZG1pbiIsImZ1bGxfbmFtZSI6Ikd1ZXN0IFVzZXIiLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTcwMDAwMDAwMH0.signature';

export async function POST(req: NextRequest) {
  // DEMO MODE: Always return fresh mock tokens — no backend refresh required.
  return NextResponse.json({
    access_token: MOCK_TOKEN,
    refresh_token: MOCK_TOKEN,
  });
}
