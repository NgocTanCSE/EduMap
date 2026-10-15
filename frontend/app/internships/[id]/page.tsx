"use client";
import React, { useEffect, useState, use } from 'react';
import {
  Briefcase, MapPin, DollarSign, ArrowLeft, Clock, Send, CheckCircle2, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { internshipService, Internship } from '@/src/services/internship.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

export default function InternshipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const internshipId = resolvedParams.id;

  const [internship, setInternship] = useState<Internship | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverLetter, setCoverLetter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [applicationResult, setApplicationResult] = useState<any>(null);

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
      setInternship(data);
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
    } catch (error: any) {
      toast.error(error.message || 'Ứng tuyển thất bại');
    } finally {
      setSubmitting(false);
    }
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
          className="flex items-center gap-2 text-muted-foreground/40 hover:text-foreground transition-colors group text-sm font-bold w-fit"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> QUAY LẠI DANH SÁCH
        </Link>

        {/* Header — clean card, no blur orb */}
        <Card className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-20 h-20 rounded-xl bg-primary flex items-center justify-center text-3xl font-bold text-foreground overflow-hidden border border-border shrink-0">
              {internship.company?.avatar_url ? (
                <img
                  src={internship.company.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                internship.company?.full_name?.charAt(0) || 'B'
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
                <p className="text-sm text-muted-foreground/50">
                  Vị trí thực tập này không còn nhận thêm hồ sơ ứng tuyển.
                </p>
              </Card>
            ) : (
              <form
                onSubmit={handleApply}
                className="bg-card border border-border rounded-xl p-8 space-y-6"
              >
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                    <Briefcase className="text-primary/80 w-5 h-5" /> Nộp hồ sơ ứng tuyển
                  </h3>
                  <p className="text-xs text-muted-foreground/40">
                    Gửi kèm Cover Letter để nhà tuyển dụng hiểu rõ hơn về bạn.
                  </p>
                </div>

                <div className="space-y-4">
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
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-xl bg-primary hover:bg-primary/80 text-foreground font-bold transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                  GỬI HỒ SƠ ỨNG TUYỂN
                </button>
                <p className="text-[10px] text-center text-muted-foreground/40">
                  Hồ sơ cá nhân của bạn trên EduMap sẽ tự động được đính kèm vào đơn ứng tuyển này.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
