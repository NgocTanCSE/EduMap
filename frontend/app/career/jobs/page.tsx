"use client";
import React, { useState, useEffect } from 'react';
import { careerService } from '@/src/services/career.service';
import { Search, MapPin, Briefcase, Building2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { CardSkeleton } from '../../../src/components/ui/Skeleton';
import { jobIllustration } from '@/src/lib/illustrations';
import { BookmarkButton } from '@/components/ui/BookmarkButton';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    location: '',
    job_type: '',
  });

  const fetchJobs = async (params = searchParams) => {
    try {
      setLoading(true);
      const data = await careerService.searchJobs(params);
      // Unwrap backend { success, data: { jobs: [...] } } wrapper if present
      const payload = data.data ?? data;
      setJobs(payload.jobs || []);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Deep-link from /analytics/trends: /career/jobs?skill=docker
    const urlParams = new URLSearchParams(window.location.search);
    const skill = urlParams.get('skill') || urlParams.get('keyword') || '';
    const initial = skill ? { ...searchParams, keyword: skill } : searchParams;
    if (skill) setSearchParams(initial);
    fetchJobs(initial);
    // Only on mount — the search form triggers later requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="w-full mx-auto space-y-8">
        <header className="space-y-4">
          <h1 className="text-2xl font-bold text-primary">
            Career Opportunities
          </h1>
          <p className="text-muted-foreground/40">Discover jobs and courses tailored to your professional growth.</p>
        </header>

        {/* Search & Filter Bar */}
        <form onSubmit={handleSearch} className="bg-card/50 p-4 rounded-lg border border-border flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input 
              type="text" 
              placeholder="Job title, keywords, or company" 
              className="w-full bg-card/40 border border-border rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
              value={searchParams.keyword}
              onChange={e => setSearchParams({...searchParams, keyword: e.target.value})}
            />
          </div>
          <div className="min-w-[150px] relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input 
              type="text" 
              placeholder="Location" 
              className="w-full bg-card/40 border border-border rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
              value={searchParams.location}
              onChange={e => setSearchParams({...searchParams, location: e.target.value})}
            />
          </div>
          <button type="submit" className="bg-primary hover:bg-yellow-700 px-8 py-3 rounded-xl font-bold transition-all shadow-lg">
            Find Opportunities
          </button>
        </form>

        {/* Job List */}
        <div className="space-y-4">
          {loading ? (
            <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
          ) : jobs.length > 0 ? (
            jobs.map(job => (
              <Link key={job.id} href={`/career/jobs/${job.id}`} className="block">
                <div className="relative bg-card border border-border p-6 rounded-lg flex justify-between items-center hover:border-primary/50 transition-all hover:bg-card/50 group">
                  <BookmarkButton targetType="job" targetId={job.id} size="sm" className="absolute top-3 right-3 z-20" />
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="hidden sm:block w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-border">
                      <img
                        src={jobIllustration(job.title, job.company_name)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-3 min-w-0">
                      <div className="flex items-center gap-2">
                          <span className="bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded border border-primary/20">
                              {String(job.job_type || 'full time').replace('_', ' ')}
                          </span>
                          <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{job.title}</h3>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground/40">
                        <div className="flex items-center gap-1">
                          <Building2 size={16} />
                          <span>{job.company_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin size={16} />
                          <span>{job.location}</span>
                        </div>
                        <div className="flex items-center gap-1 text-primary font-medium">
                          <Briefcase size={16} />
                          <span>{job.salary_range}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                          {job.required_skills?.slice(0, 3).map((skill: string) => (
                              <span key={skill} className="text-[10px] bg-card text-muted-foreground/40 px-2 py-1 rounded">
                                  {skill}
                              </span>
                          ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-muted-foreground group-hover:text-primary transition-all transform group-hover:translate-x-1">
                    <ChevronRight size={32} strokeWidth={1} />
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                Chưa có cơ hội nào phù hợp. Dữ liệu việc làm được cập nhật tự động mỗi ngày.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
