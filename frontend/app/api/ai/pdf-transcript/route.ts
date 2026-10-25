import { NextResponse } from 'next/server';
import { getAIServiceUrl } from '@/src/lib/api-config';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.arrayBuffer();

  // Proxy trực tiếp từ BFF tới ai-service (tránh double-serialize multipart form ở backend NestJS)
  const aiServiceUrl = getAIServiceUrl();

  const response = await fetch(`${aiServiceUrl}/api/ai/pdf/transcript`, {
    method: 'POST',
    headers: {
      ...(authHeader ? { 'Authorization': authHeader } : {}),
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  return NextResponse.json(data);
  } catch (error: any) {
    console.error('PDF Transcript API Error:', error);
    return NextResponse.json(
      { message: 'Lỗi xử lý PDF. Vui lòng thử lại.', detail: error.message },
      { status: 500 }
    );
  }
}
