"use client";
import React, { useEffect, useState } from 'react';
import { 
  GraduationCap, MapPin, DollarSign, Clock, Search, Bookmark, 
  CheckCircle2, AlertTriangle, Loader2, FileText, UploadCloud, X
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { scholarshipService, Scholarship, EligibilityResponse } from '@/src/services/scholarship.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';

export default function ScholarshipPage() {
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [eligibilityResult, setEligibilityResult] = useState<{ [key: string]: EligibilityResponse }>({});
  
  // Application Modal States
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState<Scholarship | null>(null);
  const [personalStatement, setPersonalStatement] = useState('');
  const [cvUrl, setCvUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchScholarships();
  }, []);

  const fetchScholarships = async () => {
    try {
      setLoading(true);
      const data = await scholarshipService.getScholarships();
      setScholarships(data);
    } catch (error: any) {
      toast.error(error.message || "Lỗi tải danh sách học bổng");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEligibility = async (scholarshipId: string) => {
    if (!authService.isLoggedIn()) {
        toast.error('Vui lòng đăng nhập để kiểm tra điều kiện');
        window.location.href = '/auth/login?redirect=/scholarships';
        return;
    }

    setCheckingId(scholarshipId);
    try {
      const result = await scholarshipService.checkEligibility(scholarshipId);
      setEligibilityResult(prev => ({
        ...prev,
        [scholarshipId]: result
      }));
    } catch (error: any) {
        toast.error(error.message || 'Lỗi khi kiểm tra hồ sơ');
    } finally {
      setCheckingId(null);
    }
  };

  const openApplyModal = (scholarship: Scholarship) => {
      if (!authService.isLoggedIn()) {
          toast.error('Vui lòng đăng nhập để ứng tuyển');
          window.location.href = '/auth/login?redirect=/scholarships';
          return;
      }
      setSelectedScholarship(scholarship);
      setShowApplyModal(true);
  };

  const handleApply = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedScholarship) return;
      if (!personalStatement.trim() || !cvUrl.trim()) {
          toast.error('Vui lòng nhập đầy đủ Bài luận và Link CV');
          return;
      }

      try {
          setSubmitting(true);
          await scholarshipService.applyScholarship(selectedScholarship.id, personalStatement, cvUrl);
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

  const filteredScholarships = scholarships.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (s.provider && s.provider.toLowerCase().includes(searchTerm.toLowerCase()));
    if (activeFilter === 'all') return matchesSearch;
    if (activeFilter === 'high') return matchesSearch && Number(s.value_amount) >= 10000;
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      
      {/* Application Modal */}
      {showApplyModal && selectedScholarship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#121215] border border-white/10 rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative">
                <button onClick={() => setShowApplyModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
                <h3 className="text-2xl font-bold mb-2">Nộp hồ sơ ứng tuyển</h3>
                <p className="text-sm text-indigo-400 mb-6 font-bold">{selectedScholarship.title}</p>
                
                <form onSubmit={handleApply} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2 flex items-center gap-2"><FileText className="w-4 h-4"/> Bài luận cá nhân (Personal Statement) *</label>
                        <textarea 
                            required
                            rows={6}
                            value={personalStatement}
                            onChange={e => setPersonalStatement(e.target.value)}
                            placeholder="Giới thiệu về bản thân, mục tiêu học tập và lý do bạn xứng đáng nhận học bổng này..."
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none resize-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2 flex items-center gap-2"><UploadCloud className="w-4 h-4"/> Link CV / Portfolio *</label>
                        <input 
                            type="url" 
                            required
                            value={cvUrl}
                            onChange={e => setCvUrl(e.target.value)}
                            placeholder="https://drive.google.com/..."
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full py-4 mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null} 
                        {submitting ? 'ĐANG GỬI HỒ SƠ...' : 'XÁC NHẬN NỘP ĐƠN'}
                    </button>
                    <p className="text-[10px] text-center text-white/40 mt-2">EduMap sẽ đính kèm thêm dữ liệu thành tích và hoạt động ngoại khóa của bạn từ hệ thống.</p>
                </form>
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-gradient-to-br from-indigo-600/10 to-violet-600/10 p-12 rounded-[40px] border border-white/5 relative overflow-hidden">
          <div className="relative z-10">
            <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold mb-4 uppercase tracking-wider border border-indigo-500/30">
              🎓 EduMap Opportunities
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">Quỹ Học bổng Tương lai</h1>
            <p className="text-white/60 max-w-md leading-relaxed">
              EduMap tự động đối sánh hồ sơ học thuật và hoạt động ngoại khóa của bạn để tìm ra những học bổng phù hợp nhất.
            </p>
          </div>
          <div className="flex gap-4 relative z-10">
            <div className="p-6 rounded-3xl bg-black/40 border border-white/10 text-center min-w-[130px]">
              <p className="text-3xl font-extrabold text-indigo-400">{scholarships.length}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">Chương trình</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-5">
            <GraduationCap className="w-64 h-64" />
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input 
              type="text" 
              placeholder="Tìm tên học bổng, nhà tài trợ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500 transition-colors placeholder:text-white/20 text-sm text-yellow-500" 
            />
          </div>
          <div className="flex gap-2">
            {['all', 'high'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-6 py-4 rounded-2xl border text-xs font-bold uppercase tracking-wider transition-all ${
                  activeFilter === tab 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                    : 'bg-card border-white/10 text-white/60 hover:bg-card'
                }`}
              >
                {tab === 'all' ? 'Tất cả' : 'Giá trị lớn (>$10k)'}
              </button>
            ))}
          </div>
        </div>

        {/* Scholarship List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>
        ) : filteredScholarships.length > 0 ? (
          <div className="space-y-6">
            {filteredScholarships.map(item => (
              <div 
                key={item.id} 
                className="p-8 rounded-[32px] bg-card border border-white/10 hover:border-indigo-500/30 transition-all duration-300 flex flex-col md:flex-row gap-6 relative overflow-hidden group"
              >
                {/* Logo Box */}
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-3xl font-black text-white shadow-lg self-start`}>
                  {item.provider?.charAt(0) || 'S'}
                </div>

                {/* Contents */}
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors duration-300">
                        {item.title}
                      </h3>
                      <p className="text-sm text-indigo-400 font-semibold mt-1">{item.provider || "Tổ chức EduMap"}</p>
                    </div>
                    <button className="text-white/20 hover:text-white transition-colors">
                      <Bookmark className="w-6 h-6" />
                    </button>
                  </div>

                  <p className="text-sm text-white/60 leading-relaxed max-w-3xl line-clamp-2">
                    {item.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-4 text-xs text-white/50">
                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-indigo-400" /> Toàn quốc</span>
                    <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /> {Number(item.value_amount).toLocaleString()} USD</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-400" /> Hạn nộp: {new Date(item.deadline).toLocaleDateString()}</span>
                  </div>

                  {/* Live Eligibility Widget */}
                  {eligibilityResult[item.id] && (
                    <div className={`p-4 rounded-2xl border ${
                      eligibilityResult[item.id].is_eligible 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    } text-xs flex items-start gap-2.5 animate-in fade-in`}>
                      {eligibilityResult[item.id].is_eligible ? (
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      )}
                      <span className="font-medium leading-normal">{eligibilityResult[item.id].message}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 justify-center min-w-[200px] border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                  <Button 
                    onClick={() => handleCheckEligibility(item.id)}
                    disabled={checkingId === item.id}
                    variant="outline"
                    className="w-full py-6 rounded-xl border-white/15 text-xs font-bold hover:bg-white/5 text-white"
                  >
                    {checkingId === item.id ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Kiểm tra độ phù hợp'}
                  </Button>
                  
                  <Button 
                    onClick={() => openApplyModal(item)}
                    className="w-full py-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/15"
                  >
                    Nộp đơn ngay
                  </Button>
                </div>

              </div>
            ))}
          </div>
        ) : (
            <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                <GraduationCap className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40">Không tìm thấy học bổng nào.</p>
            </div>
        )}

      </div>
    </div>
  );
}
