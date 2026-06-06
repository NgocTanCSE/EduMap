'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Map as MapIcon, MessageSquare, Library, Target, ShieldCheck, Zap, Users, Award, Globe, 
  ChevronDown, Menu, X, BookOpen, Sparkles, HeartHandshake, Building2, GraduationCap, 
  LayoutDashboard, User, Settings, ShieldAlert, BarChart3, Bell, Check, Search as SearchIcon, Loader2
} from 'lucide-react';
import { authService } from '../src/services/auth.service';
import { notificationService, Notification } from '../src/services/notification.service';
import { socketService } from '../src/services/socket.service';
import { searchService } from '../src/services/search.service';
import Link from 'next/link';

export default function Header() {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  // Auth & Notification State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = () => {
      const loggedIn = authService.isLoggedIn();
      setIsLoggedIn(loggedIn);
      if (loggedIn) {
        setUser(authService.getUser());
        fetchNotifications();
        socketService.connect();
        
        const handleNewNotification = (e: any) => {
          fetchNotifications();
        };
        window.addEventListener('edumap-notification', handleNewNotification);
        return () => window.removeEventListener('edumap-notification', handleNewNotification);
      }
    };
    checkAuth();
  }, []);

  // Handle Search Outside Click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        setIsSearching(true);
        const results = await searchService.semanticSearch(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
        setShowSearch(true);
      } else {
        setSearchResults([]);
        setShowSearch(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchNotifications = async () => {
    try {
      const data = await notificationService.getMyNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
    }
  };

  const menuGroups = [
    {
      id: 'explore',
      title: 'Khám phá',
      items: [
        { name: 'Bản đồ Thông minh', href: '/map', desc: 'Tìm trường học, thư viện & lab quanh bạn', icon: MapIcon, color: 'text-yellow-500 bg-yellow-500/10' },
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
        { name: 'Admin Control Panel', href: '/admin/roles', desc: 'Quản trị hệ thống, vai trò & phân quyền', icon: ShieldAlert, color: 'text-red-500 bg-red-500/10' },
      ]
    }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md text-white">
      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-yellow-600 text-white font-extrabold shadow-lg shadow-yellow-500/20">🎓</span>
            <span className="hidden sm:block">Edu<span className="text-yellow-500">Map</span></span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex gap-1">
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
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-white/5 ${
                    activeDropdown === group.id ? 'text-yellow-500 bg-white/5' : 'text-white/80'
                  }`}
                >
                  {group.title}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${
                    activeDropdown === group.id ? 'rotate-180' : ''
                  }`} />
                </button>

                {/* Dropdown Menu */}
                {activeDropdown === group.id && (
                  <div className="absolute left-0 mt-1 w-96 rounded-2xl border border-white/10 bg-[#121215] p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid gap-3">
                      {group.items
                        .filter(item => {
                          if (item.name === 'Moderator Control') return user?.role === 'moderator' || user?.role === 'admin';
                          if (item.name === 'Admin Control Panel') return user?.role === 'admin' || user?.role === 'moderator';
                          return true;
                        })
                        .map((item) => {
                        const IconComponent = item.icon;
                        return (
                          <Link 
                            key={item.name}
                            href={item.href}
                            className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5 group"
                          >
                            <span className={`flex w-9 h-9 items-center justify-center rounded-lg transition-all group-hover:scale-105 ${item.color}`}>
                              <IconComponent className="w-5 h-5" />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-white tracking-tight transition-colors group-hover:text-yellow-500">
                                {item.name}
                              </div>
                              <p className="text-xs text-white/50 mt-0.5 leading-snug">
                                {item.desc}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Search Bar (Semantic AI Search) */}
        <div className="flex-1 max-w-sm px-4 hidden md:block" ref={searchRef}>
            <div className="relative group">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-yellow-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Hỏi AI bất cứ điều gì..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => { if(searchResults.length > 0) setShowSearch(true); }}
                    className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 focus:bg-white/10 transition-all text-white placeholder:text-white/30" 
                />
                {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500 animate-spin" />
                )}

                {/* Search Results Dropdown */}
                {showSearch && (
                    <div className="absolute top-full mt-2 left-0 w-full rounded-2xl border border-white/10 bg-[#121215] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                        {searchResults.length > 0 ? (
                            <div className="max-h-96 overflow-y-auto custom-scrollbar p-2">
                                <div className="px-3 py-2 text-xs font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                                    <Sparkles className="w-3 h-3"/> Semantic AI Match
                                </div>
                                {searchResults.map((result, idx) => (
                                    <Link key={idx} href="/ai-chat" onClick={() => setShowSearch(false)} className="block p-3 hover:bg-white/5 rounded-xl transition-colors group">
                                        <p className="text-sm font-bold text-white group-hover:text-yellow-500 transition-colors line-clamp-1">{result.metadata?.title || 'Tài liệu liên quan'}</p>
                                        <p className="text-xs text-white/50 mt-1 line-clamp-2">{result.document}</p>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center text-white/40 text-sm">
                                Không tìm thấy kết quả phù hợp.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Buttons / Actions */}
        <div className="hidden md:flex items-center gap-4">
          {isLoggedIn ? (
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a0a]"></span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/10 bg-[#121215] shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                      <h3 className="font-bold text-sm">Thông báo</h3>
                      <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">{unreadCount} chưa đọc</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                      {notifications.length > 0 ? notifications.map(notif => (
                        <div key={notif.id} className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!notif.is_read ? 'bg-white/5' : ''}`}>
                          <div className="flex justify-between items-start gap-2">
                            <p className={`text-sm ${!notif.is_read ? 'font-bold text-white' : 'text-white/80'}`}>{notif.title}</p>
                            {!notif.is_read && (
                              <button onClick={(e) => handleMarkAsRead(notif.id, e)} className="text-white/40 hover:text-green-400" title="Đánh dấu đã đọc">
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-white/60 mt-1 line-clamp-2">{notif.body}</p>
                          <p className="text-[10px] text-white/40 mt-2">{new Date(notif.sent_at).toLocaleString('vi-VN')}</p>
                        </div>
                      )) : (
                        <div className="p-8 text-center text-white/40 text-sm">Không có thông báo nào</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile */}
              <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <img 
                  src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'U')}&background=random`} 
                  alt="" 
                  className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10"
                />
              </Link>
            </div>
          ) : (
            <>
              <Link href="/auth" className="text-sm font-medium hover:text-yellow-500 transition-colors text-white/80">
                Đăng nhập
              </Link>
              <Link href="/auth?tab=register">
                <button className="h-9 px-4 rounded-full bg-yellow-600 hover:bg-yellow-500 text-black text-sm font-bold shadow-md shadow-yellow-600/20 active:scale-95 transition-all">
                  Bắt đầu miễn phí
                </button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden flex w-9 h-9 items-center justify-center rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-white"
          onClick={() => setIsOpenMobile(!isOpenMobile)}
        >
          {isOpenMobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="md:hidden border-t border-white/10 bg-[#121215] py-4 px-4 shadow-xl h-[calc(100vh-4rem)] overflow-y-auto">
          {/* Mobile Search */}
          <div className="mb-6">
             <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input 
                    type="text" 
                    placeholder="Hỏi AI bất cứ điều gì..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 text-white" 
                />
             </div>
             {searchResults.length > 0 && (
                 <div className="mt-2 rounded-xl border border-white/10 bg-black/40 p-2">
                     <div className="px-3 py-2 text-[10px] font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                         <Sparkles className="w-3 h-3"/> Semantic Match
                     </div>
                     {searchResults.slice(0, 3).map((result, idx) => (
                         <Link key={idx} href="/ai-chat" onClick={() => setIsOpenMobile(false)} className="block p-3 hover:bg-white/5 rounded-lg">
                             <p className="text-sm font-bold text-white line-clamp-1">{result.metadata?.title || 'Tài liệu liên quan'}</p>
                         </Link>
                     ))}
                 </div>
             )}
          </div>

          <div className="grid gap-6">
            {menuGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 px-2">
                  {group.title}
                </h4>
                <div className="grid gap-1">
                  {group.items
                    .filter(item => {
                      if (item.name === 'Moderator Control') return user?.role === 'moderator' || user?.role === 'admin';
                      if (item.name === 'Admin Control Panel') return user?.role === 'admin' || user?.role === 'moderator';
                      return true;
                    })
                    .map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <Link 
                        key={item.name}
                        href={item.href}
                        onClick={() => setIsOpenMobile(false)}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
                      >
                        <span className={`flex w-8 h-8 items-center justify-center rounded-lg ${item.color}`}>
                          <IconComponent className="w-4.5 h-4.5" />
                        </span>
                        <div className="text-sm font-medium text-white">
                          {item.name}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="border-t border-white/5 pt-6 pb-20 grid gap-3">
              {!isLoggedIn ? (
                <>
                  <Link href="/auth" onClick={() => setIsOpenMobile(false)}>
                    <button className="w-full h-12 rounded-xl border border-white/10 text-sm font-bold hover:bg-white/5 text-white">
                      Đăng nhập
                    </button>
                  </Link>
                  <Link href="/auth?tab=register" onClick={() => setIsOpenMobile(false)}>
                    <button className="w-full h-12 rounded-xl bg-yellow-600 text-black text-sm font-bold hover:bg-yellow-500 shadow-lg shadow-yellow-600/20">
                      Bắt đầu miễn phí
                    </button>
                  </Link>
                </>
              ) : (
                <Link href="/profile" onClick={() => setIsOpenMobile(false)}>
                    <button className="w-full h-12 rounded-xl border border-white/10 text-sm font-bold hover:bg-white/5 text-white">
                      Hồ sơ của tôi
                    </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
