"use client";
import React, { useEffect, useState, use } from 'react';
import { Terminal, Code, Users, Calendar, Trophy, ArrowLeft, Loader2, CheckCircle2, FileCode2, PlaySquare } from 'lucide-react';
import { hackathonService, Hackathon } from '@/src/services/hackathon.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import Link from 'next/link';

export default function HackathonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const hackathonId = resolvedParams.id;

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Registration Form States
  const [teamName, setTeamName] = useState('');
  const [membersInput, setMembersInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeredTeam, setRegisteredTeam] = useState<any>(null); // State if already registered

  // Submission Modal States
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [demoVideo, setDemoVideo] = useState('');
  const [submittingProject, setSubmittingProject] = useState(false);

  const isLoggedIn = authService.isLoggedIn();

  useEffect(() => {
    if (hackathonId) {
      fetchHackathonDetails();
    }
  }, [hackathonId]);

  const fetchHackathonDetails = async () => {
    try {
      setLoading(true);
      const data = await hackathonService.getHackathonById(hackathonId);
      setHackathon(data);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải thông tin cuộc thi');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      toast.error('Vui lòng đăng nhập để đăng ký!');
      window.location.href = `/auth/login?redirect=/hackathon/${hackathonId}`;
      return;
    }

    if (!teamName.trim()) {
        toast.error('Tên đội không được để trống');
        return;
    }

    try {
      setSubmitting(true);
      // Split members by comma and clean up
      const members = membersInput.split(',').map(m => m.trim()).filter(m => m);
      
      const result = await hackathonService.registerTeam({
          team_name: teamName,
          hackathon_id: hackathonId,
          members: members
      });
      
      setRegisteredTeam(result);
      toast.success('Đăng ký đội thi thành công! Chúc đội của bạn thi đấu tốt.');
    } catch (error: any) {
      toast.error(error.message || 'Đăng ký thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!repoUrl.trim()) {
          toast.error('Link mã nguồn (Github) là bắt buộc');
          return;
      }

      try {
          setSubmittingProject(true);
          const result = await hackathonService.submitProject(registeredTeam.id, repoUrl, demoVideo);
          toast.success(result.message || 'Nộp sản phẩm dự thi thành công!');
          setShowSubmitModal(false);
          // Update local state to reflect submission
          setRegisteredTeam({ ...registeredTeam, status: 'submitted', repo_url: repoUrl, demo_video: demoVideo });
      } catch (error: any) {
          toast.error(error.message || 'Nộp sản phẩm thất bại');
      } finally {
          setSubmittingProject(false);
      }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-white/60 mb-8">Không tìm thấy cuộc thi Hackathon này.</p>
        <Link href="/hackathon" className="px-8 py-3 rounded-full bg-purple-600 font-bold hover:bg-purple-500 transition-all">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const isCompleted = hackathon.status === 'completed';
  const isOngoing = hackathon.status === 'ongoing';

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        <Link href="/hackathon" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group text-sm font-bold w-fit">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> QUAY LẠI
        </Link>

        {/* Hero Section */}
        <div className="bg-card border border-white/5 rounded-[40px] p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 blur-[100px] rounded-full -mr-20 -mt-20 pointer-events-none" />
            
            <div className="relative z-10 max-w-3xl space-y-6">
                <span className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border inline-block ${
                    isOngoing ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    isCompleted ? 'bg-zinc-800 text-white/40 border-white/10' :
                    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                }`}>
                    {isOngoing ? 'ĐANG DIỄN RA' : isCompleted ? 'ĐÃ KẾT THÚC' : 'SẮP MỞ ĐĂNG KÝ'}
                </span>
                
                <h1 className="text-4xl md:text-5xl font-black leading-tight">{hackathon.title}</h1>
                
                <div className="flex flex-wrap items-center gap-6 pt-4 text-sm text-white/60">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-400" />
                        {new Date(hackathon.start_date).toLocaleDateString('vi-VN')} - {new Date(hackathon.end_date).toLocaleDateString('vi-VN')}
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-400" />
                        Team (3-5 thành viên)
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left: Detail Info */}
            <div className="lg:col-span-2 space-y-8">
                <div className="prose prose-invert max-w-none">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Terminal className="text-purple-500 w-6 h-6" /> Thể lệ & Yêu cầu
                    </h2>
                    <div className="text-white/70 leading-relaxed bg-zinc-900/50 p-6 rounded-3xl border border-white/5 whitespace-pre-wrap mt-4">
                        {hackathon.description || 'Đang cập nhật thể lệ chi tiết cho cuộc thi này.'}
                    </div>
                </div>
            </div>

            {/* Right: Registration / Status Panel */}
            <div className="space-y-6 sticky top-8">
                {registeredTeam ? (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-3xl p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold text-green-400">Đã đăng ký thành công!</h3>
                        <p className="text-sm font-bold text-white">Đội: {registeredTeam.team_name}</p>
                        
                        <div className="pt-6 mt-6 border-t border-green-500/20 space-y-4">
                            <h4 className="font-bold text-sm text-left text-white/80">Khu vực nộp bài</h4>
                            <p className="text-xs text-left text-white/60">Trưởng nhóm sử dụng các liên kết sau để nộp mã nguồn và video demo trước hạn chót.</p>
                            
                            <div className="space-y-3">
                                <button className="w-full py-3 rounded-xl bg-zinc-900 border border-white/10 hover:border-purple-500 text-sm font-bold flex items-center justify-center gap-2 transition-all">
                                    <FileCode2 className="w-4 h-4 text-purple-400" /> Nộp Github Repo
                                </button>
                                <button className="w-full py-3 rounded-xl bg-zinc-900 border border-white/10 hover:border-blue-500 text-sm font-bold flex items-center justify-center gap-2 transition-all">
                                    <PlaySquare className="w-4 h-4 text-blue-400" /> Nộp Demo Video
                                </button>
                            </div>
                        </div>
                    </div>
                ) : isCompleted ? (
                    <div className="bg-card border border-white/10 rounded-3xl p-8 text-center">
                        <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">Cuộc thi đã kết thúc</h3>
                        <p className="text-sm text-white/40">Cảm ơn các đội thi đã tham gia. Kết quả sẽ được công bố trên trang chủ.</p>
                    </div>
                ) : (
                    <form onSubmit={handleRegister} className="bg-card border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                                <Code className="text-purple-500 w-5 h-5" /> Đăng ký Đội thi
                            </h3>
                            <p className="text-xs text-white/40">Chỉ trưởng nhóm cần thực hiện thao tác này.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Tên Đội</label>
                                <input 
                                    type="text" 
                                    required
                                    value={teamName}
                                    onChange={e => setTeamName(e.target.value)}
                                    placeholder="VD: Tech Innovators"
                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Email các thành viên</label>
                                <textarea 
                                    rows={3}
                                    value={membersInput}
                                    onChange={e => setMembersInput(e.target.value)}
                                    placeholder="Phân cách bằng dấu phẩy (VD: a@gmail.com, b@gmail.com)"
                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all resize-none"
                                />
                                <p className="text-[10px] text-white/40 mt-1 mt-2">Không bao gồm email của bạn (trưởng nhóm).</p>
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                            XÁC NHẬN ĐĂNG KÝ
                        </button>
                    </form>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}
