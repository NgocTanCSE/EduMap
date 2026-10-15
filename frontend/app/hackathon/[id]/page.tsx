"use client";
import React, { useEffect, useState, use } from 'react';
import { Code, Users, Calendar, Trophy, ArrowLeft, Loader2, CheckCircle2, FileCode2, PlaySquare } from 'lucide-react';
import Link from 'next/link';
import { hackathonService, Hackathon } from '@/src/services/hackathon.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

export default function HackathonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const hackathonId = resolvedParams.id;

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [loading, setLoading] = useState(true);

  /* Registration Form States */
  const [teamName, setTeamName] = useState('');
  const [membersInput, setMembersInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeredTeam, setRegisteredTeam] = useState<any>(null);

  /* Submission Modal States */
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
      const members = membersInput.split(',').map(m => m.trim()).filter(m => m);
      const result = await hackathonService.registerTeam({
        team_name: teamName,
        hackathon_id: hackathonId,
        members: members,
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
      setRegisteredTeam({ ...registeredTeam, status: 'submitted', repo_url: repoUrl, demo_video: demoVideo });
    } catch (error: any) {
      toast.error(error.message || 'Nộp sản phẩm thất bại');
    } finally {
      setSubmittingProject(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary/80 animate-spin" />
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">404</h1>
        <p className="text-muted-foreground/60 mb-8">Không tìm thấy cuộc thi Hackathon này.</p>
        <Link
          href="/hackathon"
          className="px-6 py-2.5 rounded-full bg-primary font-medium hover:bg-primary/90 transition-colors"
        >
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const isCompleted = hackathon.status === 'completed';
  const isOngoing = hackathon.status === 'ongoing';

  return (
    <div className="min-h-screen bg-background text-foreground py-8">
      <div className="w-full mx-auto space-y-8">
        <Link
          href="/hackathon"
          className="flex items-center gap-2 text-muted-foreground/40 hover:text-foreground transition-colors group text-sm font-bold w-fit"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> QUAY LẠI
        </Link>

        {/* Hero Section — clean card, no blur orb / tilt */}
        <Card className="p-6 md:p-8">
          <div className="max-w-3xl space-y-5">
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-block ${
                isOngoing
                  ? 'bg-primary/20 text-primary border-accent/30'
                  : isCompleted
                  ? 'bg-foreground/5 text-muted-foreground/50 border-border'
                  : 'bg-primary/20 text-primary/70 border-primary/30'
              }`}
            >
              {isOngoing ? 'ĐANG DIỄN RA' : isCompleted ? 'ĐÃ KẾT THÚC' : 'SẮP MỞ ĐĂNG KÝ'}
            </span>

            <h1 className="text-2xl font-semibold leading-tight">{hackathon.title}</h1>

            <div className="flex flex-wrap items-center gap-6 pt-2 text-sm text-foreground/55">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary/70" />
                {new Date(hackathon.start_date).toLocaleDateString('vi-VN')} -{' '}
                {new Date(hackathon.end_date).toLocaleDateString('vi-VN')}
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Team (3-5 thành viên)
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left: Detail Info */}
          <div className="lg:col-span-2 space-y-8">
            <div className="prose prose-invert max-w-none">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Code className="text-primary/80 w-5 h-5" /> Thể lệ & Yêu cầu
              </h2>
              <Card className="mt-4 p-6 border-border">
                <div className="text-foreground/70 leading-relaxed whitespace-pre-wrap">
                  {hackathon.description || 'Đang cập nhật thể lệ chi tiết cho cuộc thi này.'}
                </div>
              </Card>
            </div>
          </div>

          {/* Right: Registration / Status Panel */}
          <div className="space-y-6">
            {registeredTeam ? (
              <Card className="p-8 text-center space-y-4 border-accent/30">
                <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary">Đã đăng ký thành công!</h3>
                <p className="text-sm font-bold text-foreground">Đội: {registeredTeam.team_name}</p>

                <div className="pt-6 mt-6 border-t border-accent/20 space-y-3">
                  <h4 className="font-bold text-sm text-left text-foreground/80">Khu vực nộp bài</h4>
                  <p className="text-xs text-left text-muted-foreground/60">
                    Trưởng nhóm sử dụng các liên kết sau để nộp mã nguồn và video demo trước hạn chót.
                  </p>
                  <div className="space-y-2.5">
                    <button className="w-full py-3 rounded-xl bg-card border border-border hover:border-primary text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                      <FileCode2 className="w-4 h-4 text-primary/70" /> Nộp Github Repo
                    </button>
                    <button className="w-full py-3 rounded-xl bg-card border border-border hover:border-primary text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                      <PlaySquare className="w-4 h-4 text-primary" /> Nộp Demo Video
                    </button>
                  </div>
                </div>
              </Card>
            ) : isCompleted ? (
              <Card className="p-8 text-center">
                <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Cuộc thi đã kết thúc</h3>
                <p className="text-sm text-muted-foreground/50">
                  Cảm ơn các đội thi đã tham gia. Kết quả sẽ được công bố trên trang chủ.
                </p>
              </Card>
            ) : (
              <form onSubmit={handleRegister} className="bg-card border border-border rounded-xl p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                    <Code className="text-primary/80 w-5 h-5" /> Đăng ký Đội thi
                  </h3>
                  <p className="text-xs text-muted-foreground/40">
                    Chỉ trưởng nhóm cần thực hiện thao tác này.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                      Tên Đội
                    </label>
                    <input
                      type="text"
                      required
                      value={teamName}
                      onChange={e => setTeamName(e.target.value)}
                      placeholder="VD: Tech Innovators"
                      className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                      Email các thành viên
                    </label>
                    <textarea
                      rows={3}
                      value={membersInput}
                      onChange={e => setMembersInput(e.target.value)}
                      placeholder="Phân cách bằng dấu phẩy (VD: a@gmail.com, b@gmail.com)"
                      className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-all resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground/40 mt-1">
                      Không bao gồm email của bạn (trưởng nhóm).
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-xl bg-primary hover:bg-primary/90 text-foreground font-bold transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
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
