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
      setJob(data);
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

  if (loading) return <div className="text-white text-center mt-20">Loading opportunity details...</div>;
  if (!job) return <div className="text-white text-center mt-20">Opportunity not found.</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <Link href="/career/jobs" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4">
            <ArrowLeft size={16} /> Back to Search
        </Link>

        <header className="bg-zinc-900 border border-white/10 p-8 rounded-3xl space-y-6">
            <div className="flex justify-between items-start gap-4">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-yellow-500/10 text-yellow-500 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-yellow-500/20">
                            {job.job_type.replace('_', ' ')}
                        </span>
                    </div>
                    <h1 className="text-4xl font-black">{job.title}</h1>
                    <div className="flex flex-wrap gap-6 text-gray-400">
                        <div className="flex items-center gap-2">
                            <Building2 size={20} className="text-yellow-500" />
                            <span className="font-bold text-gray-200">{job.company_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin size={20} className="text-blue-500" />
                            <span>{job.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Briefcase size={20} className="text-green-500" />
                            <span className="text-green-400 font-bold">{job.salary_range}</span>
                        </div>
                    </div>
                </div>
                {job.views > 0 && (
                    <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase font-black">Views</p>
                        <p className="text-2xl font-black text-white">{job.views}</p>
                    </div>
                )}
            </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
                <section className="bg-zinc-900/50 border border-white/5 p-8 rounded-3xl space-y-4">
                    <h2 className="text-xl font-bold border-b border-white/10 pb-2">Description</h2>
                    <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">{job.description}</p>
                </section>

                <section className="bg-zinc-900/50 border border-white/5 p-8 rounded-3xl space-y-4">
                    <h2 className="text-xl font-bold border-b border-white/10 pb-2">Required Skills</h2>
                    <div className="flex flex-wrap gap-3">
                        {job.required_skills?.map((skill: string) => (
                            <span key={skill} className="bg-zinc-800 text-gray-100 px-4 py-2 rounded-xl border border-white/5 font-medium">
                                {skill}
                            </span>
                        ))}
                    </div>
                </section>
            </div>

            <div className="space-y-6">
                {!applied ? (
                    <aside className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-6 rounded-3xl space-y-6 sticky top-8">
                        <h2 className="text-2xl font-black text-center">Ready to apply?</h2>
                        <form onSubmit={handleApply} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cover Letter (Optional)</label>
                                <textarea 
                                    placeholder="Introduce yourself briefly..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 min-h-[120px]"
                                    value={coverLetter}
                                    onChange={e => setCoverLetter(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Upload CV (PDF)</label>
                                <div className="relative group">
                                    <input 
                                        type="file" 
                                        accept=".pdf"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        onChange={e => setCvFile(e.target.files?.[0] || null)}
                                    />
                                    <div className="bg-black/40 border border-dashed border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 group-hover:border-yellow-500/50 transition-all">
                                        <FileUp className="text-gray-500 group-hover:text-yellow-500" />
                                        <span className="text-xs text-gray-400">
                                            {cvFile ? cvFile.name : "Select your CV file"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={applying}
                                className="w-full bg-yellow-600 hover:bg-yellow-700 py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-600/20 active:scale-[0.98] disabled:opacity-50"
                            >
                                {applying ? "Submitting..." : <><Send size={18} /> Send Application</>}
                            </button>
                        </form>
                    </aside>
                ) : (
                    <aside className="bg-green-500/10 border border-green-500/30 p-8 rounded-3xl space-y-4 text-center">
                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={32} className="text-black" />
                        </div>
                        <h2 className="text-2xl font-black text-green-400">Applied Successfully!</h2>
                        <p className="text-gray-400 text-sm">Your application has been sent to {job.company_name}. You can track its status in your dashboard.</p>
                        <Link href="/career/jobs" className="block w-full bg-zinc-800 py-3 rounded-xl font-bold mt-4">
                            Back to Search
                        </Link>
                    </aside>
                )}
                
                <div className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl space-y-2">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">About this role</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
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
