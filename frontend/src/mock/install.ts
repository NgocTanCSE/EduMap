/* Installs the mock API by patching window.fetch for same-origin /api/* requests. */
import { resetDb } from './core';
import { handleMockRequest } from './router';

type FetchInput = RequestInfo | URL;

const FLAG = '__edumapMockInstalled';

function mockEnabled(): boolean {
    return process.env.NEXT_PUBLIC_USE_MOCK_API !== 'false';
}

function shouldHandle(url: URL): boolean {
    if (typeof window === 'undefined') return false;
    if (url.origin !== window.location.origin) return false;
    if (!url.pathname.startsWith('/api/')) return false;
    if (url.pathname.startsWith('/api/socket.io')) return false;
    return true;
}

function formDataToObject(form: FormData): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    form.forEach((value, key) => {
        if (value instanceof File) {
            result[key] = { name: value.name, size: value.size, type: value.type };
            return;
        }
        const existing = result[key];
        if (existing === undefined) {
            result[key] = value;
        } else if (Array.isArray(existing)) {
            existing.push(value);
        } else {
            result[key] = [existing, value];
        }
    });
    return result;
}

async function readBody(init: RequestInit | undefined, request: Request | null): Promise<unknown> {
    const raw = init?.body;
    if (raw instanceof FormData) return formDataToObject(raw);
    if (raw instanceof URLSearchParams) return Object.fromEntries(raw.entries());
    if (typeof raw === 'string') return raw;
    if (raw === undefined || raw === null) {
        if (request) {
            try {
                const text = await request.clone().text();
                return text || null;
            } catch {
                return null;
            }
        }
        return null;
    }
    return null;
}

function buildResponse(reply: Awaited<ReturnType<typeof handleMockRequest>>): Response {
    const status = reply.status ?? 200;
    const headers = new Headers(reply.headers || {});
    if (reply.stream) {
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'text/event-stream; charset=utf-8');
        if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-cache, no-transform');
        return new Response(reply.stream, { status, headers });
    }
    if (reply.body === undefined) {
        headers.set('Content-Type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify({ success: true }), { status, headers });
    }
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(reply.body), { status, headers });
}

export function installMockApi(): void {
    if (typeof window === 'undefined') return;
    if (!mockEnabled()) return;
    const target = window as unknown as Record<string, unknown>;
    if (target[FLAG]) return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: FetchInput, init?: RequestInit): Promise<Response> => {
        let request: Request | null = null;
        let urlValue: string;
        try {
            if (input instanceof Request) {
                request = input;
                urlValue = input.url;
            } else {
                urlValue = String(input);
            }
            const url = new URL(urlValue, window.location.origin);
            if (!shouldHandle(url)) {
                return originalFetch(input as any, init);
            }
            const method = (init?.method || request?.method || 'GET').toUpperCase();
            const headers = new Headers(init?.headers || request?.headers || {});
            const body = await readBody(init, request);
            const reply = await handleMockRequest({ method, url: url.toString(), headers, body });
            return buildResponse(reply);
        } catch {
            return originalFetch(input as any, init);
        }
    };

    target[FLAG] = true;
}

export function resetMockDb(): void {
    resetDb();
}
