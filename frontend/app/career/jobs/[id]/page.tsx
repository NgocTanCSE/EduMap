"use client";
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { careerService } from '@/src/services/career.service';
import { 
  Building2, 
  MapPin, 
  Briefcase, 
  Calendar, 
  ArrowLeft, 
  Send, 
  FileUp,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BookmarkButton } from '@/components/ui/BookmarkButton';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  
  // Application form state
  const [coverLetter, setCoverLetter] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchJobDetails();
    }
  }, [params.id]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const data = await careerService.getJobById(params.id as string);
      setJob(data?.data ?? data);
    } catch (err) {
      console.error('Error fetching job details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setApplying(true);
      
      let resume_url = '';
      if (cvFile) {
        // 1. Upload CV file
        const formData = new FormData();
        formData.append('file', cvFile);
        
        const uploadRes = await fetch('/api/career/upload-resume', {
            method: 'POST',
            body: formData,
        });
        const uploadData = await uploadRes.json();
        resume_url = uploadData.url;
      }

      // 2. Submit application
      await careerService.applyToJob({
        job_id: job.id,
        cover_letter: coverLetter,
        resume_url: resume_url
      });

      setApplied(true);
      toast.success('Application submitted successfully!');
    } catch (err) {
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="text-foreground text-center mt-20">Loading opportunity details...</div>;
  if (!job) return <div className="text-foreground text-center mt-20">Opportunity not found.</div>;

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-6 sm:px-6 sm:py-8">
      <div className="w-full mx-auto space-y-8">
        
        <Link href="/career/jobs" className="flex items-center gap-2 text-muted-foreground/60 hover:text-foreground transition-colors mb-4">
            <ArrowLeft size={16} /> Back to Search
        </Link>

        <header className="bg-card border border-border p-8 rounded-xl space-y-6">
            <div className="flex justify-between items-start gap-4">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full border border-primary/20">
                            {job.job_type.replace('_', ' ')}
                        </span>
                    </div>
                    <h1 className="text-2xl font-semibold">{job.title}</h1>
                    <div className="flex flex-wrap gap-6 text-muted-foreground/60">
                        <div className="flex items-center gap-2">
                            <Building2 size={20} className="text-primary" />
                            <span className="font-bold text-muted-foreground/70">{job.company_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin size={20} className="text-primary" />
                            <span>{job.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Briefcase size={20} className="text-primary" />
                            <span className="text-primary font-bold">{job.salary_range}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                  <BookmarkButton targetType="job" targetId={job.id} size="sm" />
                  {job.views > 0 && (
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Views</p>
                        <p className="text-2xl font-semibold text-foreground">{job.views}</p>
                    </div>
                  )}
                </div>
            </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
                <section className="bg-card/50 border border-border p-8 rounded-xl space-y-4">
                    <h2 className="text-xl font-bold border-b border-border pb-2">Description</h2>
                    <p className="text-muted-foreground/60 leading-relaxed whitespace-pre-wrap">{job.description}</p>
                </section>

                <section className="bg-card/50 border border-border p-8 rounded-xl space-y-4">
                    <h2 className="text-xl font-bold border-b border-border pb-2">Kỹ năng yêu cầu</h2>
                    <div className="flex flex-wrap gap-3">
                        {job.required_skills?.map((skill: string) => (
                            <span key={skill} className="bg-card text-foreground px-4 py-2 rounded-xl border border-border font-medium">
                                {skill}
                            </span>
                        ))}
                    </div>
                </section>
            </div>

            <div className="space-y-6">
                {!applied ? (
                    <aside className="bg-card border border-border p-6 rounded-xl space-y-6 sticky top-8">
                        <h2 className="text-2xl font-semibold text-center">Ready to apply?</h2>
                        <form onSubmit={handleApply} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cover Letter (Optional)</label>
                                <textarea 
                                    placeholder="Introduce yourself briefly..."
                                    className="w-full bg-card/40 border border-border rounded-xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[120px]"
                                    value={coverLetter}
                                    onChange={e => setCoverLetter(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Upload CV (PDF)</label>
                                <div className="relative group">
                                    <input 
                                        type="file" 
                                        accept=".pdf"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        onChange={e => setCvFile(e.target.files?.[0] || null)}
                                    />
                                    <div className="bg-card/40 border border-dashed border-border rounded-xl p-4 flex flex-col items-center gap-2 group-hover:border-primary/50 transition-all">
                                        <FileUp className="text-muted-foreground group-hover:text-primary" />
                                        <span className="text-xs text-muted-foreground/60">
                                            {cvFile ? cvFile.name : "Select your CV file"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={applying}
                                className="w-full bg-primary hover:bg-primary py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                            >
                                {applying ? "Submitting..." : <><Send size={18} /> Send Application</>}
                            </button>
                        </form>
                    </aside>
                ) : (
                    <aside className="bg-primary/10 border border-accent/30 p-8 rounded-xl space-y-4 text-center">
                        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={32} className="text-foreground" />
                        </div>
                        <h2 className="text-2xl font-semibold text-primary">Applied Successfully!</h2>
                        <p className="text-muted-foreground/60 text-sm">Your application has been sent to {job.company_name}. You can track its status in your dashboard.</p>
                        <Link href="/career/jobs" className="block w-full bg-card py-3 rounded-xl font-bold mt-4">
                            Back to Search
                        </Link>
                    </aside>
                )}
                
                <div className="bg-card/30 border border-border p-6 rounded-lg space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Mô tả công việc</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
                        <Calendar size={16} />
                        <span>Posted on {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'N/A'}</span>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
