'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { EduMapLogo } from '@/components/ui/Logo';

/**
 * TopBar — single horizontal nav bar, Google Maps style.
 * Renders on every page except /map (full-screen map has its own overlay)
 * and /auth (full-screen login).
 */
const NAV_LINKS = [
  { name: 'Bản đồ', href: '/map' },
  { name: 'Thư viện', href: '/library' },
  { name: 'Mentor', href: '/mentor' },
  { name: 'Học bổng', href: '/scholarships' },
  { name: 'Thực tập', href: '/internships' },
  { name: 'AI Chat', href: '/ai-chat' },
];

export default function TopBar() {
  const pathname = usePathname();
  const { user, isLoggedIn, logout } = useAuth();

  if (pathname?.startsWith('/auth') || pathname === '/map' || pathname?.startsWith('/map')) return null;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8 bg-card border-b border-border shadow-sm">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <EduMapLogo className="h-7 w-7 text-primary" />
        <span>Edu<span className="text-primary">Map</span></span>
      </Link>

      <nav className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                active
                  ? 'text-primary bg-primary/10'
                  : 'hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        {isLoggedIn ? (
          <>
            <Link
              href="/profile"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-muted hover:bg-muted/70 transition-colors overflow-hidden"
              title="Hồ sơ"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.fullName || ''} className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-muted-foreground" />
              )}
            </Link>
            <button
              onClick={logout}
              title="Đăng xuất"
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="h-9 px-4 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium shadow transition-colors inline-flex items-center justify-center"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
