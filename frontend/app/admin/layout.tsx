"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Users, Shield, Activity, LayoutDashboard, 
  Settings, LogOut, ChevronRight, Globe
} from 'lucide-react';

const menuItems = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Người dùng', href: '/admin/users', icon: Users },
  { name: 'Vai trò & Quyền', href: '/admin/roles', icon: Shield },
  { name: 'Nhật ký hệ thống', href: '/admin/reports', icon: Activity },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#050505]">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-zinc-900/50 backdrop-blur-xl flex flex-col fixed h-full z-50">
        <div className="p-8">
           <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-2xl bg-yellow-600 flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg shadow-yellow-600/20">
                 <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                 <h2 className="font-black text-lg tracking-tighter">EDUMAP</h2>
                 <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Admin Panel</p>
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
                className={`flex items-center justify-between p-4 rounded-2xl transition-all group ${
                  isActive 
                  ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/10' 
                  : 'text-white/40 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'group-hover:text-yellow-500'} transition-colors`} />
                  <span className="text-sm font-bold">{item.name}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-8 border-t border-white/5 space-y-4">
           <button className="flex items-center gap-3 text-white/40 hover:text-white transition-colors w-full group">
              <div className="p-2 rounded-lg bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
                 <Settings className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold">Cài đặt</span>
           </button>
           <Link href="/" className="flex items-center gap-3 text-red-500/60 hover:text-red-500 transition-colors w-full group">
              <div className="p-2 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                 <LogOut className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold">Thoát Admin</span>
           </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72">
        {children}
      </main>
    </div>
  );
}
