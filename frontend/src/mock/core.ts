/* Frontend mock layer — shared types, helpers and the in-browser persistence store. */
import { createSeed, type MockDb } from './seed';

export interface MockUser {
    id: string;
    email: string;
    full_name: string;
    role: string;
    avatar_url?: string;
    phone?: string;
    bio?: string;
    major?: string;
    date_of_birth?: string;
}

export interface MockContext {
    method: string;
    path: string;
    query: URLSearchParams;
    params: Record<string, string>;
    body: any;
    headers: Headers;
    user: MockUser | null;
    db: MockDb;
}

export interface MockReply {
    status?: number;
    body?: unknown;
    headers?: Record<string, string>;
    stream?: ReadableStream<Uint8Array> | null;
    raw?: boolean;
}

export type MockHandler = (ctx: MockContext) => MockReply | Promise<MockReply>;

export interface MockRoute {
    method: string | string[];
    path: string;
    handler: MockHandler;
}

export const STORAGE_KEY = 'edumap-mock-db-v4';

const DEFAULT_USER: MockUser = {
    id: 'usr-demo-admin',
    email: 'admin@edumap.vn',
    full_name: 'Quản trị viên EduMap',
    role: 'admin',
    avatar_url: 'https://ui-avatars.com/api/?name=Quan+tri+EduMap&background=0f766e&color=ffffff',
    phone: '0251 3 888 999',
    bio: 'Tài khoản demo dùng cho chế độ dữ liệu mô phỏng trên trình duyệt.',
    major: 'Quản trị hệ thống giáo dục',
    date_of_birth: '1995-05-20',
};

export const DEMO_USER = DEFAULT_USER;

function base64UrlEncode(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

export interface TokenPayload {
    sub: string;
    email: string;
    role: string;
    full_name: string;
    iat: number;
    exp: number;
}

export function createAccessToken(user: MockUser, ttlSeconds = 60 * 60 * 24 * 7): string {
    const issued = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64UrlEncode(JSON.stringify({
        sub: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        iat: issued,
        exp: issued + ttlSeconds,
    }));
    const signature = base64UrlEncode(`edumap-mock-${user.id}-${issued}`).slice(0, 43);
    return `${header}.${payload}.${signature}`;
}

export function createRefreshToken(user: MockUser): string {
    return `mock-refresh-${user.id}-${Date.now()}`;
}

export function decodeAccessToken(token: string | null | undefined): TokenPayload | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const payload = JSON.parse(base64UrlDecode(parts[1])) as TokenPayload;
        if (!payload?.sub) return null;
        return payload;
    } catch {
        return null;
    }
}

export function userFromToken(token: string | null | undefined): MockUser | null {
    const payload = decodeAccessToken(token);
    if (!payload) return null;
    return {
        id: payload.sub,
        email: payload.email,
        full_name: payload.full_name || DEFAULT_USER.full_name,
        role: payload.role || DEFAULT_USER.role,
        avatar_url: DEFAULT_USER.avatar_url,
        phone: DEFAULT_USER.phone,
        bio: DEFAULT_USER.bio,
        major: DEFAULT_USER.major,
        date_of_birth: DEFAULT_USER.date_of_birth,
    };
}

export function bearerToken(headers: Headers): string | null {
    const raw = headers.get('authorization') || headers.get('Authorization');
    if (!raw) return null;
    const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
    return match ? match[1] : null;
}

export function ok(body: unknown, status = 200): MockReply {
    return { status, body };
}

export function fail(status: number, message: string, extra?: Record<string, unknown>): MockReply {
    return { status, body: { statusCode: status, message, ...(extra || {}) } };
}

export function uid(prefix: string): string {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${Date.now().toString(36)}${rand}`;
}

export function nowIso(): string {
    return new Date().toISOString();
}

export function isoFromNow(days: number): string {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function num(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function paginate<T>(items: T[], page: unknown, limit: unknown, fallbackLimit = 10) {
    const currentPage = Math.max(1, Math.trunc(num(page, 1)));
    const pageSize = Math.max(1, Math.trunc(num(limit, fallbackLimit)));
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize)) || 1;
    const start = (currentPage - 1) * pageSize;
    return {
        items: items.slice(start, start + pageSize),
        meta: {
            total,
            page: currentPage,
            limit: pageSize,
            currentPage,
            totalPages,
            hasNext: currentPage < totalPages,
        },
    };
}

export function pageData<T>(items: T[], page: unknown, limit: unknown, fallbackLimit = 10) {
    const result = paginate(items, page, limit, fallbackLimit);
    return {
        page: result.meta.page,
        limit: result.meta.limit,
        total: result.meta.total,
        totalPages: result.meta.totalPages,
        currentPage: result.meta.currentPage,
        items: result.items,
        meta: result.meta,
    };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function readStoredDb(): MockDb | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as MockDb;
        if (!parsed || parsed.version !== createSeed().version) return null;
        return { ...createSeed(), ...parsed };
    } catch {
        return null;
    }
}

let memoryDb: MockDb | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function getDb(): MockDb {
    if (memoryDb) return memoryDb;
    memoryDb = readStoredDb() || createSeed();
    return memoryDb;
}

export function persistDb(immediate = false): void {
    if (typeof window === 'undefined' || !memoryDb) return;
    if (immediate) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryDb));
        } catch {
            /* storage full — mock keeps working in memory */
        }
        return;
    }
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        persistDb(true);
    }, 250);
}

export function resetDb(): void {
    memoryDb = createSeed();
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryDb));
        } catch {
            /* ignore quota errors */
        }
    }
}

export function nextNumericId(items: Array<Record<string, any>>): number {
    return items.reduce((max, item) => Math.max(max, num(item.id, 0)), 0) + 1;
}

export function byNewest<T extends Record<string, any>>(items: T[], field = 'created_at'): T[] {
    return [...items].sort((a, b) => String(b[field] || '').localeCompare(String(a[field] || '')));
}

export function matchText(haystack: unknown, needle: string): boolean {
    if (!needle) return true;
    return String(haystack || '').toLowerCase().includes(needle.toLowerCase());
}
