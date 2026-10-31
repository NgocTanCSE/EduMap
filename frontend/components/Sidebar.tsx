"use client";

import React from "react";
import { useResizable } from "@/src/hooks/useResizable";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut, User, X } from "lucide-react";
import { useAuth } from "@/src/contexts/AuthContext";
import { EduMapLogo } from "@/components/ui/Logo";
import { AnimatedThemeToggler } from "@/components/ui/magic/AnimatedThemeToggler";
import { avatarFallback, onImageError } from "@/src/lib/illustrations";
import {
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_COLLAPSED_WIDTH,
  setSidebarWidthVar,
} from "@/src/lib/layout-constants";
import {
  SIDEBAR_GROUPS,
  type Feature,
  type FeatureGroup,
} from "@/src/lib/feature-catalog";

type NavItem = Feature;
type NavGroup = FeatureGroup & { items: Feature[] };

function NavGroup({
  group,
  activeHref,
  onNavigate,
  collapsed = false,
}: {
  group: NavGroup;
  activeHref: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <div className="mb-2">
        <nav className="flex flex-col items-center space-y-1">
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 group ${
                  active
                    ? "text-primary bg-primary/10 font-semibold shadow-xs ring-1 ring-primary/25"
                    : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/60"
                }`}
                title={item.label}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                    active ? "text-primary" : "text-muted-foreground/75 group-hover:text-foreground"
                  }`}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75">
        {group.label}
      </p>
      <nav className="space-y-0.5">
        {group.items.map((item) => {
          const Icon = item.icon;
          // Only the most specific route is highlighted. Without this, visiting
          // /career/roadmap would also mark the parent /career item as active.
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors group ${
                active
                  ? "text-primary bg-primary/10 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              title={item.label}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground/70 group-hover:text-primary"
                }`}
              />
              <span className="truncate">{item.label}</span>
              {active && (
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function AccountSection({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { user, isLoggedIn, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="p-3 border-t border-border flex justify-center">
        <div className="w-10 h-10 rounded-full bg-muted/40 animate-pulse" />
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    if (collapsed) {
      return (
        <div className="p-2 border-t border-border flex flex-col items-center gap-2">
          <Link
            href="/auth/login"
            onClick={onNavigate}
            title="Đăng nhập"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            <User className="w-5 h-5" />
          </Link>
          <AnimatedThemeToggler size="sm" className="h-9 w-9 rounded-xl" />
        </div>
      );
    }
    return (
      <div className="p-4 border-t border-border flex items-center gap-2">
        <Link
          href="/auth/login"
          onClick={onNavigate}
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
        >
          <User className="w-4 h-4" />
          Đăng nhập
        </Link>
        <AnimatedThemeToggler size="sm" className="h-10 w-10 rounded-xl shrink-0" />
      </div>
    );
  }

  const avatar = user.avatar_url || avatarFallback(user.fullName);

  if (collapsed) {
    return (
      <div className="p-2 border-t border-border flex flex-col items-center gap-2">
        <Link
          href="/profile"
          onClick={onNavigate}
          title={`Hồ sơ: ${user.fullName || user.email}`}
          className="flex items-center justify-center w-10 h-10 rounded-full overflow-hidden border border-border hover:border-primary/50 transition-all shadow-xs"
        >
          <img
            src={avatar}
            onError={onImageError(avatarFallback(user.fullName))}
            alt={user.fullName || "user"}
            className="w-full h-full object-cover"
          />
        </Link>
        <AnimatedThemeToggler size="sm" className="h-9 w-9 rounded-xl" />
        <button
          onClick={() => {
            logout();
            onNavigate?.();
          }}
          title="Đăng xuất"
          className="flex items-center justify-center w-9 h-9 rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-border space-y-3">
      <div className="flex items-center gap-3">
        <img
          src={avatar}
          onError={onImageError(avatarFallback(user.fullName))}
          alt={user.fullName || "user"}
          className="w-10 h-10 rounded-full object-cover border border-border"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {user.fullName}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          {user.role && (
            <p className="text-[10px] font-black uppercase text-primary/70 mt-0.5">
              {user.role}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Link
          href="/profile"
          onClick={onNavigate}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-medium rounded-xl bg-muted/40 hover:bg-muted text-foreground transition-colors"
          title="Hồ sơ"
        >
          <User className="w-3.5 h-3.5" />
          Hồ sơ
        </Link>
        <AnimatedThemeToggler size="sm" className="h-9 w-9 rounded-xl shrink-0" />
        <button
          onClick={() => {
            logout();
            onNavigate?.();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Đăng xuất"
        >
          <LogOut className="w-3.5 h-3.5" />
          Xuất
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname() || "";
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('edumap_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('edumap_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  const { size: sidebarSize, onResizeMouseDown: onSidebarResizeMouseDown } = useResizable({
    initialSize: { width: SIDEBAR_EXPANDED_WIDTH, height: 400 },
    minWidth: SIDEBAR_COLLAPSED_WIDTH,
    maxWidth: 400,
  });

  // Sync sidebar width to a CSS custom property so other fixed-position
  // components (e.g. Map Hub's "Mở bảng bản đồ" button) can reference it
  // without prop-drilling through AppLayout → page tree.
  const currentWidth = sidebarCollapsed ? 64 : sidebarSize.width;
  React.useEffect(() => {
    setSidebarWidthVar(currentWidth);
  }, [currentWidth]);

  // Move focus into the drawer when it opens so keyboard users are not left
  // tabbing through the page behind the backdrop.
  React.useEffect(() => {
    if (mobileOpen) closeButtonRef.current?.focus();
  }, [mobileOpen]);

  // Pick the longest matching href so nested pages (e.g. /career/roadmap)
  // highlight only their own item, not every ancestor item.
  const activeHref =
    SIDEBAR_GROUPS.flatMap((group) => group.items.map((item) => item.href))
      .filter((href) => pathname === href || pathname.startsWith(href + "/"))
      .sort((a, b) => b.length - a.length)[0] || "";

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* `position:fixed` is intentionally the only positioning utility here.
          `fixed` already establishes a containing block for the absolute
          resize handle (and for `translate-*`), so a `relative` class would be
          redundant — and because Tailwind emits `relative` after `fixed`, it
          would override `fixed` and pull the sidebar into the document flow,
          stretching the whole page to the nav height (the "vùng trống" bug). */}
      <aside
        id="app-sidebar"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label="Điều hướng chính"
        style={{ width: sidebarCollapsed ? 64 : sidebarSize.width }}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar/95 backdrop-blur-md border-r border-border/80 shadow-sm transition-all duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full max-lg:invisible"
        }`}
      >
        {/* Brand */}
        <div
          className={`border-b border-border flex ${
            sidebarCollapsed
              ? "flex-col items-center py-3 px-1 gap-2"
              : "items-center justify-between p-4 gap-2"
          }`}
        >
          <Link
            href="/"
            onClick={onClose}
            className={`flex items-center gap-2.5 font-semibold text-foreground ${
              sidebarCollapsed ? "justify-center" : "text-lg"
            }`}
            title="EduMap"
          >
            <EduMapLogo className="h-7 w-7 text-primary shrink-0" />
            {!sidebarCollapsed && (
              <span>
                Edu<span className="text-primary">Map</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Đóng menu điều hướng"
            className="lg:hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            aria-label={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            className="hidden lg:flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav — scrollable, keeps the brand/account block pinned */}
        <div
          className={`flex-1 overflow-y-auto scrollbar-hide ${
            sidebarCollapsed ? "py-3 px-1 space-y-2" : "py-4 px-1"
          }`}
        >
          {SIDEBAR_GROUPS.map((group, idx) => (
            <React.Fragment key={group.label}>
              {sidebarCollapsed && idx > 0 && (
                <div className="w-7 h-px bg-border/60 mx-auto my-2" />
              )}
              <NavGroup
                group={group}
                activeHref={activeHref}
                onNavigate={onClose}
                collapsed={sidebarCollapsed}
              />
            </React.Fragment>
          ))}
        </div>

        {/* Account (avatar / profile / logout) */}
        <AccountSection onNavigate={onClose} collapsed={sidebarCollapsed} />

        {/* Resize handle — vertical divider on the right edge.
            Only visible on desktop (lg) when sidebar is expanded and not on
            mobile (where the sidebar is a full-width drawer). */}
        {!sidebarCollapsed && (
          <div
            onMouseDown={onSidebarResizeMouseDown}
            className="hidden lg:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize select-none group"
            title="Kéo để thay đổi độ rộng sidebar"
          >
            <div className="absolute top-1/2 right-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-0.5 h-10 bg-muted-foreground/40 rounded" />
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
