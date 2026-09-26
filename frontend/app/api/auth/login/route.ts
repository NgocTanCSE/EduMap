import { NextRequest, NextResponse } from 'next/server';

// --- DEMO MODE: Mock auth response (no backend call) ---
const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vLXVzZXIiLCJlbWFpbCI6Imd1ZXN0QGVkdW1hcC5sb2NhbCIsInJvbGUiOiJhZG1pbiIsImZ1bGxfbmFtZSI6Ikd1ZXN0IFVzZXIiLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTcwMDAwMDAwMH0.signature';

const MOCK_USER = {
  userId: 'demo-user',
  email: 'guest@edumap.local',
  full_name: 'Guest User',
  role: 'admin',
  avatar_url: 'https://ui-avatars.com/api/?name=Guest+User&background=random',
};

export async function POST(req: NextRequest) {
  // DEMO MODE: Always return mock auth data — no backend login required.
  return NextResponse.json({
    access_token: MOCK_TOKEN,
    refresh_token: MOCK_TOKEN,
    data: MOCK_USER,
    ...MOCK_USER,
  });
}
