"use client";
import React, { useState, useEffect } from 'react';
import { 
  Settings, Trophy, Star, Target, Flame, ChevronRight, Award, Shield, 
  Zap, Edit2, Save, X, Camera, Globe, Bell, Lock, Loader2, MapPin, 
  Activity, Clock, LogOut, Medal, Calendar, Briefcase, Check, 
  CheckCircle2, User, Sparkles, ArrowRight, Mail, Phone
} from 'lucide-react';
import { authService, CurrentUser } from '@/src/services/auth.service';
import { gamificationService, UserProgress, LeaderboardUser } from '@/reporting/services/gamification.service';
import { storageService } from '@/src/services/storage.service';
import FileUpload from '@/src/components/ui/FileUpload';
import { toast } from 'sonner';
import Link from 'next/link';
import { avatarFallback, onImageError } from '@/src/lib/illustrations';

export default function ProfilePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'gamification' | 'settings'>('overview');
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', bio: '', avatar_url: '', date_of_birth: '', major: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState({
    notif_push: true,
    notif_email: false,
    notif_community: true,
    notif_career: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const currentUser = await authService.fetchUserProfile();
      setUser(currentUser);

      if (currentUser) {
        setProfileForm({
          full_name: currentUser.fullName || '',
          phone: (currentUser as any).phone || '',
          bio: (currentUser as any).bio || '',
          avatar_url: currentUser.avatar_url || '',
          date_of_birth: (currentUser as any).date_of_birth || '',
          major: (currentUser as any).major || '',
        });

        try {
          const prefs = await authService.getPreferences();
          if (prefs) {
            setNotificationPrefs({
              notif_push: true,
              notif_email: false,
              notif_community: true,
              notif_career: true,
              ...(prefs.notification_settings ? JSON.parse(prefs.notification_settings) : {}),
            });
          }
        } catch {
          // Default preferences
        }

        const [progressResult, badgesResult, leaderboardResult] = await Promise.allSettled([
            gamificationService.getMyProgress(),
            gamificationService.getMyBadges(),
            gamificationService.getLeaderboard()
        ]);
        if (progressResult.status === 'fulfilled') setProgress(progressResult.value);
        if (badgesResult.status === 'fulfilled') setBadges(badgesResult.value);
        if (leaderboardResult.status === 'fulfilled') setLeaderboard((leaderboardResult.value || []).slice(0, 5));
      } else {
        window.location.href = '/auth/login';
      }
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('Không thể tải hồ sơ')) {
        authService.logout();
      } else {
        toast.error('Không thể tải thông tin hồ sơ');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-12 w-full">
      {/* Cover Banner */}
      <div className="relative h-36 sm:h-56 md:h-64 w-full bg-gradient-to-r from-primary/30 via-primary/15 to-accent/20 overflow-hidden border-b border-border/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,119,6,0.15),rgba(255,255,255,0))]" />
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-background/85 backdrop-blur-md border border-border text-foreground/80 shadow-xs">
            Hồ sơ EduMap
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Profile Card Header */}
        <div className="relative -mt-12 sm:-mt-16 md:-mt-20 mb-6 sm:mb-8 rounded-2xl border border-border/80 bg-card p-4 sm:p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6">
            
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-5 text-center sm:text-left">
              {/* Avatar with Upload */}
              <div 
                className="relative group cursor-pointer shrink-0" 
                onClick={() => !uploadingAvatar && document.getElementById('avatar-upload-input')?.click()}
                title="Bấm để thay đổi ảnh đại diện"
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden border-4 border-card bg-secondary shadow-md ring-2 ring-primary/20">
                  <img
                    src={user.avatar_url || avatarFallback(user.fullName)}
                    onError={onImageError(avatarFallback(user.fullName))}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                )}
                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-accent ring-2 ring-card" title="Đang hoạt động" />
              </div>

              {/* Hidden file input */}
              <input
                id="avatar-upload-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith('image/')) {
                    toast.error('Chỉ chấp nhận file ảnh (jpg, png, gif...)');
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error('Kích thước ảnh không được vượt quá 5MB');
                    return;
                  }
                  try {
                    setUploadingAvatar(true);
                    const uploaded = await storageService.uploadFile(file);
                    const avatarUrl = uploaded.file_url;
                    if (avatarUrl) {
                      setProfileForm({ ...profileForm, avatar_url: avatarUrl });
                      await authService.updateProfile({ avatar_url: avatarUrl });
                      setUser({ ...user, avatar_url: avatarUrl });
                      toast.success('Cập nhật ảnh đại diện thành công!');
                    }
                  } catch (err: any) {
                    toast.error(err.message || 'Tải ảnh lên thất bại');
                  } finally {
                    setUploadingAvatar(false);
                    e.target.value = '';
                  }
                }}
              />

              {/* User details */}
              <div className="space-y-1 sm:space-y-1.5 w-full">
                <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">{user.fullName}</h1>
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-accent shrink-0" aria-label="Xác thực" />
                  <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
                    {user.role}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                  <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate max-w-[280px] sm:max-w-none">{user.email}</span>
                </p>
                {profileForm.major && (
                  <p className="text-xs text-primary font-medium flex items-center justify-center sm:justify-start gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 shrink-0" /> Chuyên ngành: {profileForm.major}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Actions (Full width grid on mobile) */}
            <div className="w-full md:w-auto grid grid-cols-2 sm:flex items-center justify-center md:justify-end gap-2.5 sm:gap-3 shrink-0 pt-2 sm:pt-0">
              <button
                onClick={() => setActiveTab('settings')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-card border border-border hover:border-primary/50 text-xs font-bold transition-all shadow-xs"
              >
                <Edit2 className="w-3.5 h-3.5 text-primary" /> Chỉnh sửa
              </button>
              <button
                onClick={handleLogout}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold transition-all"
              >
                <LogOut className="w-3.5 h-3.5" /> Đăng xuất
              </button>
            </div>
          </div>

          {/* 4 Quick Stat Counters Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-border/80">
            <div className="bg-muted/40 p-3 sm:p-4 rounded-xl border border-border/60 text-center sm:text-left">
              <div className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-center sm:justify-start gap-1.5">
                <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" /> Cấp độ (Level)
              </div>
              <div className="text-xl sm:text-2xl font-bold text-primary">Level {progress?.level || 1}</div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Sinh viên tích cực</div>
            </div>

            <div className="bg-muted/40 p-3 sm:p-4 rounded-xl border border-border/60 text-center sm:text-left">
              <div className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-center sm:justify-start gap-1.5">
                <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" /> Điểm tích lũy (XP)
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">{progress?.points.toLocaleString() || '0'} <span className="text-xs font-normal text-muted-foreground">XP</span></div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Còn {progress?.points_needed || 100} XP lên cấp</div>
            </div>

            <div className="bg-muted/40 p-3 sm:p-4 rounded-xl border border-border/60 text-center sm:text-left">
              <div className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-center sm:justify-start gap-1.5">
                <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" /> Huy hiệu
              </div>
              <div className="text-xl sm:text-2xl font-bold text-primary">{badges.length}</div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Thành tích học thuật</div>
            </div>

            <div className="bg-muted/40 p-3 sm:p-4 rounded-xl border border-border/60 text-center sm:text-left">
              <div className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-center sm:justify-start gap-1.5">
                <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" /> Xếp hạng
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">Top 10%</div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Toàn hệ thống EduMap</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation (Edge-to-edge scrollable on mobile) */}
        <div className="flex border-b border-border/80 mb-6 gap-2 sm:gap-4 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
          {[
            { id: 'overview', icon: User, label: 'Tổng quan' },
            { id: 'gamification', icon: Award, label: 'Tiến độ & Huy hiệu' },
            { id: 'settings', icon: Settings, label: 'Cài đặt tài khoản' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-3 sm:px-4 border-b-2 font-bold text-xs uppercase tracking-wide transition-all whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {/* Bio & Details */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Thông tin cá nhân
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs">
                  <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                    <span className="text-muted-foreground block mb-1">Họ và tên</span>
                    <span className="font-bold text-foreground text-sm">{user.fullName}</span>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                    <span className="text-muted-foreground block mb-1">Email liên hệ</span>
                    <span className="font-bold text-foreground text-sm truncate block">{user.email}</span>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                    <span className="text-muted-foreground block mb-1">Số điện thoại</span>
                    <span className="font-bold text-foreground text-sm">{profileForm.phone || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl border border-border/60">
                    <span className="text-muted-foreground block mb-1">Ngày sinh</span>
                    <span className="font-bold text-foreground text-sm">{profileForm.date_of_birth ? new Date(profileForm.date_of_birth).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-xs font-semibold text-muted-foreground block mb-1.5">Giới thiệu bản thân</span>
                  <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed p-3.5 sm:p-4 bg-muted/30 rounded-xl border border-border/60">
                    {profileForm.bio || 'Chưa có giới thiệu bản thân. Hãy vào tab "Cài đặt tài khoản" để cập nhật bio của bạn.'}
                  </p>
                </div>
              </div>

              {/* Learning Progress Card */}
              {progress && (
                <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent" /> Thanh tiến độ kinh nghiệm
                  </h3>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-foreground">Cấp độ {progress.level}</span>
                    <span className="text-muted-foreground font-semibold">{progress.points} / {progress.next_level_points} XP ({Math.round(progress.progress_percent)}%)</span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(5, progress.progress_percent))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Tích lũy thêm {progress.points_needed} XP nữa để thăng cấp Level {progress.level + 1}!
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar Widgets */}
            <div className="space-y-6">
              {/* Leaderboard */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-accent" /> Top Bảng Xếp Hạng
                  </h3>
                  <Link href="/leaderboard" className="text-[11px] text-primary hover:underline font-semibold">
                    Xem hết
                  </Link>
                </div>
                <div className="space-y-2">
                  {leaderboard.map((u, idx) => (
                    <div 
                      key={u.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl text-xs border ${
                        u.id === user.id ? 'bg-primary/10 border-primary/30 font-bold' : 'bg-muted/30 border-border/60'
                      }`}
                    >
                      <span className={`w-5 text-center font-bold ${idx === 0 ? 'text-accent' : idx === 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                        #{idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-foreground font-medium">{u.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">Level {u.level}</p>
                      </div>
                      <span className="font-semibold text-primary shrink-0">{u.points} XP</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick portal links */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Lối tắt nhanh</h3>
                <div className="space-y-2">
                  <Link href="/map" className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 hover:text-primary transition-all text-xs font-medium border border-border/60">
                    <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-primary" /> Bản đồ giáo dục</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link href="/community" className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 hover:text-primary transition-all text-xs font-medium border border-border/60">
                    <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-primary" /> Diễn đàn cộng đồng</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link href="/stem" className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 hover:text-primary transition-all text-xs font-medium border border-border/60">
                    <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-primary" /> Phòng Lab STEM</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Gamification */}
        {activeTab === 'gamification' && progress && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Badges Collection */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" /> Kệ Huy Hiệu Vinh Danh ({badges.length})
              </h3>
              {badges.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  {badges.map((b) => (
                    <div key={b.id} className="p-3 sm:p-4 rounded-xl bg-muted/30 border border-border/80 hover:border-primary/50 text-center flex flex-col items-center justify-center transition-all group">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Award className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                      </div>
                      <p className="text-xs font-bold text-foreground truncate w-full">{b.badge?.name || 'Huy hiệu'}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">{b.badge?.description || 'Thành tích đạt được'}</p>
                      <span className="text-[9px] text-primary/80 mt-2 block font-medium">
                        {new Date(b.earned_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-muted/20 border border-dashed border-border rounded-xl">
                  <Award className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Bạn chưa có huy hiệu nào. Hãy tham gia thảo luận và tìm kiếm học bổng để mở khóa!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl">
            {/* Edit Profile Form */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-8 shadow-sm">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-5 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" /> Cập nhật hồ sơ cá nhân
              </h3>
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setSavingProfile(true);
                    await authService.updateProfile({
                      full_name: profileForm.full_name,
                      phone: profileForm.phone,
                      bio: profileForm.bio,
                      avatar_url: profileForm.avatar_url,
                      date_of_birth: profileForm.date_of_birth,
                      major: profileForm.major,
                    });
                    toast.success('Cập nhật hồ sơ thành công!');
                    setUser(authService.getUser());
                  } catch {
                    toast.error('Cập nhật hồ sơ thất bại');
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Họ và tên *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Số điện thoại</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Ngày sinh</label>
                    <input
                      type="date"
                      value={profileForm.date_of_birth || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
                      className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Chuyên ngành học tập</label>
                    <input
                      type="text"
                      placeholder="VD: Khoa học máy tính, Ngôn ngữ Anh..."
                      value={profileForm.major}
                      onChange={(e) => setProfileForm({ ...profileForm, major: e.target.value })}
                      className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Giới thiệu ngắn (Bio)</label>
                  <textarea
                    rows={4}
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    placeholder="Viết một đoạn ngắn về định hướng học tập, mục tiêu nghề nghiệp..."
                    className="w-full p-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {savingProfile ? 'Đang lưu...' : 'Lưu thông tin hồ sơ'}
                </button>
              </form>
            </div>

            {/* Change Password */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-8 shadow-sm">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-5 flex items-center gap-2">
                <Lock className="w-5 h-5 text-destructive" /> Đổi mật khẩu tài khoản
              </h3>
              <form
                onSubmit={async (e) => {
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
                    toast.error('Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu cũ.');
                  } finally {
                    setSavingPassword(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Mật khẩu hiện tại *</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Mật khẩu mới *</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Xác nhận mật khẩu mới *</label>
                    <input
                      type="password"
                      required
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-base sm:text-sm focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  {savingPassword ? 'Đang xử lý...' : 'Xác nhận đổi mật khẩu'}
                </button>
              </form>
            </div>

            {/* Notification Preferences */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-8 shadow-sm">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" /> Tùy chọn thông báo
              </h3>
              <div className="space-y-3">
                {[
                  { id: 'notif_push', label: 'Thông báo đẩy trình duyệt', desc: 'Nhận thông báo cập nhật điểm danh và tin mới ngay khi duyệt web' },
                  { id: 'notif_email', label: 'Bản tin Email hàng tuần', desc: 'Nhận thư tổng hợp học bổng mới và cơ hội thực tập định kỳ' },
                  { id: 'notif_community', label: 'Tương tác cộng đồng', desc: 'Nhận thông báo khi bài viết nhận được bình luận hoặc lượt thích' },
                  { id: 'notif_career', label: 'Khớp nối cơ hội nghề nghiệp', desc: 'AI tự động gửi thông báo khi có việc làm đúng chuyên ngành' },
                ].map((pref) => (
                  <div key={pref.id} className="flex items-center justify-between p-3.5 bg-muted/40 rounded-xl border border-border/60 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-foreground">{pref.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{pref.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotificationPrefs({ ...notificationPrefs, [pref.id]: !notificationPrefs[pref.id as keyof typeof notificationPrefs] })}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                        notificationPrefs[pref.id as keyof typeof notificationPrefs] ? 'bg-primary' : 'bg-muted border border-border'
                      }`}
                    >
                      <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform absolute top-1 ${
                        notificationPrefs[pref.id as keyof typeof notificationPrefs] ? 'right-1' : 'left-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    setSavingPrefs(true);
                    await authService.updatePreferences({
                      notification_settings: JSON.stringify(notificationPrefs),
                    });
                    toast.success('Đã lưu tùy chọn thông báo!');
                  } catch {
                    toast.error('Lưu cài đặt thất bại');
                  } finally {
                    setSavingPrefs(false);
                  }
                }}
                disabled={savingPrefs}
                className="mt-4 w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {savingPrefs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {savingPrefs ? 'Đang lưu...' : 'Lưu tùy chọn thông báo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
