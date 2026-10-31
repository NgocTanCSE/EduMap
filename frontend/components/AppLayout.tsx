'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { EduMapLogo } from '@/components/ui/Logo';
import { QuickDock } from '@/components/ui/magic/QuickDock';
import { AnimatedThemeToggler } from '@/components/ui/magic/AnimatedThemeToggler';

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
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer whenever the route changes (including link clicks inside
  // the drawer that navigate to the same pathname).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock background scrolling and support Escape while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  // If the viewport grows past the mobile breakpoint while the drawer is open,
  // drop the open state so the scroll lock/backdrop do not linger.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (media.matches) setMobileOpen(false);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // Full-screen pages render their children directly (no chrome).
  if (isFullScreen) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-1 flex-row bg-background">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* `lg:ml-[var(--sidebar-width)]` dynamically syncs with the sidebar
          width (240px expanded, 56px collapsed) via the CSS variable set by
          setSidebarWidthVar() in Sidebar.tsx. This eliminates the 184px gap
          that appeared when the sidebar collapsed but the margin stayed fixed
          at 240px. On mobile the sidebar becomes an off-canvas drawer and the
          content takes the full width. A plain <div> (not <main>) is used
          because individual pages already render their own <main>; nesting
          <main> in <main> is invalid HTML. */}
      <div className="flex flex-1 flex-col bg-background lg:ml-[var(--sidebar-width)]">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
            className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <EduMapLogo className="h-6 w-6 text-primary" />
            <span>
              Edu<span className="text-primary">Map</span>
            </span>
          </Link>
          </div>
          <AnimatedThemeToggler size="sm" />
        </header>

        <div id="app-content" className="flex-1">{children}</div>
      </div>
      <QuickDock />
    </div>
  );
}
