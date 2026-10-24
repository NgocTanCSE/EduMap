"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GraduationCap, MapPin, DollarSign, Clock, ArrowLeft, Share2,
  Loader2, CheckCircle2, AlertTriangle, FileText, UploadCloud, X
} from 'lucide-react';
import { scholarshipService, Scholarship, EligibilityResponse } from '@/src/services/scholarship.service';
import { authService } from '@/src/services/auth.service';
import { shareLink } from '@/src/lib/share';
import { toast } from 'sonner';
import Link from 'next/link';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ScholarshipDetailPage({ params }: { params: { id: string } }) {
  const scholarshipId = params.id;
  const router = useRouter();
  const [scholarship, setScholarship] = useState<Scholarship | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [personalStatement, setPersonalStatement] = useState('');
  const [cvUrl, setCvUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (scholarshipId) {
      fetchScholarship();
    }
  }, [scholarshipId]);

  const fetchScholarship = async () => {
    try {
      setLoading(true);
      const data = await scholarshipService.getScholarshipById(scholarshipId);
      setScholarship(data);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải chi tiết học bổng');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!scholarship) return;
    await shareLink({
      title: scholarship.title,
      text: `Học bổng: ${scholarship.title}`,
      url: `${window.location.origin}/scholarships/${scholarship.id}`,
    });
  };

  const handleCheckEligibility = async () => {
    if (!authService.isLoggedIn()) {
      toast.error('Vui lòng đăng nhập để kiểm tra điều kiện');
      window.location.href = `/auth/login?redirect=/scholarships/${scholarshipId}`;
      return;
    }
    setChecking(true);
    try {
      const result = await scholarshipService.checkEligibility(scholarshipId);
      setEligibility(result);
    } catch (error: any) {
      toast.error(error.message || 'Kiểm tra điều kiện thất bại');
    } finally {
      setChecking(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authService.isLoggedIn()) {
      toast.error('Vui lòng đăng nhập để nộp đơn');
      return;
    }
    setSubmitting(true);
    try {
      await scholarshipService.applyScholarship(scholarshipId, personalStatement, cvUrl);
      toast.success('Nộp đơn thành công! Vui lòng theo dõi email.');
      setShowApplyModal(false);
      setPersonalStatement('');
      setCvUrl('');
    } catch (error: any) {
      toast.error(error.message || 'Nộp đơn thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const openApplyModal = () => {
    if (!authService.isLoggedIn()) {
      toast.error('Vui lòng đăng nhập để ứng tuyển');
      window.location.href = `/auth/login?redirect=/scholarships/${scholarshipId}`;
      return;
    }
    setShowApplyModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!scholarship) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">404</h1>
        <p className="text-muted-foreground/60 mb-8">Không tìm thấy học bổng này.</p>
        <Link href="/scholarships" className="px-8 py-3 rounded-full bg-primary font-bold hover:bg-primary transition-all">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const deadline = new Date(scholarship.deadline);
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="w-full mx-auto space-y-8">
        <Link
          href="/scholarships"
          className="flex items-center gap-2 text-muted-foreground/40 hover:text-foreground transition-colors text-sm font-bold w-fit"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> QUAY LẠI DANH SÁCH
        </Link>

        <div className="bg-card border border-border rounded-lg p-8 md:p-6 relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-start mb-2">
              <span className="px-4 py-2 rounded-full bg-primary/20 text-primary/90 text-xs font-bold uppercase tracking-widest border border-primary/30">
                {scholarship.provider || 'Tổ chức EduMap'}
              </span>
              <div className="flex items-center gap-2">
                <BookmarkButton targetType="scholarships" targetId={scholarship.id} size="sm" />
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Chia sẻ học bổng"
                  className="p-3 bg-card border border-border rounded-xl hover:bg-card/20 transition-colors"
                >
                  <Share2 className="w-5 h-5 text-muted-foreground/60" />
                </button>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{scholarship.title}</h1>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground/60 pt-4 border-t border-border">
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent" />
                {Number(scholarship.value_amount).toLocaleString()} USD
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Hạn nộp: {deadline.toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <div className="bg-card border border-border rounded-xl p-8">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" /> Mô tả học bổng
              </h2>
              <div className="prose prose-invert max-w-none text-foreground/70 leading-relaxed whitespace-pre-wrap">
                {scholarship.description || 'Chưa có mô tả chi tiết cho học bổng này.'}
              </div>
            </div>

            {eligibility && (
              <div className={`p-4 rounded-xl border ${eligibility.is_eligible ? 'bg-accent/10 border-accent/20' : 'bg-primary/10 border-primary/20'}`}>
                <div className="flex items-start gap-3">
                  {eligibility.is_eligible ? (
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                  <div>
                    <h3 className="font-bold text-sm mb-1">
                      {eligibility.is_eligible ? 'Bạn đủ điều kiện' : 'Bạn chưa đủ điều kiện'}
                    </h3>
                    <p className="text-sm text-muted-foreground/60">{eligibility.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Card className="p-6 sticky top-8">
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-2">Học bổng</h3>
                  <p className="text-sm text-muted-foreground/60">{scholarship.title}</p>
                  <p className="text-xs text-muted-foreground/40 mt-1">{scholarship.provider || 'Tổ chức EduMap'}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <DollarSign className="w-3.5 h-3.5 text-accent" />
                    <span>{Number(scholarship.value_amount).toLocaleString()} USD</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Hạn nộp: {deadline.toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <Button
                    onClick={handleCheckEligibility}
                    disabled={checking || !authService.isLoggedIn()}
                    variant="outline"
                    className="w-full py-3 rounded-lg text-[11px] font-bold"
                  >
                    {checking ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    {checking ? 'Đang kiểm tra...' : 'Kiểm tra phù hợp'}
                  </Button>
                  <Button
                    onClick={openApplyModal}
                    className="w-full py-3 rounded-lg bg-primary text-foreground text-[11px] font-bold"
                  >
                    Nộp đơn ngay
                  </Button>
                </div>

                {!authService.isLoggedIn() && (
                  <p className="text-[10px] text-center text-muted-foreground/40 mt-2">
                    Vui lòng đăng nhập để nộp đơn ứng tuyển.
                  </p>
                )}
        </div>

        {/* Apply Modal */}
        {showApplyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-card border border-border rounded-xl p-8 max-w-2xl w-full shadow-lg relative">
              <button
                onClick={() => setShowApplyModal(false)}
                className="absolute top-6 right-6 text-muted-foreground/40 hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-2xl font-bold mb-2">Nộp hồ sơ ứng tuyển</h3>
              <p className="text-sm text-primary/70 mb-6 font-bold">{scholarship.title}</p>

              <form onSubmit={handleApply} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground/60 uppercase mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Bài luận cá nhân (Personal Statement) *
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={personalStatement}
                    onChange={e => setPersonalStatement(e.target.value)}
                    placeholder="Giới thiệu về bản thân, mục tiêu học tập và lý do bạn xứng đáng nhận học bổng này..."
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground/60 uppercase mb-2 flex items-center gap-2">
                    <UploadCloud className="w-4 h-4" /> Link CV / Portfolio
                  </label>
                  <input
                    type="url"
                    value={cvUrl}
                    onChange={e => setCvUrl(e.target.value)}
                    placeholder="https://drive.google.com/... (dán link CV nếu có)"
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 mt-4 rounded-xl bg-primary hover:bg-primary/90 text-foreground font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {submitting ? 'ĐANG GỬI HỒ SƠ...' : 'XÁC NHẬN NỘP ĐƠN'}
                </button>
                <p className="text-[10px] text-center text-muted-foreground/40 mt-2">
                  EduMap sẽ đính kèm thêm dữ liệu thành tích và hoạt động ngoại khóa của bạn từ hệ thống.
                </p>
              </form>
            </div>
          </div>
        )}
      </Card>
      </div>
    </div>
  </div>
  </div>
);
}