import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history, context } = body;

    // Backend URL from env or fallback to local NestJS
    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    // Lấy token từ header của request đến Next.js
    const authHeader = req.headers.get('Authorization');

    const response = await fetch(`${BACKEND_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
      body: JSON.stringify({ message, history, context }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json(
        { message: 'Không thể kết nối với dịch vụ AI Backend.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { message: 'Lỗi xử lý yêu cầu Chat AI.' },
      { status: 500 }
    );
  }
}
