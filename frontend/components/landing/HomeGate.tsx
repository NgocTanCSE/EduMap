'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import EduMapLanding from './EduMapLanding';

/**
 * Public landing page at `/`.
 *
 * Anonymous visitors see the marketing page. A visitor with an existing
 * session keeps the previous behaviour and is sent straight to `/map`, so the
 * app still opens on the map for returning users.
 */
export default function HomeGate() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace('/map');
  }, [user, loading, router]);

  return <EduMapLanding />;
}
