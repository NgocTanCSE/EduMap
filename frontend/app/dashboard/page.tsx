"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { dashboardService } from '@/src/services/dashboard.service';
import { authService } from '@/src/services/auth.service';

export default function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [insight, setInsight] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authService.isLoggedIn()) {
      window.location.href = '/auth/login';
      return;
    }
    
    async function load() {
      try {
        const user = authService.getUser();
        if (!user?.id) return;
        
        const [ov, ins] = await Promise.all([
          dashboardService.getOverview(),
          dashboardService.getDailyInsight()
        ]);
        setOverview(ov);
        setInsight(ins);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-8 text-center">ƒêang t·∫£i Dashboard‚Ä¶</div>;
  const user = overview?.user ?? {};
  const stats = overview?.stats ?? {};
  const mentoring = overview?.upcoming_mentoring ?? [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin mx-auto" />
          <p className="text-foreground/60 text-sm font-medium animate-pulse">–ang t?i Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-12">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Welcome Section */}
        <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-yellow-500/10 via-background to-background border border-white/10 p-8 shadow-2xl">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 ring-4 ring-yellow-500/30">
              {user.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={user.full_name} />
              ) : (
                <AvatarFallback className="text-2xl font-black bg-yellow-500/20 text-yellow-500">{user.full_name?.[0] ?? "?"}</AvatarFallback>
              )}
            </Avatar>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Ch‡o {user.full_name ?? "B?n"}!</h1>
              <p className="text-sm text-foreground/60 mt-1">Vai tr?: {user.role ?? "N/A"} ∑ HÙm nay l‡ m?t ng‡y tuy?t v?i ? h?c t?p</p>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: "H?c li?u", value: stats.learning_materials ?? 0, icon: "BookOpen", color: "from-violet-500/20 to-violet-500/5 border-violet-500/20", accent: "text-violet-400" },
            { title: "K? n„ng", value: stats.skills_mastered ?? 0, icon: "Award", color: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/20", accent: "text-yellow-400" },
            { title: "C?ng ?ng", value: stats.community_contributions ?? 0, icon: "Users", color: "from-pink-500/20 to-pink-500/5 border-pink-500/20", accent: "text-pink-400" },
            { title: "Ch?ng ch?", value: stats.certificates_earned ?? 0, icon: "ShieldCheck", color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20", accent: "text-emerald-400" },
          ].map((item) => (
            <div key={item.title} className={`relative overflow-hidden rounded-[2rem] border bg-gradient-to-br ${item.color} p-6 shadow-lg transition-transform hover:-translate-y-1`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-foreground/50">{item.title}</p>
              <p className={`text-3xl font-black mt-2 ${item.accent}`}>{item.value}</p>
            </div>
          ))}
        </section>

        {/* Upcoming Mentoring */}
        <section className="rounded-[2.5rem] border border-white/10 bg-black/20 p-6 shadow-xl">
          <h2 className="text-lg font-black tracking-tight mb-4">L?ch Mentoring s?p t?i</h2>
          {mentoring.length === 0 ? (
            <p className="text-foreground/50 text-sm">KhÙng cÛ l?ch h?n mentoring n‡o.</p>
          ) : (
            <div className="space-y-3">
              {mentoring.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div>
                    <p className="font-bold">{m.mentor_name}</p>
                    <small className="text-xs text-foreground/50">{new Date(m.start).toLocaleString()}</small>
                  </div>
                  {m.meeting_url && (
                    <a href={m.meeting_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-yellow-500 hover:underline">Tham gia</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Daily Insight */}
        <section className="rounded-[2.5rem] border border-white/10 bg-black/20 p-6 shadow-xl">
          <h2 className="text-lg font-black tracking-tight mb-4">AI Daily Insight</h2>
          {insight ? (
            <div className="rounded-2xl border border-white/5 bg-white/5 p-5">
              <p className="text-sm font-bold text-yellow-500 mb-2">{insight.motivation_message}</p>
              <p className="text-sm text-foreground/70 leading-relaxed">{insight.suggested_action}</p>
            </div>
          ) : (
            <p className="text-foreground/50 text-sm">KhÙng cÛ g?i ? hÙm nay.</p>
          )}
        </section>
      </div>
    </main>

);


}
