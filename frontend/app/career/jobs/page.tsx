"use client";
import React, { useState, useEffect } from 'react';
import { careerService } from '@/src/services/career.service';
import { Search, MapPin, Briefcase, Building2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { CardSkeleton } from '../../../src/components/ui/Skeleton';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    location: '',
    job_type: '',
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await careerService.searchJobs(searchParams);
      setJobs(data.jobs || []);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold text-primary">
            Career Opportunities
          </h1>
          <p className="text-muted-foreground/40">Discover jobs and courses tailored to your professional growth.</p>
        </header>

        {/* Search & Filter Bar */}
        <form onSubmit={handleSearch} className="bg-card/50 p-4 rounded-2xl border border-border flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Job title, keywords, or company" 
              className="w-full bg-card/40 border border-border rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
              value={searchParams.keyword}
              onChange={e => setSearchParams({...searchParams, keyword: e.target.value})}
            />
          </div>
          <div className="min-w-[150px] relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Location" 
              className="w-full bg-card/40 border border-border rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
              value={searchParams.location}
              onChange={e => setSearchParams({...searchParams, location: e.target.value})}
            />
          </div>
          <button type="submit" className="bg-primary hover:bg-yellow-700 px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/20">
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
                <div className="bg-card border border-border p-6 rounded-2xl flex justify-between items-center hover:border-primary/50 transition-all hover:bg-zinc-800/50 group">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-primary/20">
                            {job.job_type.replace('_', ' ')}
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
                      <div className="flex items-center gap-1 text-green-400 font-medium">
                        <Briefcase size={16} />
                        <span>{job.salary_range}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        {job.required_skills?.slice(0, 3).map((skill: string) => (
                            <span key={skill} className="text-[10px] bg-zinc-800 text-muted-foreground/40 px-2 py-1 rounded">
                                {skill}
                            </span>
                        ))}
                    </div>
                  </div>
                  
                  <div className="text-gray-500 group-hover:text-primary transition-all transform group-hover:translate-x-1">
                    <ChevronRight size={32} strokeWidth={1} />
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-20 text-gray-500 border border-dashed border-border rounded-3xl">
                No opportunities found matching your criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
