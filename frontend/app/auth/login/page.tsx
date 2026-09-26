"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// DEMO MODE: Auth is auto-initialized in authService, so we always
// redirect to the home page immediately — no login form needed.
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
