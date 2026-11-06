'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { EduMapLogo } from '@/components/ui/Logo';
import { QuickDock } from '@/components/ui/magic/QuickDock';
import { AnimatedThemeToggler } from '@/components/ui/magic/AnimatedThemeToggler';
const FULL_SCREEN_PREFIXES = ['/auth', '/admin', '/mentor/call'];
export default function AppLayout({ children }: {
    children: React.ReactNode;
}) {
    const pathname = usePathname() || '';
    const isFullScreen = pathname === '/' || FULL_SCREEN_PREFIXES.some((p) => pathname.startsWith(p));
    const [mobileOpen, setMobileOpen] = useState(false);
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);
    useEffect(() => {
        if (!mobileOpen)
            return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setMobileOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [mobileOpen]);
    useEffect(() => {
        const media = window.matchMedia('(min-width: 1024px)');
        const onChange = () => {
            if (media.matches)
                setMobileOpen(false);
        };
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);
    if (isFullScreen) {
        return <>{children}</>;
    }
    return (<div className="flex flex-1 flex-row bg-background">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)}/>

      <div className="flex flex-1 flex-col bg-background lg:ml-[var(--sidebar-width)]">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Mở menu điều hướng" aria-expanded={mobileOpen} aria-controls="app-sidebar" className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground">
            <Menu className="h-5 w-5"/>
          </button>
          <Link href="/" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <EduMapLogo className="h-6 w-6 text-primary"/>
            <span>
              Edu<span className="text-primary">Map</span>
            </span>
          </Link>
          </div>
          <AnimatedThemeToggler size="sm"/>
        </header>

        <div id="app-content" className="flex-1">{children}</div>
      </div>
      <QuickDock />
    </div>);
}
