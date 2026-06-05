"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, BookOpen, Map, MessageSquare, 
  Settings, LogOut, Bell, Search, TrendingUp, 
  Clock, Award, Users, ChevronRight, BrainCircuit, Calendar, FileText, UserCircle, Target
} from 'lucide-react';
import { authService, CurrentUser } from '@/src/services/auth.service';
import { dashboardService } from '@/src/services/dashboard.service';
import { gamificationService, UserProgress } from '@/src/services/gamification.service';
import { Skeleton, CardSkeleton, StatSkeleton } from '@/src/components/ui/Skeleton';
import { toast } from 'sonner';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(true);
  
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const currentUser = authService.getUser();
    if (!currentUser) {
        window.location.href = '/auth/login';
        return;
    }
    setUser(currentUser);
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewRes, progressRes] = await Promise.all([
          dashboardService.getOverview(),
          gamificationService.getMyProgress()
      ]);
      setData(overviewRes);
      setProgress(progressRes);
      
      // Fetch AI insight in background to not block main rendering
      fetchAiInsight();
    } catch (error) {
      console.error("Lỗi fetch dashboard data:", error);
      toast.error('Không thể tải dữ liệu bảng điều khiển.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAiInsight = async () => {
    try {
      setInsightLoading(true);
      const insight = await dashboardService.getDailyInsight();
      setAiInsight(insight);
    } catch (error) {
      console.error("Lỗi fetch AI insight:", error);
    } finally {
      setInsightLoading(false);
    }
  };

  const handleLogout = () => {
      authService.logout();
  };

  const statCards = [
    { label: 'Tài liệu đã xem', value: data?.stats?.learning_materials || 0, icon: BookOpen, color: 'text-blue-500', link: '/library' },
    { label: 'Kỹ năng làm chủ', value: data?.stats?.skills_mastered || 0, icon: TrendingUp, color: 'text-purple-500', link: '/career/profile' },
    { label: 'Đóng góp cộng đồng', value: data?.stats?.community_contributions || 0, icon: MessageSquare, color: 'text-green-500', link: '/community' },
    { label: 'Chứng chỉ', value: data?.stats?.certificates_earned || 0, icon: Award, color: 'text-yellow-500', link: '/certificates' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0a0a] p-6 hidden lg:flex flex-col z-10 relative shrink-0">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-yellow-600 rounded-xl flex items-center justify-center">
            <Award className="text-black w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">EduMap</span>
        </div>

        <nav className="space-y-2 flex-1">
          <Link href="/dashboard" className="flex items-center gap-3 p-3 rounded-xl bg-yellow-600/10 text-yellow-500 border border-yellow-500/20 font-bold">
            <LayoutDashboard className="w-5 h-5" /> Tổng quan
          </Link>
          <Link href="/career" className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-white/5 hover:text-white transition-all">
            <TrendingUp className="w-5 h-5" /> Phát triển Nghề nghiệp
          </Link>
          <Link href="/library" className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-white/5 hover:text-white transition-all">
            <BookOpen className="w-5 h-5" /> Thư viện
          </Link>
          <Link href="/community" className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-white/5 hover:text-white transition-all">
            <Users className="w-5 h-5" /> Cộng đồng
          </Link>
          <Link href="/mentor" className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-white/5 hover:text-white transition-all">
            <UserCircle className="w-5 h-5" /> Mentor
          </Link>
          <Link href="/certificates" className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-white/5 hover:text-white transition-all">
            <Award className="w-5 h-5" /> Chứng chỉ
          </Link>
          <Link href="/map" className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-white/5 hover:text-white transition-all">
            <Map className="w-5 h-5" /> Bản đồ
          </Link>
        </nav>

        <div className="pt-6 border-t border-white/5 space-y-2">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl text-red-500/70 hover:bg-red-500/10 hover:text-red-400 transition-all font-medium">
            <LogOut className="w-5 h-5" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-20 shrink-0">
          <div className="relative w-96 max-w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
                type="text" 
                placeholder="Tìm kiếm EduMap..." 
                className="w-full bg-black/40 border border-white/10 rounded-full py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-purple-500 transition-colors" 
            />          
          </div>
          <div className="flex items-center gap-5">
            {progress && (
                <div className="hidden lg:flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-4 py-1.5 cursor-pointer hover:bg-yellow-500/20 transition-all" onClick={() => window.location.href='/profile'}>
                    <Award className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-bold text-yellow-500">Lv.{progress.level}</span>
                    <div className="w-16 h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500" style={{ width: `${progress.progress_percent}%` }} />
                    </div>
                </div>
            )}
            <button className="relative p-2 text-gray-400 hover:text-white transition-all">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#0a0a0a]"></span>
            </button>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href='/profile'}>
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-gray-200">{user?.fullName || 'Người dùng'}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">{user?.role || 'Học viên'}</p>
                </div>
                <img 
                    src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'U')}&background=random`} 
                    alt="" 
                    className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10"
                />
            </div>
          </div>
        </header>

        {/* Dashboard Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* AI Daily Insight */}
                <section className="bg-gradient-to-r from-purple-900/30 to-blue-900/20 border border-purple-500/30 rounded-3xl p-8 relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full -mr-20 -mt-20 pointer-events-none" />
                    
                    <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center shrink-0 border border-purple-500/30 shadow-inner">
                        <BrainCircuit className="w-8 h-8 text-purple-400 animate-pulse" />
                    </div>
                    
                    <div className="flex-1 relative z-10">
                        <h2 className="text-sm font-black text-purple-400 uppercase tracking-widest mb-1">AI Daily Insight</h2>
                        {insightLoading ? (
                            <div className="space-y-2 mt-2">
                                <div className="h-4 bg-white/10 rounded animate-pulse w-3/4"></div>
                                <div className="h-4 bg-white/10 rounded animate-pulse w-1/2"></div>
                            </div>
                        ) : (
                            <>
                                <p className="text-xl font-bold text-gray-100 leading-snug mb-2">
                                    "{aiInsight?.motivation_message}"
                                </p>
                                <p className="text-sm text-blue-300 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                                    Gợi ý hành động: <strong>{aiInsight?.suggested_action}</strong>
                                </p>
                            </>
                        )}
                    </div>
                </section>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {loading ? (
                    [1, 2, 3, 4].map(i => (
                        <StatSkeleton key={i} />
                    ))
                    ) : (
                    statCards.map((stat, i) => (
                        <Link href={stat.link} key={i} className="block">
                            <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl hover:bg-zinc-900 hover:border-white/10 transition-all group h-full flex flex-col justify-between">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 bg-black/40 rounded-xl border border-white/5 group-hover:scale-110 transition-transform ${stat.color}`}>
                                        <stat.icon className="w-5 h-5" />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-3xl font-black mb-1">{stat.value}</div>
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{stat.label}</div>
                                </div>
                            </div>
                        </Link>
                    ))
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Active Goals */}
                    <section className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 space-y-6">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Target className="text-yellow-500 w-5 h-5" /> Mục tiêu Đang theo đuổi</h2>
                            <Link href="/career/profile" className="text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest">Quản lý</Link>
                        </div>
                        <div className="space-y-4">
                            {loading ? (
                                <><CardSkeleton /><CardSkeleton /></>
                            ) : data?.active_goals?.length > 0 ? (
                                data.active_goals.map((goal: any) => (
                                    <div key={goal.id} className="bg-black/40 p-4 rounded-2xl border border-white/5 relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-600 group-hover:w-2 transition-all" />
                                        <h3 className="font-bold text-sm mb-1">{goal.goal_title}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-1">{goal.description || 'Chưa có mô tả'}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-gray-500 italic">Bạn chưa thiết lập mục tiêu nào.</p>
                                    <Link href="/career/profile" className="text-yellow-500 text-xs font-bold mt-2 inline-block">Thiết lập ngay</Link>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Upcoming Mentoring */}
                    <section className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 space-y-6">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Calendar className="text-green-500 w-5 h-5" /> Lịch hẹn Mentor Tới</h2>
                            <Link href="/mentor" className="text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest">Tất cả</Link>
                        </div>
                        <div className="space-y-4">
                            {loading ? (
                                <><CardSkeleton /><CardSkeleton /></>
                            ) : data?.upcoming_mentoring?.length > 0 ? (
                                data.upcoming_mentoring.map((booking: any) => {
                                    const date = new Date(booking.start);
                                    return (
                                        <div key={booking.id} className="flex gap-4 items-center bg-black/40 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="bg-green-500/10 text-green-500 text-center rounded-xl p-2 min-w-[60px] border border-green-500/20">
                                                <div className="text-xs font-bold uppercase">{date.toLocaleDateString('vi-VN', { month: 'short' })}</div>
                                                <div className="text-xl font-black">{date.getDate()}</div>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-sm">Cố vấn: {booking.mentor_name}</h3>
                                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Clock size={12}/> {date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            {booking.meeting_url && (
                                                <a href={booking.meeting_url} target="_blank" className="bg-white/10 p-3 rounded-xl hover:bg-white/20 transition-colors text-white">
                                                    {/* Using external link icon as fallback for video */}
                                                    <BookOpen size={16} />
                                                </a>
                                            )}
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-gray-500 italic">Không có lịch hẹn nào sắp tới.</p>
                                    <Link href="/mentor" className="text-green-500 text-xs font-bold mt-2 inline-block">Tìm Mentor</Link>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}

