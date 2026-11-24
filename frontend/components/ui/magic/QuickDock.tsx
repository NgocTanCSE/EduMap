"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, ArrowUp, SlidersHorizontal, ChevronDown, User, LogOut, Sun, } from "lucide-react";
import { Dock, DockIcon } from "./Dock";
import AnimatedThemeToggler from "./AnimatedThemeToggler";
import { cn } from "@/src/lib/utils";
import { FEATURE_GROUPS, groupForPath } from "@/src/lib/feature-catalog";
import { useAuth } from "@/src/contexts/AuthContext";
import { avatarFallback, onImageError } from "@/src/lib/illustrations";
export interface QuickDockProps {
    className?: string;
    onOpenDashboard?: () => void;
}
export function QuickDock({ className, onOpenDashboard }: QuickDockProps) {
    const pathname = usePathname() || "";
    const { user, isLoggedIn, loading: authLoading, logout } = useAuth();
    const onMap = pathname.startsWith("/map");
    const [collapsed, setCollapsed] = useState(onMap);
    const [isMobile, setIsMobile] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined")
            return;
        const mq = window.matchMedia("(max-width: 640px)");
        const apply = () => {
            setIsMobile(mq.matches);
            if (mq.matches)
                setCollapsed(true);
        };
        apply();
        mq.addEventListener("change", apply);
        return () => mq.removeEventListener("change", apply);
    }, []);
    useEffect(() => {
        if (isMobile)
            setCollapsed(true);
    }, [pathname, isMobile]);
    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);
    const activeGroup = useMemo(() => groupForPath(pathname), [pathname]);
    const activeId = activeGroup?.id;
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    if (collapsed) {
        return (<div className={cn("fixed bottom-5 z-40 transition-all duration-300", onMap ? "right-[4.75rem]" : "right-5", className)}>
        <button onClick={() => setCollapsed(false)} className="flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-card/90 text-primary shadow-pop backdrop-blur-xl transition-all duration-200 hover:scale-105 hover:bg-card" title="Mở thanh điều hướng" aria-label="Mở thanh điều hướng">
          <SlidersHorizontal className="h-5 w-5"/>
        </button>
      </div>);
    }
    const avatar = user?.avatar_url || avatarFallback(user?.fullName);
    if (isMobile) {
        return (<div className={cn("fixed bottom-3 left-3 z-40 w-[min(310px,calc(100vw-1.5rem))] transition-all duration-300", className)}>
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-pop backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Điều hướng</span>
            <button type="button" onClick={() => setCollapsed(true)} aria-label="Đóng thanh điều hướng" className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/70">
              <ChevronDown className="h-4 w-4"/>
            </button>
          </div>
          <nav className="max-h-[62vh] space-y-0.5 overflow-y-auto p-2">
            {FEATURE_GROUPS.map((group) => {
                const Icon = group.icon;
                const active = activeId === group.id;
                return (<Link key={group.id} href={group.hubHref} onClick={() => setCollapsed(true)} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-foreground hover:bg-muted/60")}>
                <Icon className="h-4 w-4 shrink-0"/>
                <span className="truncate">{group.label}</span>
              </Link>);
            })}

            <div className="my-1 h-px bg-border/60"/>

            <Link href="/features" onClick={() => setCollapsed(true)} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", pathname === "/features"
                ? "bg-primary/10 font-semibold text-primary"
                : "text-foreground hover:bg-muted/60")}>
              <Layers className="h-4 w-4 shrink-0"/>
              <span className="truncate">Tất cả tính năng</span>
            </Link>

            {showScrollTop && (<button type="button" onClick={() => {
                    scrollToTop();
                    setCollapsed(true);
                }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/60">
                <ArrowUp className="h-4 w-4 shrink-0"/>
                <span className="truncate">Lên đầu trang</span>
              </button>)}

            <div className="my-1 h-px bg-border/60"/>

            <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground">
              <Sun className="h-4 w-4 shrink-0"/>
              <span className="flex-1 truncate">Giao diện</span>
              <AnimatedThemeToggler size="sm"/>
            </div>

            {authLoading ? (<div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <span className="h-6 w-6 rounded-full bg-muted/50 animate-pulse"/>
              </div>) : isLoggedIn && user ? (<button type="button" onClick={() => {
                    onOpenDashboard?.();
                    setCollapsed(true);
                }} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", pathname === "/dashboard"
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-foreground hover:bg-muted/60")}>
                <img src={avatar} onError={onImageError(avatarFallback(user.fullName))} alt={user.fullName || "user"} className="h-6 w-6 shrink-0 rounded-full border border-border object-cover"/>
                <span className="truncate">Bảng điều khiển</span>
              </button>) : (<Link href="/auth/login" onClick={() => setCollapsed(true)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/60">
                <User className="h-4 w-4 shrink-0"/>
                <span className="truncate">Đăng nhập</span>
              </Link>)}

            {isLoggedIn && (<button type="button" onClick={() => {
                    logout();
                    setCollapsed(true);
                }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10">
                <LogOut className="h-4 w-4 shrink-0"/>
                <span className="truncate">Đăng xuất</span>
              </button>)}
          </nav>
        </div>
      </div>);
    }
    return (<div className={cn("fixed bottom-5 left-1/2 z-40 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-2 transition-all duration-300", className)}>
      <Dock className="max-w-full overflow-x-auto scrollbar-hide shadow-pop border border-border/80 bg-card/90 backdrop-blur-xl">
        <DockIcon>
          <AnimatedThemeToggler size="sm" className="border-0 bg-transparent shadow-none hover:bg-secondary/80"/>
        </DockIcon>

        <div className="mx-0.5 h-6 w-px shrink-0 bg-border/60"/>

        {FEATURE_GROUPS.map((group) => {
            const Icon = group.icon;
            const active = activeId === group.id;
            return (<DockIcon key={group.id}>
            <Link href={group.hubHref} className={cn("flex h-full w-full items-center justify-center rounded-full transition-colors", active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground")} title={group.label}>
              <Icon className="h-5 w-5"/>
            </Link>
          </DockIcon>);
        })}

        <div className="mx-0.5 h-6 w-px shrink-0 bg-border/60"/>

        <DockIcon>
          <Link href="/features" className={cn("flex h-full w-full items-center justify-center rounded-full transition-colors", pathname === "/features"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground")} title="Tất cả tính năng (/features)">
            <Layers className="h-5 w-5"/>
          </Link>
        </DockIcon>

        {showScrollTop && (<DockIcon>
            <button onClick={scrollToTop} className="flex h-full w-full items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" title="Cuộn lên đầu trang">
              <ArrowUp className="h-5 w-5"/>
            </button>
          </DockIcon>)}

        {authLoading ? (<DockIcon>
            <span className="h-6 w-6 rounded-full bg-muted/50 animate-pulse"/>
          </DockIcon>) : isLoggedIn && user ? (<DockIcon>
            <button type="button" onClick={() => onOpenDashboard?.()} className={cn("flex h-full w-full items-center justify-center overflow-hidden rounded-full border transition-colors", pathname === "/dashboard"
                ? "border-primary"
                : "border-border hover:border-primary/50")} title={`Bảng điều khiển: ${user.fullName || user.email}`} aria-label="Mở bảng điều khiển">
              <img src={avatar} onError={onImageError(avatarFallback(user.fullName))} alt={user.fullName || "user"} className="h-full w-full object-cover"/>
            </button>
          </DockIcon>) : (<DockIcon>
            <Link href="/auth/login" className="flex h-full w-full items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" title="Đăng nhập">
              <User className="h-5 w-5"/>
            </Link>
          </DockIcon>)}

        {isLoggedIn && (<DockIcon>
            <button type="button" onClick={() => logout()} className="flex h-full w-full items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="Đăng xuất">
              <LogOut className="h-4 w-4"/>
            </button>
          </DockIcon>)}

        <div className="mx-0.5 h-6 w-px shrink-0 bg-border/60"/>

        <DockIcon>
          <button onClick={() => setCollapsed(true)} className="flex h-full w-full items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" title="Thu gọn thanh điều hướng">
            <ChevronDown className="h-4 w-4"/>
          </button>
        </DockIcon>
      </Dock>
    </div>);
}
export default QuickDock;
