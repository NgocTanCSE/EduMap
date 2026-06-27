"use client";
import React, { useState, useEffect } from 'react';
import { Settings, Trophy, Star, Target, Flame, ChevronRight, Award, Shield, Zap, Edit2, Save, X, Camera, Globe, Bell, Lock, Loader2, MapPin, Activity, Clock, LogOut, Medal } from 'lucide-react';
import { authService, CurrentUser } from '@/src/services/auth.service';
import { gamificationService, UserProgress, LeaderboardUser } from '@/src/services/gamification.service';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ProfilePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', bio: '', avatar_url: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState({
    notif_push: true,
    notif_email: false,
    notif_community: true,
    notif_career: true,
  });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const currentUser = authService.getUser();
      setUser(currentUser);

      if (currentUser) {
        setProfileForm({
          full_name: currentUser.fullName || '',
          phone: (currentUser as any).phone || '',
          bio: (currentUser as any).bio || '',
          avatar_url: currentUser.avatar_url || '',
        });

        const [progressData, badgesData, leaderboardData] = await Promise.all([
            gamificationService.getMyProgress(),
            gamificationService.getMyBadges(),
            gamificationService.getLeaderboard()
        ]);
        setProgress(progressData);
        setBadges(badgesData);
        setLeaderboard(leaderboardData.slice(0, 5));
      } else {
        window.location.href = '/auth/login';
      }
    } catch (error) {
      toast.error('Không thể tải thông tin hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/5 bg-[#0a0a0a] p-6 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible shrink-0">
        <h2 className="text-xl font-bold mb-6 hidden md:block px-2 text-yellow-500">My Profile</h2>
        {[
          { id: 'overview', icon: Shield, label: 'Tổng quan' },
          { id: 'gamification', icon: Award, label: 'Thành tích & Level' },
          { id: 'settings', icon: Settings, label: 'Cài đặt tài khoản' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-yellow-600/10 text-yellow-500 font-bold border border-yellow-500/20' 
                : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}
        
        <div className="mt-auto hidden md:block pt-6 border-t border-white/5">
          <button onClick={handleLogout} className="flex items-center gap-3 p-3 w-full rounded-xl text-red-500 hover:bg-red-500/10 transition-all font-bold">
            <LogOut className="w-5 h-5" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Header Profile Card */}
          <div className="bg-card border border-white/5 rounded-[40px] p-8 relative overflow-hidden flex flex-col md:flex-row gap-8 items-center md:items-start shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 blur-[100px] rounded-full -mr-20 -mt-20 pointer-events-none" />
            
            <div className="relative group cursor-pointer shrink-0">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-yellow-500/30">
                <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=random`} alt="Avatar" className="w-full h-full object-cover" />
              </div>
            </div>
            
            <div className="flex-1 text-center md:text-left space-y-3 relative z-10">
              <h1 className="text-3xl font-black">{user.fullName}</h1>
              <p className="text-white/60 max-w-lg leading-relaxed text-sm">{user.email}</p>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white/50 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                  <Shield className="w-4 h-4 text-purple-400" /> {user.role.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            {progress && (
              <div className="flex md:flex-col gap-4 w-full md:w-auto relative z-10 shrink-0">
                <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-center min-w-[100px]">
                  <div className="text-2xl font-black text-yellow-500">{progress.level}</div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-white/40">Level</div>
                </div>
                <div className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 text-center min-w-[100px]">
                  <div className="text-2xl font-black text-purple-400">{progress.points.toLocaleString()}</div>
                  <div className="text-[10px] uppercase font-bold tracking-widest text-white/40">XP</div>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Content based on Tab */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Column */}
            <div className="lg:col-span-2 space-y-8">
              
              {activeTab === 'overview' && (
                <section className="bg-card border border-white/5 rounded-[32px] p-8 space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2"><Activity className="text-green-500" /> Hoạt động gần đây</h2>
                    <p className="text-sm text-white/40">Tính năng lịch sử hoạt động đang được cập nhật.</p>
                </section>
              )}

              {activeTab === 'gamification' && progress && (
                <section className="space-y-8">
                  {/* Progress Card */}
                  <div className="bg-card border border-white/5 rounded-[32px] p-8 shadow-xl">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Award className="text-yellow-500" /> Tiến độ Thăng cấp</h2>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-sm font-medium text-white/70">Level {progress.level}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-yellow-500">{progress.points.toLocaleString()}</span>
                        <span className="text-xs text-white/40 ml-1">/ {progress.next_level_points.toLocaleString()} XP</span>
                      </div>
                    </div>
                    
                    <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-600 to-purple-600 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)] transition-all duration-1000" 
                        style={{ width: `${progress.progress_percent}%` }} 
                      />
                    </div>
                    <p className="text-[10px] text-white/40 mt-3 text-center">Hoàn thành thêm nhiệm vụ để nhận {progress.points_needed.toLocaleString()} XP và thăng cấp!</p>
                  </div>

                  {/* Badges Collection */}
                  <div className="bg-card border border-white/5 rounded-[32px] p-8">
                      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-400" /> Kệ Huy hiệu ({badges.length})
                      </h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {badges.length > 0 ? (
                            badges.map((userBadge) => (
                                <div key={userBadge.id} className="aspect-square bg-black/40 rounded-3xl border border-white/5 flex flex-col items-center justify-center p-4 text-center group relative cursor-help hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all">
                                    <img src={'https://cdn-icons-png.flaticon.com/512/5753/5753065.png'} alt="Badge" className="w-12 h-12 mb-3 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all drop-shadow-lg" />
                                    <span className="text-xs font-bold w-full truncate">{userBadge.badge.name}</span>
                                    
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-black/90 backdrop-blur-md text-white text-xs p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10 text-left">
                                        <p className="font-bold text-yellow-500 mb-1">{userBadge.badge.name}</p>
                                        <p className="text-white/60 mb-2">{userBadge.badge.description}</p>
                                        <p className="text-[8px] uppercase tracking-wider">Mở khóa: {new Date(userBadge.earned_at).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full text-center py-8 text-white/40 text-sm">Bạn chưa có huy hiệu nào. Hãy tích cực tham gia các hoạt động để mở khóa!</div>
                        )}
                      </div>
                  </div>
                </section>
              )}

              {activeTab === 'settings' && (
                <section className="space-y-8">
                  {/* Update Profile Form */}
                  <div className="bg-card border border-white/5 rounded-[32px] p-8">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-yellow-500" /> Cập nhật hồ sơ cá nhân
                    </h2>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const formData = new FormData(e.target as HTMLFormElement);
                        await authService.updateProfile({
                          full_name: profileForm.full_name,
                          phone: profileForm.phone,
                          bio: profileForm.bio,
                          avatar_url: profileForm.avatar_url,
                        });
                        toast.success('Cập nhật hồ sơ thành công!');
                        setUser(authService.getUser());
                      } catch (err) {
                        toast.error('Cập nhật hồ sơ thất bại');
                      }
                    }} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Họ và tên</label>
                          <input
                            type="text"
                            name="full_name"
                            defaultValue={user?.fullName || ''}
                            onChange={(e) => setProfileForm({...profileForm, full_name: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-yellow-500 outline-none transition-colors"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Số điện thoại</label>
                          <input
                            type="tel"
                            name="phone"
                            defaultValue={user?.phone || ''}
                            onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-yellow-500 outline-none transition-colors"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Avatar URL</label>
                        <input
                          type="url"
                          name="avatar_url"
                          defaultValue={user?.avatar_url || ''}
                          onChange={(e) => setProfileForm({...profileForm, avatar_url: e.target.value})}
                          placeholder="https://..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-yellow-500 outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Giới thiệu bản thân</label>
                        <textarea
                          name="bio"
                          rows={4}
                          defaultValue={user?.bio || ''}
                          onChange={(e) => setProfileForm({...profileForm, bio: e.target.value})}
                          placeholder="Viết vài dòng về bản thân..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-yellow-500 outline-none transition-colors resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                      </button>
                    </form>
                  </div>

                  {/* Change Password Form */}
                  <div className="bg-card border border-white/5 rounded-[32px] p-8">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <Lock className="w-5 h-5 text-red-400" /> Đổi mật khẩu
                    </h2>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                        toast.error('Mật khẩu xác nhận không khớp');
                        return;
                      }
                      try {
                        setSavingPassword(true);
                        const res = await fetch('/api/auth/change-password', {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authService.getAccessToken()}`
                          },
                          body: JSON.stringify({ 
                            currentPassword: passwordForm.currentPassword,
                            newPassword: passwordForm.newPassword 
                          }),
                        });
                        if (!res.ok) throw new Error();
                        toast.success('Đổi mật khẩu thành công!');
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                      } catch {
                        toast.error('Đổi mật khẩu thất bại');
                      } finally {
                        setSavingPassword(false);
                      }
                    }} className="space-y-6">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Mật khẩu hiện tại</label>
                        <input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-400 outline-none transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Mật khẩu mới</label>
                          <input
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-400 outline-none transition-colors"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Xác nhận mật khẩu</label>
                          <input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-400 outline-none transition-colors"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={savingPassword}
                        className="px-8 py-3 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        {savingPassword ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                      </button>
                    </form>
                  </div>

                  {/* Notification Preferences */}
                  <div className="bg-card border border-white/5 rounded-[32px] p-8">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <Bell className="w-5 h-5 text-blue-400" /> Tùy chọn thông báo
                    </h2>
                    <div className="space-y-4">
                      {[
                        { id: 'notif_push', label: 'Thông báo đẩy (Push)', desc: 'Nhận thông báo trực tiếp trên trình duyệt', checked: true },
                        { id: 'notif_email', label: 'Thông báo qua Email', desc: 'Nhận email tóm tắt hoạt động hàng tuần', checked: false },
                        { id: 'notif_community', label: 'Cộng đồng & Bài viết', desc: 'Thông báo khi có bình luận hoặc like', checked: true },
                        { id: 'notif_career', label: 'Cơ hội nghề nghiệp', desc: 'Thông báo việc làm và học bổng phù hợp', checked: true },
                      ].map((pref) => (
                        <div key={pref.id} className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                          <div>
                            <p className="font-bold text-sm">{pref.label}</p>
                            <p className="text-xs text-white/40">{pref.desc}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNotificationPrefs({...notificationPrefs, [pref.id]: !notificationPrefs[pref.id as keyof typeof notificationPrefs]})}
                            className={`w-12 h-6 rounded-full transition-colors ${notificationPrefs[pref.id as keyof typeof notificationPrefs] ? 'bg-yellow-600' : 'bg-zinc-700'}`}
                          >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${notificationPrefs[pref.id as keyof typeof notificationPrefs] ? 'translate-x-6' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

            </div>

            {/* Right Column (Widgets) */}
            <div className="space-y-8">
              
              {/* Leaderboard Widget */}
              <div className="bg-card border border-white/5 rounded-[32px] p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-500" /> Bảng xếp hạng</h3>
                  <Link href="/leaderboard" className="text-[10px] uppercase font-bold text-white/40 hover:text-white transition-colors">Xem tất cả</Link>
                </div>
                
                <div className="space-y-3">
                  {leaderboard.map((u, index) => (
                    <div key={u.id} className={`flex items-center gap-3 p-3 rounded-2xl transition-colors border ${u.id === user.id ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-black/40 border-white/5 hover:border-white/10'}`}>
                      <span className={`text-sm font-black w-6 text-center ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-700' : 'text-white/20'}`}>
                        #{index + 1}
                      </span>
                      <div className="flex-1">
                        <p className={`text-sm font-bold truncate ${u.id === user.id ? 'text-yellow-500' : ''}`}>{u.full_name}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Level {u.level}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold">{u.points.toLocaleString()}</span>
                        <span className="text-[8px] text-white/40 ml-1">XP</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
