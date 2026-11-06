'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
export function useRequireAuth(redirectTo = '/auth/login') {
    const { user, loading } = useAuth();
    const router = useRouter();
    useEffect(() => {
        if (!loading && !user) {
            router.replace(redirectTo);
        }
    }, [user, loading, router, redirectTo]);
    return { user, loading, ready: !loading && !!user };
}
