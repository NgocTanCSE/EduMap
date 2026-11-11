import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/src/lib/api-config';
import { unwrapApiResponse } from '@/src/lib/api-utils';

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization');
        const response = await fetch(`${getBackendUrl()}/offline/status`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { Authorization: authHeader } : {}),
            },
        });
        if (!response.ok) {
            return NextResponse.json({ model_loaded: false, model_failed: true, source: 'bff-fallback' }, { status: 200 });
        }
        const data = await response.json();
        return NextResponse.json(unwrapApiResponse(data));
    }
    catch (error: any) {
        console.error('[BFF /api/offline/tutor/status] Error:', error);
        return NextResponse.json({ model_loaded: false, model_failed: true, source: 'bff-fallback' }, { status: 200 });
    }
}
