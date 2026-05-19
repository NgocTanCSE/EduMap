'use client';

import React, { useState, useEffect } from 'react';
import { 
  Map as MapIcon, 
  MessageSquare, 
  Library, 
  Target, 
  ShieldCheck, 
  Zap, 
  Users, 
  Award, 
  Globe, 
  ChevronDown, 
  Menu, 
  X, 
  BookOpen, 
  Sparkles, 
  HeartHandshake, 
  Building2, 
  GraduationCap, 
  BadgeHelp,
  LayoutDashboard,
  User,
  Settings,
  ShieldAlert,
  BarChart3
} from 'lucide-react';

export default function Header() {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const menuGroups = [
    {
      id: 'explore',
      title: 'Khám phá',
      items: [
        { name: 'Bản đồ Thông minh', href: '/map', desc: 'Tìm trường học, thư viện & lab quanh bạn', icon: MapIcon, color: 'text-blue-500 bg-blue-500/10' },
        { name: 'Thư viện Số', href: '/library', desc: 'Kho học liệu, sách, podcast & đề thi free', icon: Library, color: 'text-emerald-500 bg-emerald-500/10' },
        { name: 'Kết nối Mentors', href: '/mentor', desc: 'Đặt lịch hẹn 1-on-1 & call video trực tiếp', icon: Users, color: 'text-indigo-500 bg-indigo-500/10' },
        { name: 'Học bổng Toàn cầu', href: '/scholarships', desc: 'Tìm & kiểm tra điều kiện ứng tuyển học bổng', icon: GraduationCap, color: 'text-amber-500 bg-amber-500/10' },
        { name: 'Thực tập & Tuyển dụng', href: '/internships', desc: 'Tìm kiếm cơ hội thực tế từ doanh nghiệp', icon: Building2, color: 'text-cyan-500 bg-cyan-500/10' },
      ]
    },
    {
      id: 'community',
      title: 'Cộng đồng',
      items: [
        { name: 'Diễn đàn Học tập', href: '/community', desc: 'Gia nhập nhóm học, tìm đồng đội dự án', icon: Globe, color: 'text-violet-500 bg-violet-500/10' },
        { name: 'Green Campus', href: '/green', desc: 'Sân chơi đổi rác lấy điểm & thử thách xanh', icon: Sparkles, color: 'text-green-500 bg-green-500/10' },
        { name: 'Marketplace Sách', href: '/marketplace', desc: 'Trao đổi sách cũ & đồ dùng học tập', icon: BookOpen, color: 'text-pink-500 bg-pink-500/10' },
        { name: 'Quyên góp Đồng hành', href: '/donate', desc: 'Gây quỹ giúp đỡ học sinh vùng khó khăn', icon: HeartHandshake, color: 'text-rose-500 bg-rose-500/10' },
      ]
    },
    {
      id: 'ai-growth',
      title: 'AI & Trí tuệ',
      items: [
        { name: 'Trợ lý AI Assistant', href: '/ai-chat', desc: 'Hỏi đáp & tư vấn lộ trình học tập 24/7', icon: MessageSquare, color: 'text-sky-500 bg-sky-500/10' },
        { name: 'Lộ trình Nghề nghiệp', href: '/career', desc: 'Trắc nghiệm định hướng & nghề tương lai', icon: Target, color: 'text-orange-500 bg-orange-500/10' },
        { name: 'Xu hướng & Dự báo', href: '/analytics', desc: 'Phân tích điểm nóng giáo dục & tuyển dụng', icon: BarChart3, color: 'text-purple-500 bg-purple-500/10' },
        { name: 'Chứng chỉ E-Portfolio', href: '/certificates', desc: 'Cấp chứng nhận blockchain & hồ sơ cá nhân', icon: Award, color: 'text-yellow-500 bg-yellow-500/10' },
      ]
    },
    {
      id: 'management',
      title: 'Quản trị',
      items: [
        { name: 'Dashboard Cá nhân', href: '/dashboard', desc: 'Xem điểm tích lũy, hoạt động của bạn', icon: LayoutDashboard, color: 'text-teal-500 bg-teal-500/10' },
        { name: 'Hồ sơ của tôi', href: '/profile', desc: 'Cập nhật thông tin & cài đặt cá nhân', icon: User, color: 'text-gray-500 bg-gray-500/10' },
        { name: 'Moderator Control', href: '/moderator', desc: 'Phê duyệt hoạt động xanh & nội dung', icon: ShieldCheck, color: 'text-amber-600 bg-amber-600/10' },
        { name: 'Admin Control Panel', href: '/admin', desc: 'Quản trị hệ thống, vai trò & phân quyền', icon: ShieldAlert, color: 'text-red-500 bg-red-500/10' },
      ]
    }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <a href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold shadow-lg shadow-blue-500/20">🎓</span>
            <span>Edu<span className="text-blue-500">Map</span></span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex gap-1">
            {menuGroups.map((group) => (
              <div 
                key={group.id}
                className="relative"
                onMouseEnter={() => setActiveDropdown(group.id)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === group.id ? null : group.id);
                  }}
                  className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-white/5 ${
                    activeDropdown === group.id ? 'text-blue-500 bg-white/5' : 'text-foreground/80'
                  }`}
                >
                  {group.title}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${
                    activeDropdown === group.id ? 'rotate-180' : ''
                  }`} />
                </button>

                {/* Dropdown Menu */}
                {activeDropdown === group.id && (
                  <div className="absolute left-0 mt-1 w-96 rounded-2xl border border-white/10 bg-[#121215] p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid gap-3">
                      {group.items.map((item) => {
                        const IconComponent = item.icon;
                        return (
                          <a 
                            key={item.name}
                            href={item.href}
                            className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5 group"
                          >
                            <span className={`flex w-9 h-9 items-center justify-center rounded-lg transition-all group-hover:scale-105 ${item.color}`}>
                              <IconComponent className="w-5 h-5" />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-foreground tracking-tight transition-colors group-hover:text-blue-500">
                                {item.name}
                              </div>
                              <p className="text-xs text-foreground/50 mt-0.5 leading-snug">
                                {item.desc}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Buttons / Actions */}
        <div className="hidden md:flex items-center gap-4">
          <a href="/auth" className="text-sm font-medium hover:text-blue-500 transition-colors">
            Đăng nhập
          </a>
          <a href="/auth?tab=register">
            <button className="h-9 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95 transition-all">
              Bắt đầu miễn phí
            </button>
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden flex w-9 h-9 items-center justify-center rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          onClick={() => setIsOpenMobile(!isOpenMobile)}
        >
          {isOpenMobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="md:hidden border-t border-white/10 bg-[#121215] py-4 px-4 shadow-xl">
          <div className="grid gap-6">
            {menuGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/40 px-2">
                  {group.title}
                </h4>
                <div className="grid gap-1">
                  {group.items.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <a 
                        key={item.name}
                        href={item.href}
                        onClick={() => setIsOpenMobile(false)}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
                      >
                        <span className={`flex w-8 h-8 items-center justify-center rounded-lg ${item.color}`}>
                          <IconComponent className="w-4.5 h-4.5" />
                        </span>
                        <div className="text-sm font-medium">
                          {item.name}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="border-t border-white/5 pt-4 grid gap-2">
              <a href="/auth" onClick={() => setIsOpenMobile(false)}>
                <button className="w-full h-10 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5">
                  Đăng nhập
                </button>
              </a>
              <a href="/auth?tab=register" onClick={() => setIsOpenMobile(false)}>
                <button className="w-full h-10 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                  Bắt đầu miễn phí
                </button>
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
