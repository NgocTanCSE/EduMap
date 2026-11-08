/* Ordered request router for the frontend mock API. */
import {
    bearerToken,
    fail,
    getDb,
    ok,
    persistDb,
    userFromToken,
    type MockContext,
    type MockReply,
    type MockRoute,
} from './core';
import { authRoutes } from './routes/auth';
import { contentRoutes } from './routes/content';
import { mapRoutes } from './routes/map';
import { appRoutes } from './routes/app';
import { ecosystemRoutes } from './routes/ecosystem';

const ROUTES: MockRoute[] = [
    ...authRoutes,
    ...appRoutes,
    ...ecosystemRoutes,
    ...mapRoutes,
    ...contentRoutes,
];

interface MatchResult {
    route: MockRoute;
    params: Record<string, string>;
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = pathname.split('/').filter(Boolean);
    if (patternParts.length !== pathParts.length) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < patternParts.length; i += 1) {
        const expect = patternParts[i];
        const actual = pathParts[i];
        if (expect.startsWith(':')) {
            if (!actual) return null;
            params[expect.slice(1)] = decodeURIComponent(actual);
            continue;
        }
        if (expect !== actual) return null;
    }
    return params;
}

function matchRoute(method: string, pathname: string): MatchResult | null {
    for (const route of ROUTES) {
        const allowed = Array.isArray(route.method) ? route.method : [route.method];
        if (!allowed.includes(method)) continue;
        const params = matchPath(route.path, pathname);
        if (params) return { route, params };
    }
    return null;
}

function parseBody(raw: unknown): any {
    if (raw === undefined || raw === null || raw === '') return null;
    if (typeof raw !== 'string') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export interface MockRequestInput {
    method: string;
    url: string;
    headers: Headers;
    body?: unknown;
}

export async function handleMockRequest(input: MockRequestInput): Promise<MockReply> {
    const url = new URL(input.url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const method = input.method.toUpperCase();
    const token = bearerToken(input.headers);
    const db = getDb();
    const user = userFromToken(token);

    const matched = matchRoute(method, pathname);
    if (!matched) {
        return ok({ data: [], items: [], meta: { total: 0 }, mock: true });
    }

    const ctx: MockContext = {
        method,
        path: pathname,
        query: url.searchParams,
        params: matched.params,
        body: parseBody(input.body),
        headers: input.headers,
        user,
        db,
    };

    try {
        const reply = await matched.route.handler(ctx);
        persistDb();
        return reply;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Lỗi xử lý dữ liệu mô phỏng.';
        return fail(500, message);
    }
}

export function listMockRoutes(): string[] {
    return ROUTES.map((route) => `${Array.isArray(route.method) ? route.method.join('|') : route.method} ${route.path}`);
}
