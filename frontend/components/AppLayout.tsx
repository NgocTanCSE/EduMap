'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

/**
 * Full-height / full-screen experiences paint their own chrome and must NOT
 * wear the global sidebar:
 *  - `/`            redirect gate (centered spinner)
 *  - `/auth/*`      full-screen Google login card
 *  - `/admin/*`     admin panel w/ its own admin rail + auth guard
 *  - `/mentor/call` full-screen video call
 *
 * Every other route — including `/map` — gets the unified "1 left sidebar +
 * 1 content" shell, so the map page shares the same left nav rail + account
 * block as the dashboard and all other app pages.
 */
const FULL_SCREEN_PREFIXES = ['/auth', '/admin', '/mentor/call'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const isFullScreen = pathname === '/' || FULL_SCREEN_PREFIXES.some((p) => pathname.startsWith(p));

  // Full-screen pages render their children directly (no chrome).
  if (isFullScreen) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      {/* `ml-60` leaves room for the fixed w-60 sidebar. A plain <div> (not
          <main>) is used because individual pages already render their own
          <main>; nesting <main> in <main> is invalid HTML. */}
      <div className="flex-1 min-h-screen ml-60 bg-background">{children}</div>
    </div>
  );
}
