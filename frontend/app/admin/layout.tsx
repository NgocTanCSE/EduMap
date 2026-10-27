"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Users, Shield, Activity, LayoutDashboard, 
  Settings, LogOut, ChevronRight, Globe, Lock, Database, BrainCircuit
} from 'lucide-react';
import { authService } from '@/src/services/auth.service';

const menuItems = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Người dùng', href: '/admin/users', icon: Users },
  { name: 'Vai trò & Quyền', href: '/admin/roles', icon: Shield },
  { name: 'Nhật ký hệ thống', href: '/admin/reports', icon: Activity },
  { name: 'Chất lượng Dữ liệu', href: '/admin/data-quality', icon: Database },
  { name: 'Khoảng trống Tri thức AI', href: '/admin/question-gaps', icon: BrainCircuit },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // 🛡️ SECURITY: Kiểm tra quyền Admin trước khi render
    const checkAuth = () => {
      if (!authService.isLoggedIn()) {
        router.replace('/auth/login?redirect=' + pathname);
        return;
      }
      
      if (!authService.isAdmin()) {
        setIsAuthorized(false);
        // Tự động chuyển hướng sau 3 giây
        setTimeout(() => router.replace('/'), 3000);
        return;
      }
      
      setIsAuthorized(true);
    };

    checkAuth();
  }, [pathname, router]);

  // Trạng thái đang kiểm tra hoặc không có quyền
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-lg max-w-md">
           <Lock className="w-16 h-16 text-red-500 mx-auto mb-6" />
           <h2 className="text-2xl font-bold mb-4">Truy cập bị từ chối</h2>
           <p className="text-muted-foreground/40 mb-8">Bạn không có quyền truy cập vào khu vực quản trị viên. Hệ thống sẽ tự động đưa bạn về trang chủ.</p>
           <Link href="/" className="px-8 py-3 bg-card text-foreground font-bold rounded-lg hover:bg-muted transition-all">
              VỀ TRANG CHỦ
           </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border bg-card/50  flex flex-col fixed h-full z-50">
        <div className="p-8">
           <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg ">
                 <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                 <h2 className="font-semibold text-lg tracking-tighter">EDUMAP</h2>
                 <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Admin Panel</p>
              </div>
           </Link>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center justify-between p-4 rounded-lg transition-all group ${
                  isActive 
                  ? 'bg-primary text-white shadow-lg ' 
                  : 'text-muted-foreground/40 hover:bg-card/20 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'group-hover:text-primary'} transition-colors`} />
                  <span className="text-sm font-bold">{item.name}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-8 border-t border-border space-y-4">
           <button className="flex items-center gap-3 text-muted-foreground/40 hover:text-white transition-colors w-full group">
              <div className="p-2 rounded-lg bg-card group-hover:bg-card/50 transition-colors">
                 <Settings className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold">Cài đặt</span>
           </button>
           <button 
              onClick={() => authService.logout()}
              className="flex items-center gap-3 text-red-500/60 hover:text-red-500 transition-colors w-full group text-left"
            >
              <div className="p-2 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                 <LogOut className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold">Đăng xuất</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72">
        {children}
      </main>
    </div>
  );
}
