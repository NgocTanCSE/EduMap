"use client";

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
} from "lucide-react";
import { useAuth } from "@/src/contexts/AuthContext";
import { dashboardService } from "@/reporting/services/dashboard.service";
import { PersonalHub } from "@/components/dashboard/PersonalHub";
import { avatarFallback, onImageError } from "@/src/lib/illustrations";

/**
 * Dashboard — the user's home hub inside the unified left-sidebar shell.
 *
 * The page is intentionally organised as a compact overview:
 *  1. Account card + quick stats side by side (identity + progress at a glance).
 *  2. Engagement recap: upcoming mentoring slots + today's AI insight.
 *  3. "Cá nhân" hub: saved items, registration/application history, storage,
 *     certificates and notifications — the old /dashboard/saved, /storage,
 *     /certificates and /notifications pages now live here as tabs.
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
        // allSettled so a failing insight/overview can't wipe the whole page.
        const [ov, ins] = await Promise.allSettled([
          dashboardService.getOverview(),
          dashboardService.getDailyInsight(),
        ]);
        if (!cancelled) {
          if (ov.status === "fulfilled") setOverview(ov.value);
          if (ins.status === "fulfilled") setInsight(ins.value);
        }
      } catch {
        // overview/insight are non-critical; account info still renders.
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

  // Not authenticated — show a real surface (login CTA) instead of a blank page.
  if (!isLoggedIn || !user) {
    return (
      <main className="w-full min-h-full px-6 py-10 md:px-8">
        <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <User className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h1 className="mt-4 text-2xl font-semibold">Chào bạn!</h1>
          <p className="mt-2 text-sm text-muted-foreground/70">
            Đăng nhập để quản lý tài khoản, xem thống kê và hoạt động của bạn
            trên EduMap. Các tính năng chính (Bản đồ, Thư viện, Sự kiện, Nghề
            nghiệp...) đều có sẵn ở thanh bên trái.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <User className="h-4 w-4" /> Đăng nhập
          </Link>
        </div>
      </main>
    );
  }

  const stats = overview?.stats ?? {};
  const mentoring = Array.isArray(overview?.upcoming_mentoring)
    ? overview.upcoming_mentoring
    : [];

  const STAT_CARDS = [
    { title: "Học liệu", value: stats.learning_materials ?? 0, icon: BookOpen },
    { title: "Kỹ năng", value: stats.skills_mastered ?? 0, icon: Award },
    { title: "Cộng đồng", value: stats.community_contributions ?? 0, icon: Users },
    { title: "Chứng chỉ", value: stats.certificates_earned ?? 0, icon: ShieldCheck },
  ];

  return (
    <main className="w-full min-h-full px-6 py-8 md:px-8 space-y-6">
      {/* ===== Account + quick stats ===== */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm xl:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <img
              src={user.avatar_url || avatarFallback(user.fullName)}
              onError={onImageError(avatarFallback(user.fullName))}
              alt={user.fullName}
              className="h-16 w-16 shrink-0 rounded-full border-2 border-border object-cover"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold leading-tight">
                Chào, {user.fullName || "bạn"}!
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground/70">
                {user.email}
              </p>
              {user.role && (
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                  <ShieldCheck className="h-3 w-3" /> {user.role}
                </span>
              )}
            </div>
          </div>

          {/* Quick account-management actions */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/profile"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              <User className="h-3.5 w-3.5" /> Hồ sơ & bảo mật
            </Link>
            <Link
              href="/profile#doi-mat-khau"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Settings className="h-3.5 w-3.5" /> Đổi mật khẩu
            </Link>
            <button
              type="button"
              onClick={() => {
                window.location.hash = "#da-luu";
                document.getElementById("ca-nhan")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Heart className="h-3.5 w-3.5 text-primary/70" /> Mục đã lưu
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5" /> Đăng xuất
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/65">
            Thống kê nhanh
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {STAT_CARDS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.title}
                  className="rounded-lg border border-border bg-background/40 p-4 text-center"
                >
                  <div className="mb-1 flex justify-center text-primary/70">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-semibold text-primary">{s.value}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/65">
                    {s.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Mentoring + AI insight ===== */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            Lịch mentoring sắp tới
          </h2>
          {mentoring.length === 0 ? (
            <p className="text-sm text-muted-foreground/65">
              Chưa có lịch mentoring nào.
            </p>
          ) : (
            <ul className="space-y-3">
              {mentoring.map((m: any) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-3"
                >
                  <div>
                    <p className="font-semibold">{m.mentor_name}</p>
                    <small className="text-xs text-muted-foreground/60">
                      {new Date(m.start).toLocaleString("vi-VN")}
                    </small>
                  </div>
                  {m.meeting_url && (
                    <Link
                      href={m.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Tham gia
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            AI Insight hôm nay
          </h2>
          {insight?.motivation_message || insight?.suggested_action ? (
            <div className="rounded-lg border border-border bg-background/40 p-4">
              <p className="mb-1 font-semibold text-primary">
                {insight.motivation_message}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground/70">
                {insight.suggested_action}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/65">
              Chưa có gợi ý nào hôm nay.
            </p>
          )}
        </section>
      </div>

      {/* ===== Cá nhân: hoạt động, lưu trữ, chứng chỉ, thông báo ===== */}
      <PersonalHub />
    </main>
  );
}
