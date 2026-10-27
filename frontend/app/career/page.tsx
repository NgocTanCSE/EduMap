/**
 * Unified Career Hub — consolidates career/jobs/roadmap/predictive/opportunities/radar/analytics.
 *
 * Previously 6 separate sidebar items; now one page with tab navigation.
 * The dashboard renders inline; other tabs link to the sub-pages so each
 * retains its full layout. Old direct-access routes still work.
 */
"use client";
import React, { useState, useEffect } from 'react';
import {
  Rocket, Search, UserCircle, Sparkles, ChevronRight, Briefcase, Target,
  TrendingUp, BrainCircuit, Compass, BarChart3,
} from 'lucide-react';
import { careerService } from '@/src/services/career.service';
import { StatSkeleton, CardSkeleton } from '../../src/components/ui/Skeleton';

interface TabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

// Tab bar: dashboard is inline; the rest link to sub-pages
const CAREER_TABS: TabDef[] = [
  { id: "dashboard", label: "Tổng quan", icon: TrendingUp, href: "/career" },
  { id: "jobs", label: "Việc làm", icon: Briefcase, href: "/career/jobs" },
  { id: "roadmap", label: "Lộ trình", icon: Compass, href: "/career/roadmap" },
  { id: "predictive", label: "Dự báo AI", icon: BrainCircuit, href: "/career/predictive" },
  { id: "opportunities", label: "Cơ hội", icon: Rocket, href: "/opportunities" },
  { id: "radar", label: "Opportunity Radar", icon: Target, href: "/opportunities/radar" },
  { id: "analytics", label: "Thống kê", icon: BarChart3, href: "/analytics/trends" },
];

function CareerDashboard() {
  const [stats, setStats] = useState({
    skillsCount: 0,
    aspirationsCount: 0,
    applicationsCount: 0
  });
  const [latestJobs, setJobs] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [skills, careers, apps, jobData, suggestData] = await Promise.all([
        careerService.getUserSkills().catch(() => []),
        careerService.getUserCareers().catch(() => []),
        careerService.getUserApplications().catch(() => []),
        careerService.searchJobs({ limit: 3 }).catch(() => ({ jobs: [] })),
        careerService.getCareerSuggestions().catch(() => ({ top_suggestions: [] }))
      ]);

      setStats({
        skillsCount: skills.length,
        aspirationsCount: careers.length,
        applicationsCount: apps.length
      });
      setJobs(jobData.jobs || []);
      setSuggestions(suggestData.top_suggestions || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-12">
      {/* Hero Section */}
      <section className="bg-card p-6 rounded-lg border border-border">
        <div className="space-y-5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Khởi động <span className="text-primary">lộ trình nghề nghiệp</span> của bạn
          </h1>
          <div className="flex flex-wrap gap-4 pt-4">
            <a href="/career/jobs" className="bg-card text-foreground px-8 py-4 rounded-lg font-semibold flex items-center gap-2 hover:bg-muted transition-all">
              <Search size={20} /> Tìm cơ hội
            </a>
            <a href="/career/roadmap" className="bg-card text-foreground border border-border px-8 py-4 rounded-lg font-semibold flex items-center gap-2 hover:bg-card/50 transition-all">
              <UserCircle size={20} /> Hồ sơ nghề nghiệp
            </a>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
        ) : [
          { label: 'Kỹ năng đã có', value: stats.skillsCount, color: 'text-primary/70', icon: Rocket },
          { label: 'Mục tiêu nghề nghiệp', value: stats.aspirationsCount, color: 'text-primary/70', icon: Target },
          { label: 'Hồ sơ đã nộp', value: stats.applicationsCount, color: 'text-primary', icon: Briefcase }
        ].map((stat, i) => (
          <div key={i} className="bg-card/50 border border-border p-8 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground font-bold text-sm uppercase tracking-widest">{stat.label}</p>
              <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
            </div>
            <stat.icon size={48} className="text-foreground" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* AI Suggestions */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="text-primary/70" />
            <h2>Lộ trình AI gợi ý</h2>
          </div>
          <div className="space-y-4">
            {loading ? (
              <><CardSkeleton /><CardSkeleton /></>
            ) : suggestions.length > 0 ? suggestions.map((s: any) => (
              <a key={s.career_id ?? s.title} href="/career/roadmap" className="block">
                <div className="bg-card border border-border p-5 rounded-lg flex items-center justify-between group hover:border-primary/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary/70 font-bold border border-primary/20 text-xs">
                      {s.match_score !== undefined ? `${s.match_score}%` : 'N/A'}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{s.title}</h3>
                      <p className="text-xs text-muted-foreground">{s.field}</p>
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground group-hover:text-primary/70 transition-colors" />
                </div>
              </a>
            )) : (
              <div className="bg-card/30 border border-dashed border-border p-10 rounded-lg text-center">
                <p className="text-muted-foreground italic">Chưa có gợi ý. Cập nhật hồ sơ để AI đề xuất lộ trình phù hợp.</p>
              </div>
            )}
          </div>
        </section>

        {/* Latest Jobs */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <TrendingUp className="text-primary/70" />
            <h2>Cơ hội mới nhất</h2>
          </div>
          <div className="space-y-4">
            {loading ? (
              <><CardSkeleton /><CardSkeleton /></>
            ) : latestJobs.length > 0 ? latestJobs.map((job: any) => (
              <a key={job.id} href={`/career/jobs/${job.id}`} className="block">
                <div className="bg-card border border-border p-5 rounded-lg flex items-center justify-between group hover:border-primary/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <Briefcase size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{job.title}</h3>
                      <p className="text-xs text-muted-foreground">{job.company_name} • {job.location}</p>
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground group-hover:text-primary/70 transition-colors" />
                </div>
              </a>
            )) : (
              <div className="bg-card/30 border border-dashed border-border p-10 rounded-lg text-center">
                <p className="text-muted-foreground italic">Hiện chưa có tin tuyển dụng mới.</p>
              </div>
            )}
            <a href="/career/jobs" className="text-muted-foreground/60 hover:text-foreground text-sm font-bold flex items-center gap-1 justify-center pt-2">
              Xem tất cả cơ hội <ChevronRight size={16} />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function CareerPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // Read tab from URL on mount (for deep links like /career?tab=jobs)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && CAREER_TABS.some(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, []);

  const handleTabChange = (tabId: string) => {
    const tab = CAREER_TABS.find(t => t.id === tabId);
    if (!tab) return;
    // For dashboard: update URL in-place
    if (tabId === "dashboard") {
      setActiveTab(tabId);
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url);
    } else {
      // For other tabs: navigate to the sub-page
      window.location.href = tab.href;
    }
  };

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] w-full bg-background overflow-hidden lg:min-h-screen flex flex-col">
      {/* Tab bar */}
      <div className="border-b border-border bg-card overflow-x-auto">
        <div className="flex flex-wrap gap-1.5 p-3">
          {CAREER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground/60 hover:bg-muted/50"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="page-shell">
          {activeTab === "dashboard" ? <CareerDashboard /> : null}
        </div>
      </div>
    </div>
  );
}
