'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';

/**
 * Hook: redirect unauthenticated users away from a protected route.
 * Returns { user, loading, ready } so the consuming page can render a guard
 * state until the session is known.
 */
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
