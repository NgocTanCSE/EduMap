import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/src/services/auth.service';
export type BmType = 'internships' | 'scholarships';
export const KEY = 'edumap:bookmarks';
function authHeader(): HeadersInit {
    const token = authService.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
export function readSet(type: BmType): Set<string> {
    if (typeof window === 'undefined')
        return new Set<string>();
    try {
        const rec = JSON.parse(localStorage.getItem(KEY) || '{}');
        const arr: unknown = rec[type];
        return new Set<string>(Array.isArray(arr) ? (arr as string[]) : []);
    }
    catch {
        return new Set<string>();
    }
}
export function writeSet(type: BmType, set: Set<string>): void {
    if (typeof window === 'undefined')
        return;
    try {
        const raw = localStorage.getItem(KEY);
        const rec = raw ? JSON.parse(raw) : {};
        rec[type] = Array.from(set);
        localStorage.setItem(KEY, JSON.stringify(rec));
    }
    catch {
    }
}
export function isBookmarked(type: BmType, id: string): boolean {
    return readSet(type).has(id);
}
export async function apiFetchBookmarks(type: BmType): Promise<Set<string>> {
    const token = authService.getAccessToken();
    if (!token)
        return new Set<string>();
    const res = await fetch(`/api/bookmarks?type=${encodeURIComponent(type)}`, {
        headers: authHeader(),
    });
    if (!res.ok)
        throw new Error(`bookmarks fetch failed: ${res.status}`);
    const data = await res.json();
    const items: unknown = data?.items ?? [];
    return new Set<string>(Array.isArray(items)
        ? (items as any[]).map((it) => String(it?.target_id || it?.targetId))
        : []);
}
export async function apiToggleBookmark(type: BmType, id: string): Promise<boolean> {
    const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ target_type: type, target_id: id }),
    });
    if (!res.ok)
        throw new Error(`bookmarks toggle failed: ${res.status}`);
    const data = await res.json();
    return Boolean(data?.bookmarked);
}
export function useBookmarkStore(type: BmType): [
    Set<string>,
    (id: string) => Promise<void>
] {
    const [bookmarked, setBookmarked] = useState<Set<string>>(() => new Set<string>());
    useEffect(() => {
        void (async () => {
            const token = authService.getAccessToken();
            if (!token) {
                setBookmarked(readSet(type));
                return;
            }
            try {
                const serverSet = await apiFetchBookmarks(type);
                setBookmarked(serverSet);
                writeSet(type, serverSet);
            }
            catch {
                setBookmarked(readSet(type));
            }
        })();
    }, [type]);
    const toggle = useCallback(async (id: string) => {
        const willAdd = !bookmarked.has(id);
        const optimistic = new Set(bookmarked);
        if (willAdd)
            optimistic.add(id);
        else
            optimistic.delete(id);
        setBookmarked(optimistic);
        writeSet(type, optimistic);
        if (!authService.getAccessToken())
            return;
        try {
            const serverState = await apiToggleBookmark(type, id);
            const aligned = new Set(optimistic);
            if (serverState)
                aligned.add(id);
            else
                aligned.delete(id);
            setBookmarked(aligned);
            writeSet(type, aligned);
        }
        catch {
        }
    }, [type, bookmarked]);
    return [bookmarked, toggle];
}
