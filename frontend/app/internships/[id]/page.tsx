"use client";
import React, { useEffect, useState } from 'react';
import {
  Briefcase, Building2, MapPin, DollarSign, ArrowLeft, Clock, Send, CheckCircle2, Loader2, X
} from 'lucide-react';
import Link from 'next/link';
import { internshipService, Internship } from '@/src/services/internship.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { BookmarkButton } from '@/components/ui/BookmarkButton';

export default function InternshipDetailPage({ params }: { params: { id: string } }) {
    const internshipId = params.id;

  const [internship, setInternship] = useState<Internship | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverLetter, setCoverLetter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [applicationResult, setApplicationResult] = useState<any>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);

  const isLoggedIn = authService.isLoggedIn();

  useEffect(() => {
    if (internshipId) {
      fetchInternshipDetails();
    }
  }, [internshipId]);

  const fetchInternshipDetails = async () => {
    try {
      setLoading(true);
      const data = await internshipService.getInternshipById(internshipId);
      setInternship((data as any).data ?? data);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải thông tin thực tập');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      toast.error('Vui lòng đăng nhập để ứng tuyển!');
      window.location.href = `/auth/login?redirect=/internships/${internshipId}`;
      return;
    }
    if (!coverLetter.trim()) {
      toast.error('Vui lòng nhập thư giới thiệu');
      return;
    }
    try {
      setSubmitting(true);
      const result = await internshipService.applyInternship(internshipId, coverLetter);
      setApplicationResult(result);
      toast.success('Ứng tuyển thành công!');
      setShowApplyModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Ứng tuyển thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const openApplyModal = () => {
    if (!isLoggedIn) {
      toast.error('Vui lòng đăng nhập để ứng tuyển!');
      window.location.href = `/auth/login?redirect=/internships/${internshipId}`;
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

  if (!internship) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">404</h1>
        <p className="text-muted-foreground/60 mb-8">Không tìm thấy cơ hội thực tập này.</p>
        <Link
          href="/internships"
          className="px-6 py-2.5 rounded-full bg-primary font-medium hover:bg-primary/80 transition-colors"
        >
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const isOpen = internship.status === 'open';

  return (
    <div className="min-h-screen bg-background text-foreground py-8">
      <div className="w-full mx-auto space-y-8">
        <Link
          href="/internships"
          className="flex items-center gap-2 text-muted-foreground/60 hover:text-foreground transition-colors group text-sm font-bold w-fit"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> QUAY LẠI DANH SÁCH
        </Link>

        {/* Header — clean card, no blur orb */}
        <Card className="relative p-6 md:p-8">
          <BookmarkButton targetType="internships" targetId={internship.id} size="sm" className="absolute top-4 right-4 z-20" />
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background/60">
              {internship.company?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={internship.company.avatar_url}
                  alt={internship.company?.full_name || ''}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2 className="h-8 w-8 text-primary" aria-hidden="true" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="text-2xl font-semibold mb-1">{internship.title}</h1>
                  <p className="text-lg text-primary font-medium">
                    {internship.company?.full_name || 'Doanh nghiệp ẩn danh'}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isOpen
                      ? 'bg-primary/20 text-primary border-accent/30'
                      : 'bg-destructive/20 text-destructive border-destructive/30'
                  }`}
                >
                  {isOpen ? 'ĐANG MỞ ĐĂNG KÝ' : 'ĐÃ ĐÓNG ĐĂNG KÝ'}
                </span>
              </div>

              <div className="flex flex-wrap gap-5 text-sm text-foreground/55">
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />{' '}
                  {internship.location ? 'Xem trên bản đồ' : 'Chưa cập nhật địa chỉ'}
                </span>
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" /> {internship.salary_range || 'Thỏa thuận'}
                </span>
                <span className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary/70" /> {internship.field || 'Chưa phân loại'}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />{' '}
                  Đăng ngày {new Date(internship.created_at).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left: Description */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Mô tả công việc</h2>
              <CardContent className="p-0">
                <div className="text-foreground/70 leading-relaxed whitespace-pre-wrap">
                  {internship.description || 'Chưa có mô tả chi tiết.'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Apply Panel */}
          <div className="space-y-6">
            {applicationResult ? (
              <Card className="p-8 text-center space-y-4 border-accent/30">
                <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary">Đã nộp đơn thành công!</h3>
                <p className="text-xs text-muted-foreground/60">Mã theo dõu hồ sơ của bạn:</p>
                <p className="text-sm font-mono bg-card/40 p-2 rounded-lg border border-border break-all">
                  {applicationResult.tracking_id}
                </p>
                <p className="text-[10px] text-muted-foreground/60 pt-4 border-t border-accent/20">
                  Nhà tuyển dụng sẽ liên hệ với bạn nếu hồ sơ phù hợp. Chúc bạn may mắn!
                </p>
                <Link
                  href="/internships"
                  className="block mt-4 text-xs font-bold text-primary hover:text-accent"
                >
                  Tìm thêm cơ hội khác
                </Link>
              </Card>
            ) : !isOpen ? (
              <Card className="p-8 text-center">
                <h3 className="text-xl font-bold mb-2">Đã hết hạn</h3>
                <p className="text-sm text-muted-foreground/65">
                  Vị trí thực tập này không còn nhận thêm hồ sơ ứng tuyển.
                </p>
              </Card>
            ) : (
              <Card className="p-8 text-center space-y-4">
                <h3 className="text-xl font-bold text-primary">Nộp hồ sơ ứng tuyển</h3>
                <p className="text-xs text-muted-foreground/60">
                  Gửi kèm Cover Letter để nhà tuyển dụng hiểu rõ hơn về bạn.
                </p>
                <button
                  onClick={openApplyModal}
                  className="w-full py-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-colors flex justify-center items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  NỘP HỒ SƠ
                </button>
                <p className="text-[10px] text-muted-foreground/60">
                  Hồ sơ cá nhân của bạn trên EduMap sẽ tự động được đính kèm vào đơn ứng tuyển này.
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Apply Modal */}
        {showApplyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-card border border-border rounded-xl p-8 max-w-2xl w-full shadow-lg relative">
              <button
                onClick={() => setShowApplyModal(false)}
                className="absolute top-6 right-6 text-muted-foreground/60 hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Briefcase className="text-primary/80 w-5 h-5" /> Nộp hồ sơ ứng tuyển
              </h3>
              <p className="text-sm text-primary/70 mb-6 font-bold">{internship.title}</p>

              <form onSubmit={handleApply} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                    Thư giới thiệu (Cover Letter) *
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={coverLetter}
                    onChange={e => setCoverLetter(e.target.value)}
                    placeholder="Kính gửi ban tuyển dụng..."
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 mt-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                  {submitting ? 'ĐANG GỬI HỒ SƠ...' : 'GỬI HỒ SƠ ỨNG TUYỂN'}
                </button>
                <p className="text-[10px] text-center text-muted-foreground/60 mt-2">
                  Hồ sơ cá nhân của bạn trên EduMap sẽ tự động được đính kèm vào đơn ứng tuyển này.
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
