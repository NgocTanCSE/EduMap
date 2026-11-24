'use client';
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { QuickDock } from '@/components/ui/magic/QuickDock';
import { DashboardDrawer } from '@/components/dashboard/DashboardDrawer';
const FULL_SCREEN_PREFIXES = ['/auth', '/admin', '/mentor/call'];
export default function AppLayout({ children }: {
    children: React.ReactNode;
}) {
    const pathname = usePathname() || '';
    const isFullScreen = FULL_SCREEN_PREFIXES.some((p) => pathname.startsWith(p));
    const [dashboardOpen, setDashboardOpen] = useState(false);
    useEffect(() => {
        setDashboardOpen(false);
    }, [pathname]);
    if (isFullScreen) {
        return <>{children}</>;
    }
    return (<div className="flex flex-1 flex-col bg-background">
      <div id="app-content" className="flex-1">{children}</div>
      <QuickDock onOpenDashboard={() => setDashboardOpen(true)}/>
      <DashboardDrawer open={dashboardOpen} onClose={() => setDashboardOpen(false)}/>
    </div>);
}
