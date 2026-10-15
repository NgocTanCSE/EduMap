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
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="w-full mx-auto space-y-12">
        
        {/* Hero Section */}
        <section className="bg-card p-6 rounded-lg border border-border">
          <div className="space-y-5">
            <h1 className="text-2xl font-semibold tracking-tight">
              Ignite Your <span className="text-primary">Professional Journey</span>
            </h1>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/career/jobs" className="bg-card text-foreground px-8 py-4 rounded-lg font-semibold flex items-center gap-2 hover:bg-muted transition-all">
                <Search size={20} /> Find Opportunities
              </Link>
              <Link href="/career/profile" className="bg-card text-foreground border border-border px-8 py-4 rounded-lg font-semibold flex items-center gap-2 hover:bg-card/50 transition-all">
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
            { label: 'Applications', value: stats.applicationsCount, color: 'text-primary', icon: Briefcase }
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
              <h2>AI Recommended Paths</h2>
            </div>
            <div className="space-y-4">
              {loading ? (
                  <><CardSkeleton /><CardSkeleton /></>
              ) : suggestions.length > 0 ? suggestions.map((s: any) => (
                <Link key={s.career_id} href={`/career/roadmap/${s.career_id}`} className="block">
                    <div className="bg-card border border-border p-5 rounded-lg flex items-center justify-between group hover:border-primary/50 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary/70 font-bold border border-primary/20 text-xs">
                                {s.match_rate}
                            </div>
                            <div>
                                <h3 className="font-bold text-foreground">{s.career_title}</h3>
                                <p className="text-xs text-muted-foreground">{s.field}</p>
                            </div>
                        </div>
                        <ChevronRight className="text-muted-foreground group-hover:text-primary/70 transition-colors" />
                    </div>
                </Link>
              )) : (
                <div className="bg-card/30 border border-dashed border-border p-10 rounded-lg text-center">
                    <p className="text-muted-foreground italic">No suggestions yet. Update your profile to see AI recommendations.</p>
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
                </Link>
              )) : (
                <div className="bg-card/30 border border-dashed border-border p-10 rounded-lg text-center">
                    <p className="text-muted-foreground italic">No new jobs available at the moment.</p>
                </div>
              )}
              <Link href="/career/jobs" className="text-muted-foreground/40 hover:text-foreground text-sm font-bold flex items-center gap-1 justify-center pt-2">
                  View all opportunities <ChevronRight size={16} />
              </Link>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}
