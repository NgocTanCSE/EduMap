"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, User, X } from "lucide-react";
import { useAuth } from "@/src/contexts/AuthContext";
import { EduMapLogo } from "@/components/ui/Logo";
import { avatarFallback, onImageError } from "@/src/lib/illustrations";
import {
  SIDEBAR_GROUPS,
  type Feature,
  type FeatureGroup,
} from "@/src/lib/feature-catalog";

/**
 * Sidebar — left-hand navigation rail that lives on every "app" page.
 *
 * It replaces the old horizontal `TopBar` header + `Footer` combo and the
 * never-wired-up `MobileNav` drawer. Everything that used to live in the
 * header (brand, nav links, the user avatar/login/logout actions) now lives
 * here, so the page chrome is a single persistent left panel + content panel.
 *
 * The companion `AppLayout` wrapper decides whether to render this sidebar at
 * all (full-screen experiences like `/map`, `/auth/*`, `/admin/*` and
 * `/mentor/call` opt out and paint their own chrome).
 *
 * The link list is NOT defined here any more: `src/lib/feature-catalog.ts`
 * is the single source of truth (sidebar + `/features` hub render from it),
 * so a new page can never ship as an orphan again.
 */

type NavItem = Feature;
type NavGroup = FeatureGroup & { items: Feature[] };

function NavGroup({
  group,
  activeHref,
  onNavigate,
}: {
  group: NavGroup;
  activeHref: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-5">
      <p className="px-3 mb-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground/65">
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

function AccountSection({ onNavigate }: { onNavigate?: () => void }) {
  const { user, isLoggedIn, loading, logout } = useAuth();

  // Hydration-safe: auth state is resolved from localStorage inside an effect, so the
  // server (no localStorage -> user=null) and the first client render (user already
  // decoded from localStorage) MUST NOT branch on the user yet. While the session is
  // loading, render a neutral skeleton that is identical on server and client -> no
  // hydration mismatch. Once mounted, the effect resolves the real user and we render
  // guest / full-account below. (Same pattern AppLayout's children rely on.)
  if (loading) {
    return (
      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted/40" />
          <div className="flex-1 space-y-1">
            <div className="h-3.5 w-28 bg-muted/40 rounded" />
            <div className="h-3 w-20 bg-muted/40 rounded" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <div className="flex-1 h-9 rounded-lg bg-muted/40" />
          <div className="flex-1 h-9 rounded-lg bg-muted/40" />
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    // Guests still see the sidebar on the rare occasion they land on a protected
    // route before being redirected; give them a clear sign-in affordance.
    return (
      <div className="p-4 border-t border-border">
        <Link
          href="/auth/login"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
        >
          <User className="w-4 h-4" />
          Đăng nhập
        </Link>
      </div>
    );
  }

  const avatar = user.avatar_url || avatarFallback(user.fullName);

  return (
    <div className="p-4 border-t border-border space-y-3">
      <div className="flex items-center gap-3">
        <img
          src={avatar}
          onError={onImageError(avatarFallback(user.fullName))}
          alt={user.fullName || "user"}
          className="w-10 h-10 rounded-full border-2 border-border object-cover"
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

      <div className="flex gap-2 pt-1">
        <Link
          href="/profile"
          onClick={onNavigate}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-medium rounded-lg bg-muted/40 hover:bg-muted text-foreground transition-colors"
          title="Hồ sơ"
        >
          <User className="w-3.5 h-3.5" />
          Hồ sơ
        </Link>
        <button
          onClick={() => {
            logout();
            onNavigate?.();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-semibold rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
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

      <aside
        id="app-sidebar"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label="Điều hướng chính"
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-card border-r border-border shadow-lg transition-transform duration-200 ease-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full max-lg:invisible"
        }`}
      >
        {/* Brand */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2.5 text-lg font-semibold text-foreground"
          >
            <EduMapLogo className="h-7 w-7 text-primary" />
            <span>
              Edu<span className="text-primary">Map</span>
            </span>
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
        </div>

        {/* Nav — scrollable, keeps the brand/account block pinned */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-4">
          {SIDEBAR_GROUPS.map((group) => (
            <NavGroup
              key={group.label}
              group={group}
              activeHref={activeHref}
              onNavigate={onClose}
            />
          ))}
        </div>

        {/* Account (avatar / profile / logout) */}
        <AccountSection onNavigate={onClose} />
      </aside>
    </>
  );
}
