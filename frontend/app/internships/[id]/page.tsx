"use client";
import React, { useEffect, useState, use } from 'react';
import { Briefcase, MapPin, DollarSign, Clock, Building2, Bookmark, ArrowLeft, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { internshipService, Internship } from '@/src/services/internship.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import Link from 'next/link';

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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  if (!internship) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-white/60 mb-8">Không tìm thấy cơ hội thực tập này.</p>
        <Link href="/internships" className="px-8 py-3 rounded-full bg-yellow-600 font-bold hover:bg-yellow-500 transition-all">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const isOpen = internship.status === 'open';

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <Link href="/internships" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group text-sm font-bold w-fit">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> QUAY LẠI DANH SÁCH
        </Link>

        {/* Header Profile */}
        <div className="bg-card border border-white/5 rounded-[40px] p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row gap-8 items-start shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/10 blur-[100px] rounded-full -mr-20 -mt-20 pointer-events-none" />
          
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-br from-yellow-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-lg overflow-hidden border-2 border-white/10 shrink-0 relative z-10">
            {internship.company?.avatar_url ? (
                <img src={internship.company.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
                internship.company?.full_name?.charAt(0) || 'B'
            )}
          </div>
          
          <div className="flex-1 relative z-10">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black mb-2">{internship.title}</h1>
                    <p className="text-xl text-yellow-500 font-bold">{internship.company?.full_name || 'Doanh nghiệp ẩn danh'}</p>
                </div>
                <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border ${isOpen ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                    {isOpen ? 'ĐANG MỞ ĐĂNG KÝ' : 'ĐÃ ĐÓNG ĐĂNG KÝ'}
                </span>
            </div>
            
            <div className="flex flex-wrap gap-6 text-sm text-white/60 pt-4 border-t border-white/5">
                <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-yellow-500" /> {internship.location ? 'Xem trên bản đồ' : 'Chưa cập nhật địa chỉ'}</span>
                <span className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-400" /> {internship.salary_range || "Thỏa thuận"}</span>
                <span className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-purple-400" /> {internship.field}</span>
                <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" /> Đăng ngày {new Date(internship.created_at).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left: Description */}
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-card border border-white/5 rounded-3xl p-8">
                    <h2 className="text-2xl font-bold mb-6">Mô tả công việc</h2>
                    <div className="prose prose-invert max-w-none text-white/70 leading-relaxed whitespace-pre-wrap">
                        {internship.description || 'Chưa có mô tả chi tiết.'}
                    </div>
                </div>
            </div>

            {/* Right: Apply Panel */}
            <div className="space-y-6 sticky top-8">
                {applicationResult ? (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-3xl p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold text-green-400">Đã nộp đơn thành công!</h3>
                        <p className="text-xs text-white/60">Mã theo dõi hồ sơ của bạn:</p>
                        <p className="text-sm font-mono bg-black/40 p-2 rounded-lg border border-white/10 break-all">{applicationResult.tracking_id}</p>
                        <p className="text-xs text-white/60 pt-4 border-t border-green-500/20">Nhà tuyển dụng sẽ sớm liên hệ với bạn nếu hồ sơ phù hợp. Chúc bạn may mắn!</p>
                        <Link href="/internships" className="block mt-4 text-xs font-bold text-green-400 hover:text-green-300">
                            Tìm thêm cơ hội khác
                        </Link>
                    </div>
                ) : !isOpen ? (
                    <div className="bg-card border border-white/10 rounded-3xl p-8 text-center">
                        <h3 className="text-xl font-bold mb-2">Đã hết hạn</h3>
                        <p className="text-sm text-white/40">Vị trí thực tập này không còn nhận thêm hồ sơ ứng tuyển.</p>
                    </div>
                ) : (
                    <form onSubmit={handleApply} className="bg-card border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
                        <div>
                            <h3 className="text-xl font-bold mb-2">Nộp hồ sơ ứng tuyển</h3>
                            <p className="text-xs text-white/40">Gửi kèm Cover Letter để nhà tuyển dụng hiểu rõ hơn về bạn.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Thư giới thiệu (Cover Letter) *</label>
                                <textarea 
                                    required
                                    rows={6}
                                    value={coverLetter}
                                    onChange={e => setCoverLetter(e.target.value)}
                                    placeholder="Kính gửi ban tuyển dụng..."
                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-yellow-500 outline-none transition-all resize-none"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-black transition-all shadow-lg shadow-yellow-600/20 disabled:opacity-50 disabled:bg-zinc-700 disabled:text-white/40 flex justify-center items-center gap-2"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                            GỬI HỒ SƠ ỨNG TUYỂN
                        </button>
                        <p className="text-[10px] text-center text-white/40">Hồ sơ cá nhân (Profile) của bạn trên EduMap sẽ tự động được đính kèm vào đơn ứng tuyển này.</p>
                    </form>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}
