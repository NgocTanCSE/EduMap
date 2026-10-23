'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Map,
  BookOpen,
  Users,
  Briefcase,
  BrainCircuit,
  GraduationCap,
  Globe,
  Bell,
  Wifi,
  Atom,
  Leaf,
  ShoppingCart,
  Heart,
  Calendar,
  Trophy,
  ShieldCheck,
  BarChart3,
  Folder,
  Rocket,
  Sun,
  HelpCircle,
  MapPin,
  LogOut,
  User,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { EduMapLogo } from '@/components/ui/Logo';

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
 */

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Trang chủ',
    items: [
      { name: 'Bản đồ', href: '/map', icon: Map },
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Học tập',
    items: [
      { name: 'Thư viện', href: '/library', icon: BookOpen },
      { name: 'AI Chat', href: '/ai-chat', icon: BrainCircuit },
      { name: 'Học bổng', href: '/scholarships', icon: GraduationCap },
      { name: 'Nghề nghiệp', href: '/career', icon: Briefcase },
      { name: 'Lộ trình nghề', href: '/career/roadmap', icon: MapPin },
      { name: 'Câu đố nghề nghiệp', href: '/career/quiz', icon: HelpCircle },
    ],
  },
  {
    label: 'Kết nối',
    items: [
      { name: 'Mentor', href: '/mentor', icon: Users },
      { name: 'Cộng đồng', href: '/community', icon: Globe },
      { name: 'Thông báo', href: '/notifications', icon: Bell },
      { name: 'Trạm Wifi', href: '/wifi', icon: Wifi },
      { name: 'STEM Labs', href: '/stem', icon: Atom },
      { name: 'Thử thách xanh', href: '/green', icon: Leaf },
    ],
  },
  {
    label: 'Kinh tế & Cơ hội',
    items: [
      { name: 'Chợ', href: '/marketplace', icon: ShoppingCart },
      { name: 'Quyên góp', href: '/donate', icon: Heart },
      { name: 'Thực tập', href: '/internships', icon: Briefcase },
      { name: 'Sự kiện', href: '/events', icon: Calendar },
      { name: 'Hackathon', href: '/hackathon', icon: Trophy },
      { name: 'Summer', href: '/summer', icon: Sun },
      { name: 'Cơ hội', href: '/opportunities', icon: Rocket },
    ],
  },
  {
    label: 'Quản lý & Khác',
    items: [
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
      { name: 'Chứng chỉ', href: '/certificates', icon: ShieldCheck },
      { name: 'Lưu trữ', href: '/storage', icon: Folder },
      { name: 'Bảng xếp hạng', href: '/leaderboard', icon: Trophy },
      { name: 'HS Connection', href: '/hs-connection', icon: GraduationCap },
      { name: 'INT/LĐLĐ', href: '/intl', icon: Globe },
    ],
  },
];

function NavGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  return (
    <div className="mb-5">
      <p className="px-3 mb-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground/50">
        {group.label}
      </p>
      <nav className="space-y-0.5">
        {group.items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors group ${
                active
                  ? 'text-primary bg-primary/10 font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title={item.name}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  active ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-primary'
                }`}
              />
              <span className="truncate">{item.name}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function AccountSection() {
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
          className="flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors"
        >
          <User className="w-4 h-4" />
          Đăng nhập
        </Link>
      </div>
    );
  }

  const avatar =
    user.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=eee&color=333`;

  return (
    <div className="p-4 border-t border-border space-y-3">
      <div className="flex items-center gap-3">
        <img
          src={avatar}
          alt={user.fullName || 'user'}
          className="w-10 h-10 rounded-full border-2 border-border object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{user.fullName}</p>
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
          className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs font-medium rounded-lg bg-muted/40 hover:bg-muted text-foreground transition-colors"
          title="Hồ sơ"
        >
          <User className="w-3.5 h-3.5" />
          Hồ sơ
        </Link>
        <button
          onClick={() => logout()}
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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-card border-r border-border shadow-lg">
      {/* Brand */}
      <div className="p-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
          <EduMapLogo className="h-7 w-7 text-primary" />
          <span>
            Edu<span className="text-primary">Map</span>
          </span>
        </Link>
      </div>

      {/* Nav — scrollable, keeps the brand/account block pinned */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-4">
        {NAV_GROUPS.map((group) => (
          <NavGroup key={group.label} group={group} pathname={pathname || ''} />
        ))}
      </div>

      {/* Account (avatar / profile / logout) */}
      <AccountSection />
    </aside>
  );
}
