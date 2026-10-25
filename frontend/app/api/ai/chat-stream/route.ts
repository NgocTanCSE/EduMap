import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';

export async function POST(req: Request) {
  const body = await req.json();
  const { message, history, context, session_id } = body;

  const authHeader = req.headers.get('Authorization');

  // Proxy SSE stream from backend → frontend
  const backendResponse = await fetch(`${getBackendUrl()}/ai/chat-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ message, history, context, session_id }),
  });

  if (!backendResponse.ok) {
    const errorText = await backendResponse.text();
    let errorData: any = {};
    try { errorData = JSON.parse(errorText); } catch { /* not JSON */ }

    return NextResponse.json(
      {
        message: 'AI streaming service returned an error.',
        status: backendResponse.status,
        detail: errorData?.message || errorData?.detail || errorText.slice(0, 300),
      },
      { status: backendResponse.status }
    );
  }

  // Pipe the SSE stream to the client
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const reader = backendResponse.body?.getReader();

  if (!reader) {
    return new Response('No response body', { status: 502 });
  }

  // Start reading from backend and writing to frontend
  const pump = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          writer.close();
          break;
        }
        writer.write(value);
      }
    } catch (e) {
      writer.close();
      console.error('Stream forwarding error:', e);
    } finally {
      reader.releaseLock();
    }
  };

  pump();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
