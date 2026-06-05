"use client";
import React, { useEffect, useState } from 'react';
import { Search, Star, Calendar, Sparkles, MessageSquare, Video, Filter, UserCheck, ChevronRight, Clock, Award, BrainCircuit } from 'lucide-react';
import { mentorService } from '@/src/services/mentor.service';
import { authService } from '@/src/services/auth.service';
import { CardSkeleton } from '../../src/components/ui/Skeleton';
import { toast } from 'sonner';
import Link from 'next/link';

export default function MentorPage() {
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  
  // AI Matchmaking
  const [isAiMatching, setIsAiMatching] = useState(false);
  const [aiMatches, setAiMatches] = useState<any[]>([]);

  useEffect(() => {
    fetchMentors(activeCategory === 'Tất cả' ? undefined : activeCategory);
  }, [activeCategory]);

  const fetchMentors = async (specialty?: string) => {
    try {
      setLoading(true);
      const data = await mentorService.getMentors(specialty);
      setMentors(data || []);
    } catch (error) {
      console.error("Lỗi fetch mentors:", error);
      toast.error('Failed to load mentors');
    } finally {
      setLoading(false);
    }
  };

  const handleAiMatch = async () => {
    const user = authService.getUser();
    if (!user) {
        toast.error('Please log in to use AI Matchmaking');
        return;
    }
    
    try {
        setIsAiMatching(true);
        toast.info('Gemini AI is analyzing your profile...');
        const response = await mentorService.getRecommendations(user.id);
        
        if (response && response.top_matches) {
            setAiMatches(response.top_matches);
            toast.success('Found your perfect mentor matches!');
        } else {
            toast.error('No suitable matches found at this time.');
        }
    } catch (error) {
        toast.error('AI Matchmaking failed');
    } finally {
        setIsAiMatching(false);
    }
  };

  const filteredMentors = mentors.filter(m => 
    m.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.specialties?.some((s: string) => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header & AI Match */}
        <div className="bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-zinc-900 p-10 rounded-[3rem] border border-white/10 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 blur-[100px] -mr-20 -mt-20" />
            <div className="relative z-10 space-y-4 max-w-xl">
                <h1 className="text-4xl font-black">EduMap Mentor Hub</h1>
                <p className="text-gray-400">Connect with industry experts, get 1-on-1 guidance, and accelerate your career growth with personalized mentorship.</p>
                <div className="pt-4">
                    <button 
                        onClick={handleAiMatch}
                        disabled={isAiMatching}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all shadow-xl shadow-purple-500/20 active:scale-[0.98] disabled:opacity-50"
                    >
                        <BrainCircuit className={isAiMatching ? "animate-pulse" : ""} />
                        {isAiMatching ? 'Gemini AI is Matching...' : 'Find My Perfect Mentor with AI'}
                    </button>
                </div>
            </div>
            <div className="relative z-10 w-full max-w-sm">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                        type="text" 
                        placeholder="Search by name, role, or skills..." 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-purple-500 transition-colors text-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* AI Match Results */}
        {aiMatches.length > 0 && (
            <section className="space-y-6">
                <div className="flex items-center gap-2 text-2xl font-bold">
                    <Sparkles className="text-purple-400" />
                    <h2>Top AI Matches For You</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {aiMatches.map((match: any, idx: number) => {
                        const mentorData = mentors.find(m => m.user_id === match.mentor_id) || {};
                        return (
                            <div key={idx} className="bg-gradient-to-b from-purple-900/20 to-zinc-900 border border-purple-500/30 p-6 rounded-3xl relative overflow-hidden flex flex-col">
                                <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl z-10">
                                    {match.match_score}% Match
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 bg-zinc-800 rounded-full border-2 border-purple-500/50 flex items-center justify-center font-black text-xl text-purple-400 overflow-hidden shrink-0">
                                        {mentorData.user?.avatar_url ? (
                                            <img src={mentorData.user.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            match.name.charAt(0)
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg leading-tight line-clamp-1">{match.name}</h3>
                                        <p className="text-xs text-purple-400 line-clamp-1">{mentorData.specialties?.[0]}</p>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-6 flex-1">
                                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Why it's a match:</h4>
                                    <ul className="text-xs text-gray-300 space-y-1.5">
                                        {match.match_reasons?.map((r: string, i: number) => (
                                            <li key={i} className="flex items-start gap-1.5 leading-snug">
                                                <span className="text-purple-400 mt-0.5">•</span>
                                                <span>{r}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <Link href={`/mentor/${match.mentor_id}`} className="mt-auto block w-full bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30 py-3 rounded-xl font-bold text-center text-sm transition-all">
                                    View Profile & Book
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </section>
        )}

        {/* Filters */}
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar border-b border-white/5">
          {['Tất cả', 'Software Engineer', 'Data', 'Design', 'Marketing', 'Startup'].map(cat => (
            <button 
                key={cat} 
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2.5 rounded-xl border text-sm font-bold transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-white text-black border-white' : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:border-white/30'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Mentors Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredMentors.map(mentor => (
              <div key={mentor.user_id} className="p-6 rounded-3xl bg-zinc-900 border border-white/5 hover:border-white/20 hover:bg-zinc-800/50 transition-all group flex flex-col justify-between">
                <div>
                    <div className="flex gap-6 mb-6">
                    <div className="relative">
                        <img src={mentor.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(mentor.user?.full_name || 'M')}&background=random`} alt="" className="w-24 h-24 rounded-2xl object-cover border border-white/10" />
                        {mentor.is_verified && (
                        <div className="absolute -bottom-2 -right-2 p-1 bg-[#050505] rounded-full">
                            <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#050505]" />
                        </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                        <h3 className="text-xl font-bold group-hover:text-yellow-500 transition-colors">{mentor.user?.full_name || "Mentor EduMap"}</h3>
                        <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20 text-yellow-500">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            <span className="text-xs font-black">{mentor.rating_avg || 5.0}</span>
                        </div>
                        </div>
                        <p className="text-gray-400 text-sm mb-3 line-clamp-1">{mentor.bio || "EduMap Verified Mentor"}</p>
                        <div className="flex flex-wrap gap-2">
                        {mentor.specialties?.slice(0, 3).map((skill: string) => (
                            <span key={skill} className="px-2 py-1 rounded bg-black/40 border border-white/5 text-[10px] font-bold text-gray-300 uppercase tracking-widest">{skill}</span>
                        ))}
                        </div>
                    </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Link href={`/mentor/${mentor.user_id}`} className="py-3 rounded-xl bg-black/40 border border-white/10 text-xs font-bold hover:bg-black/60 transition-colors flex items-center justify-center gap-2">
                    <UserCheck className="w-4 h-4" /> Xem Hồ Sơ
                  </Link>
                  <Link href={`/mentor/${mentor.user_id}?action=book`} className="py-3 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-600/20 active:scale-[0.98]">
                    <Calendar className="w-4 h-4" /> Đặt Lịch
                  </Link>
                </div>
              </div>
            ))}
            {filteredMentors.length === 0 && (
                <div className="col-span-1 md:col-span-2 text-center py-20 border border-dashed border-white/10 rounded-3xl text-gray-500">
                    No mentors found matching your criteria.
                </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}