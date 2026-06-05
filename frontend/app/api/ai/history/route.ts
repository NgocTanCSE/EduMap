import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const authHeader = req.headers.get('Authorization');

    const response = await fetch(`${BACKEND_URL}/ai/history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
    });

    if (!response.ok) {
      return NextResponse.json({ message: 'Không thể tải lịch sử chat.' }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ message: 'Lỗi máy chủ proxy.' }, { status: 500 });
  }
}
