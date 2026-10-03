"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { careerService } from '@/src/services/career.service';
import { authService } from '@/src/services/auth.service';
import { 
  Rocket, 
  Search, 
  UserCircle, 
  Sparkles, 
  ChevronRight, 
  Briefcase, 
  Target,
  TrendingUp 
} from 'lucide-react';
import { StatSkeleton, CardSkeleton } from '../../src/components/ui/Skeleton';

export default function CareerDashboardPage() {
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
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-card p-12 rounded-2xl border border-border">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[100px] -mr-20 -mt-20" />
          <div className="relative z-10 space-y-6">
            <h1 className="text-5xl font-black tracking-tight">
              Ignite Your <span className="text-primary">Professional Journey</span>
            </h1>
            <p className="text-muted-foreground/40 text-xl max-w-2xl">
              EduMap Career is your AI-powered companion for navigating the evolving landscape of skills and opportunities.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/career/jobs" className="bg-white text-black px-8 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-muted transition-all">
                <Search size={20} /> Find Opportunities
              </Link>
              <Link href="/career/profile" className="bg-zinc-800 text-white border border-border px-8 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-zinc-700 transition-all">
                <UserCircle size={20} /> My Career Profile
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
              <><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
          ) : [
            { label: 'Skills Mastered', value: stats.skillsCount, color: 'text-primary/70', icon: Rocket },
            { label: 'Career Goals', value: stats.aspirationsCount, color: 'text-primary/70', icon: Target },
            { label: 'Applications', value: stats.applicationsCount, color: 'text-blue-400', icon: Briefcase }
          ].map((stat, i) => (
            <div key={i} className="bg-card/50 border border-border p-8 rounded-3xl flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">{stat.label}</p>
                <p className={`text-4xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
              <stat.icon size={48} className="text-gray-800" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* AI Suggestions */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-2xl font-bold">
              <Sparkles className="text-primary/70" />
              <h2>AI Recommended Paths</h2>
            </div>
            <div className="space-y-4">
              {loading ? (
                  <><CardSkeleton /><CardSkeleton /></>
              ) : suggestions.length > 0 ? suggestions.map((s: any) => (
                <Link key={s.career_id} href={`/career/roadmap/${s.career_id}`} className="block">
                    <div className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between group hover:border-primary/50 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary/70 font-bold border border-primary/20 text-xs">
                                {s.match_rate}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-100">{s.career_title}</h3>
                                <p className="text-xs text-gray-500">{s.field}</p>
                            </div>
                        </div>
                        <ChevronRight className="text-gray-700 group-hover:text-primary/70 transition-colors" />
                    </div>
                </Link>
              )) : (
                <div className="bg-card/30 border border-dashed border-border p-10 rounded-2xl text-center">
                    <p className="text-gray-500 italic">No suggestions yet. Update your profile to see AI recommendations.</p>
                </div>
              )}
            </div>
          </section>

          {/* Latest Jobs */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-2xl font-bold">
              <TrendingUp className="text-primary/70" />
              <h2>Newest Opportunities</h2>
            </div>
            <div className="space-y-4">
              {loading ? (
                  <><CardSkeleton /><CardSkeleton /></>
              ) : latestJobs.length > 0 ? latestJobs.map((job: any) => (
                <Link key={job.id} href={`/career/jobs/${job.id}`} className="block">
                    <div className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between group hover:border-primary/50 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                <Briefcase size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-100">{job.title}</h3>
                                <p className="text-xs text-gray-500">{job.company_name} • {job.location}</p>
                            </div>
                        </div>
                        <ChevronRight className="text-gray-700 group-hover:text-primary/70 transition-colors" />
                    </div>
                </Link>
              )) : (
                <div className="bg-card/30 border border-dashed border-border p-10 rounded-2xl text-center">
                    <p className="text-gray-500 italic">No new jobs available at the moment.</p>
                </div>
              )}
              <Link href="/career/jobs" className="text-muted-foreground/40 hover:text-white text-sm font-bold flex items-center gap-1 justify-center pt-2">
                  View all opportunities <ChevronRight size={16} />
              </Link>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}
