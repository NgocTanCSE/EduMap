"use client";

import { InteractiveGridPattern } from '@/components/ui/magic/InteractiveGridPattern';
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  LogOut,
  User,
  Settings,
  ShieldCheck,
  BookOpen,
  Award,
  Users,
  Heart,
  MapPin,
  Sparkles,
  ArrowUpRight,
  Calendar,
  Compass,
} from "lucide-react";
import { useAuth } from "@/src/contexts/AuthContext";
import { dashboardService } from "@/reporting/services/dashboard.service";
import { PersonalHub } from "@/components/dashboard/PersonalHub";
import { avatarFallback, onImageError } from "@/src/lib/illustrations";

/**
 * Dashboard — The user's home hub inspired by Orvel's Warm Editorial Overview.
 * Preserves 100% of existing state, data-fetching, auth logic, and routes.
 */
export default function DashboardPage() {
  const { user, isLoggedIn, loading: authLoading, logout } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [insight, setInsight] = useState<any>(null);

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const [ov, ins] = await Promise.allSettled([
          dashboardService.getOverview(),
          dashboardService.getDailyInsight(),
        ]);
        if (!cancelled) {
          if (ov.status === "fulfilled") setOverview(ov.value);
          if (ins.status === "fulfilled") setInsight(ins.value);
        }
      } catch {
        // overview/insight are non-critical
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isLoggedIn]);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated state
  if (!isLoggedIn || !user) {
    return (
      <main className="flex min-h-[80vh] w-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg rounded-[22px] border border-border/80 bg-card p-8 text-center shadow-orvel">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <User className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">Chào mừng bạn đến với EduMap!</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            Đăng nhập để theo dõi tiến trình học tập, không gian lưu trữ cá nhân, chứng chỉ và các cơ hội nghề nghiệp tại Biên Hòa, Đồng Nai.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/auth/login"
              className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              <User className="h-4 w-4" /> Đăng nhập tài khoản
            </Link>
            <Link
              href="/map"
              className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <Compass className="h-4 w-4" /> Khám phá bản đồ
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const stats = overview?.stats ?? {};
  const mentoring = Array.isArray(overview?.upcoming_mentoring)
    ? overview.upcoming_mentoring
    : [];

  const STAT_CARDS = [
    { title: "Học liệu đã xem", value: stats.learning_materials ?? 0, icon: BookOpen, subtext: "Tài liệu & đề tài" },
    { title: "Kỹ năng rèn luyện", value: stats.skills_mastered ?? 0, icon: Award, subtext: "Năng lực cốt lõi" },
    { title: "Đóng góp cộng đồng", value: stats.community_contributions ?? 0, icon: Users, subtext: "Bài viết & trao đổi" },
    { title: "Chứng chỉ đạt được", value: stats.certificates_earned ?? 0, icon: ShieldCheck, subtext: "Chứng nhận STEM/AI" },
  ];

  // Natural date stamp in Vietnamese
  const todayDateStr = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-8">
      {/* ===== HERO SECTION — ORVEL EDITORIAL STYLE ===== */}
      <section className="relative overflow-hidden rounded-[22px] border border-border/80 bg-card p-6 sm:p-8 shadow-orvel flex flex-col md:flex-row md:items-end justify-between gap-6">
        <InteractiveGridPattern className="opacity-35 [mask-image:radial-gradient(450px_circle_at_top_right,white,transparent)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>{todayDateStr}</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Chào buổi sáng, {user.fullName || "bạn"}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-2xl">
            EduMap đã sẵn sàng hỗ trợ lộ trình học tập hôm nay. Bạn có các đề xuất không gian học tập mới và cơ hội thực tập tại khu vực Biên Hòa.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/map"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <MapPin className="h-4 w-4" /> Khám phá bản đồ
          </Link>
          <Link
            href="/career"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <Compass className="h-4 w-4" /> Việc làm & Lộ trình
          </Link>
        </div>
      </section>

      {/* ===== ACCOUNT IDENTITY & ORVEL SETTINGS/COMPANY 2-COLUMN LAYOUT ===== */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
        {/* Left Column: Account Details Form & Management (7 cols on XL) */}
        <div className="xl:col-span-7 2xl:col-span-8 space-y-6">
          <div className="rounded-[22px] border border-border/80 bg-card p-6 sm:p-8 shadow-orvel space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={user.avatar_url || avatarFallback(user.fullName)}
                    onError={onImageError(avatarFallback(user.fullName))}
                    alt={user.fullName}
                    className="h-16 w-16 shrink-0 rounded-2xl border-2 border-primary/20 object-cover shadow-sm"
                  />
                  <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card bg-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">{user.fullName || "Người dùng EduMap"}</h2>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      ● Đang hoạt động
                    </span>
                    {user.role && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary border border-primary/20">
                        <ShieldCheck className="h-3 w-3" /> {user.role}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/profile"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3.5 text-xs font-semibold text-foreground transition-all hover:bg-secondary"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Hồ sơ
                </Link>
                <Link
                  href="/profile#doi-mat-khau"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3.5 text-xs font-semibold text-foreground transition-all hover:bg-secondary"
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" /> Đổi mật khẩu
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3.5 text-xs font-semibold text-destructive transition-all hover:bg-destructive/10"
                >
                  <LogOut className="h-3.5 w-3.5" /> Đăng xuất
                </button>
              </div>
            </div>

            {/* Profile Detail Fields Matrix (Inspired by Orvel company settings) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-border/60 bg-secondary/30 p-3.5 space-y-1">
                <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Khu vực học tập</span>
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" /> TP. Biên Hòa, Tỉnh Đồng Nai
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 p-3.5 space-y-1">
                <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Mã định danh EduPass</span>
                <p className="text-sm font-mono font-bold text-foreground">
                  EDM-{user.id ? String(user.id).slice(0, 8).toUpperCase() : 'VN-DNTU-2026'}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 p-3.5 space-y-1">
                <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Cơ sở đào tạo chính</span>
                <p className="text-sm font-semibold text-foreground">Đại học Đồng Nai / DNTU Ecosystem</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-secondary/30 p-3.5 space-y-1">
                <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Mục tiêu phát triển</span>
                <p className="text-sm font-semibold text-foreground">Công nghệ số, STEM & AI Định hướng</p>
              </div>
            </div>
          </div>

          {/* Personal Hub Inside Left Main Stream */}
          <PersonalHub />
        </div>

        {/* Right Column: Orvel 'On every invoice' Live Preview Card & Quick Metrics (5 cols on XL) */}
        <div className="xl:col-span-5 2xl:col-span-4 space-y-6">
          {/* Live Learning Pass / Badge Preview Card (Inspired by Orvel company invoice preview) */}
          <div className="rounded-[22px] border border-border/80 bg-card p-6 shadow-orvel space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Thẻ thông hành học tập</span>
                <h3 className="text-sm font-bold text-foreground">EduMap Digital Pass</h3>
              </div>
              <span className="rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2 py-0.5">
                Đã xác thực
              </span>
            </div>

            {/* Visual Pass Rendering */}
            <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-secondary/80 via-card to-secondary/50 p-5 shadow-xs relative overflow-hidden">
              <InteractiveGridPattern className="opacity-30 [mask-image:radial-gradient(200px_circle_at_center,white,transparent)]" />
              <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-primary/5 pointer-events-none" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                    ED
                  </div>
                  <span className="text-xs font-bold tracking-tight text-foreground">EduMap Biên Hòa</span>
                </div>
                <div className="h-5 w-8 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[9px] font-mono font-bold text-amber-700 dark:text-amber-300">
                  CHIP
                </div>
              </div>

              <div className="space-y-1.5 my-3">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Chủ thẻ học tập</p>
                <p className="text-base font-extrabold text-foreground tracking-tight">{user.fullName || "Học viên EduMap"}</p>
                <p className="text-xs font-mono text-muted-foreground">ID: EDM-8849-2026-VN</p>
              </div>

              <div className="pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Khu vực: Biên Hòa</span>
                <span className="text-emerald-600 font-bold">● Hợp lệ</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Thẻ học tập số hóa đồng bộ tự động với các điểm WiFi công cộng, thư viện và trung tâm STEM liên kết trong hệ sinh thái EduMap.
            </p>
          </div>

          {/* Quick Stats Matrix */}
          <div className="rounded-[22px] border border-border/80 bg-card p-6 shadow-orvel">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Chỉ số tổng quan
              </span>
              <span className="text-xs font-semibold text-primary flex items-center gap-1">
                Cập nhật tức thì <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {STAT_CARDS.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.title}
                    className="rounded-xl border border-border/60 bg-secondary/40 p-3.5 transition-all hover:bg-secondary/70"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{s.title}</span>
                      <div className="h-7 w-7 rounded-lg bg-card flex items-center justify-center text-primary shadow-xs">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <p className="mt-2 text-2xl font-black tracking-tight text-foreground font-mono">
                      {s.value}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/75 truncate">
                      {s.subtext}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      {/* ===== MENTORING TIMELINE + AI INSIGHT ===== */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Mentoring Schedule Card */}
        <div className="rounded-[22px] border border-border/80 bg-card p-6 shadow-orvel flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Lịch Mentoring sắp tới</h2>
                  <p className="text-xs text-muted-foreground">Các phiên tư vấn định hướng 1-1</p>
                </div>
              </div>
              <Link
                href="/mentor"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
              >
                Đặt lịch mới <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {mentoring.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-secondary/20 p-6 text-center">
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-medium text-muted-foreground">Chưa có lịch mentoring nào sắp tới.</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Kết nối với chuyên gia giáo dục và cựu sinh viên tại Biên Hòa.
                </p>
                <Link
                  href="/mentor"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                  Tìm Mentor phù hợp
                </Link>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {mentoring.map((m: any) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/40 p-3.5 transition-colors hover:bg-secondary/70"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-card flex flex-col items-center justify-center border border-border/60 text-center">
                        <span className="text-[10px] font-bold uppercase text-primary">Buổi</span>
                        <span className="text-xs font-extrabold text-foreground">1:1</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{m.mentor_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {new Date(m.start).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    </div>

                    {m.meeting_url && (
                      <Link
                        href={m.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                      >
                        Tham gia
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* AI Insight Card */}
        <div className="rounded-[22px] border border-border/80 bg-card p-6 shadow-orvel flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">AI Insight hôm nay</h2>
                  <p className="text-xs text-muted-foreground">Gợi ý lộ trình cá nhân hóa</p>
                </div>
              </div>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-500/20">
                AI Agent
              </span>
            </div>

            {insight?.motivation_message || insight?.suggested_action ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                {insight.motivation_message && (
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {insight.motivation_message}
                  </p>
                )}
                {insight.suggested_action && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {insight.suggested_action}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/80 bg-secondary/20 p-6 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  Hệ thống đang tổng hợp dữ liệu học tập của bạn.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Thực hiện thêm bài khảo sát hoặc tìm kiếm cơ sở giáo dục để nhận gợi ý chuẩn xác.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Cập nhật tự động mỗi 24 giờ</span>
            <Link href="/map" className="font-semibold text-primary hover:underline">
              Bắt đầu khảo sát →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== PERSONAL HUB — ACTIVITY, STORAGE, CERTIFICATES, NOTIFICATIONS ===== */}
      
    </main>
  );
}
