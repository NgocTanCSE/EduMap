'use client';
import { useEffect, useState, useCallback } from 'react';
import { bookmarkService, Bookmark } from '@/src/services/bookmark.service';
import { useAuth } from '@/src/contexts/AuthContext';
let cache: Bookmark[] | null = null;
let inflight: Promise<Bookmark[]> | null = null;
const listeners = new Set<() => void>();
export function useBookmarks() {
    const { isLoggedIn, loading: authLoading } = useAuth();
    const [bookmarks, setBookmarks] = useState<Bookmark[]>(cache ?? []);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sync = useCallback((next: Bookmark[]) => {
        cache = next;
        setBookmarks(next);
        listeners.forEach((l) => l());
    }, []);
    const fetchBookmarks = useCallback(async (): Promise<Bookmark[] | null> => {
        if (!isLoggedIn)
            return null;
        if (cache) {
            setLoaded(true);
            return cache;
        }
        setLoaded(false);
        setError(null);
        if (!inflight) {
            inflight = bookmarkService
                .list()
                .then((r: any) => {
                const next: Bookmark[] = Array.isArray(r?.items)
                    ? r.items
                    : Array.isArray(r)
                        ? r
                        : [];
                cache = next;
                listeners.forEach((l) => l());
                return next;
            })
                .finally(() => {
                inflight = null;
            });
        }
        try {
            const next = await inflight;
            setLoaded(true);
            setError(null);
            return next;
        }
        catch (e: any) {
            setLoaded(true);
            setError(e?.message || 'Không thể tải mục đã lưu');
            return null;
        }
    }, [isLoggedIn]);
    const toggle = useCallback(async (target_type: string, target_id: string) => {
        const cur = cache ?? bookmarks;
        const exists = cur.some((b) => b.target_type === target_type && b.target_id === target_id);
        const optimistic = exists
            ? cur.filter((b) => !(b.target_type === target_type && b.target_id === target_id))
            : [{ target_type, target_id, title: null, created_at: new Date().toISOString() }, ...cur];
        sync(optimistic);
        try {
            await bookmarkService.toggle(target_type, target_id);
        }
        catch {
            sync(cur);
        }
    }, [bookmarks, sync]);
    const has = useCallback((target_type: string, target_id: string) => (cache ?? bookmarks).some((b) => b.target_type === target_type && b.target_id === target_id), [bookmarks]);
    useEffect(() => {
        if (!isLoggedIn) {
            cache = null;
            setBookmarks([]);
            setLoaded(true);
            setError(null);
            return;
        }
        if (cache) {
            setBookmarks(cache);
            setLoaded(true);
            return;
        }
        let cancelled = false;
        fetchBookmarks().then((next) => {
            if (!cancelled && next)
                setBookmarks(next);
        });
        return () => {
            cancelled = true;
        };
    }, [isLoggedIn, fetchBookmarks]);
    useEffect(() => {
        const l = () => setBookmarks(cache ?? []);
        listeners.add(l);
        return () => {
            listeners.delete(l);
        };
    }, []);
    return {
        bookmarks,
        loading: isLoggedIn && !authLoading && !loaded && !cache,
        error,
        toggle,
        has,
        refresh: fetchBookmarks,
    };
}
