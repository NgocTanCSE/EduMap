"use client";
import React, { useEffect, useState } from 'react';
import {
  GraduationCap, MapPin, DollarSign, Clock, Bookmark,
  CheckCircle2, AlertTriangle, Loader2, FileText, UploadCloud, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { scholarshipService, Scholarship, EligibilityResponse } from '@/src/services/scholarship.service';
import FileUpload from '@/src/components/ui/FileUpload';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import { useBookmarkStore } from '@/src/lib/bookmarks';
import ContentShell from '@/components/ui/ContentShell';
import SectionHeader from '@/components/ui/SectionHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Skeleton from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/EmptyState';

export default function ScholarshipPage() {
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarked, toggleBookmark] = useBookmarkStore('scholarships');
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [eligibilityResult, setEligibilityResult] = useState<{ [key: string]: EligibilityResponse }>({});

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState<Scholarship | null>(null);
  const [personalStatement, setPersonalStatement] = useState('');
  const [cvUrl, setCvUrl] = useState('');
  const [cvUploading, setCvUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchScholarships(1);
  }, []);

  const fetchScholarships = async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      const data: any = await scholarshipService.getScholarships(pageNum, 10);
      const items = data.items || data.data || [];
      const meta = data.meta || {};
      if (pageNum === 1) {
        setScholarships(items);
      } else {
        setScholarships(prev => [...prev, ...items]);
      }
      setHasMore(meta.currentPage < meta.totalPages);
      setPage(pageNum);
    } catch (error: any) {
      toast.error(error.message || "Lỗi tải danh sách học bổng");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) fetchScholarships(page + 1);
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
      setEligibilityResult(prev => ({ ...prev, [scholarshipId]: result }));
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
    const matchesSearch =
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.provider && s.provider.toLowerCase().includes(searchTerm.toLowerCase()));
    if (activeFilter === 'all') return matchesSearch;
    if (activeFilter === 'high') return matchesSearch && Number(s.value_amount) >= 10000;
    return matchesSearch;
  });

  return (
    <ContentShell>
      {/* Application Modal */}
      {showApplyModal && selectedScholarship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-xl p-8 max-w-2xl w-full shadow-lg relative">
            <button
              onClick={() => setShowApplyModal(false)}
              className="absolute top-6 right-6 text-muted-foreground/40 hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-bold mb-2">Nộp hồ sơ ứng tuyển</h3>
            <p className="text-sm text-primary/70 mb-6 font-bold">{selectedScholarship.title}</p>

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
                  <UploadCloud className="w-4 h-4" /> Link CV / Portfolio hoặc tải lên
                </label>
                <div className="space-y-3">
                  <input
                    type="url"
                    required={!cvUrl}
                    value={cvUrl}
                    onChange={e => setCvUrl(e.target.value)}
                    placeholder="https://drive.google.com/... (dán link CV nếu có)"
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none"
                  />
                  <div className="text-xs text-muted-foreground/40">Hoặc tải CV lên máy chủ (PDF, DOC, DOCX - tối đa 10MB):</div>
                  <FileUpload
                    accept=".pdf,.doc,.docx"
                    label="Tải lên CV của bạn"
                    maxSizeMB={10}
                    onUploadSuccess={(url) => {
                      setCvUrl(url);
                      toast.success('CV đã sẵn sàng! Nhấn XÁC NHẬN NỘP ĐƠN để gửi.');
                    }}
                  />
                </div>
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

      <SectionHeader
        title="Quỹ Học bổng Tương lai"
        subtitle="EduMap tự động đối chiếu hồ sơ học thuật và hoạt động ngoại khóa để tìm học bổng phù hợp nhất."
        icon={GraduationCap}
        right={<span className="text-xs text-foreground/40">{scholarships.length} chương trình</span>}
      />

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Tìm tên học bổng, nhà tài trợ..."
        />
        <div className="flex gap-2">
          {['all', 'high'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                activeFilter === tab
                  ? 'bg-primary border-primary text-foreground'
                  : 'bg-card border-border text-foreground/60 hover:bg-foreground/5'
              }`}
            >
              {tab === 'all' ? 'Tất cả' : 'Giá trị lớn (>$10k)'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-32">
              <CardContent className="p-0"><Skeleton className="h-full w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : filteredScholarships.length > 0 ? (
        <div className="space-y-3">
          {filteredScholarships.map(item => (
            <Card
              key={item.id}
              className="p-5 flex flex-col md:flex-row gap-5 border-border hover:border-primary/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-xl font-bold text-foreground shrink-0">
                {item.provider?.charAt(0) || 'S'}
              </div>

              <div className="flex-1 space-y-2.5">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="text-base font-semibold line-clamp-1 text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-xs text-primary/70 font-medium">
                      {item.provider || 'Tổ chức EduMap'}
                    </p>
                  </div>
                  <button
                    className="text-muted-foreground/20 hover:text-primary transition-colors"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(item.id); }}
                  >
                    <Bookmark
                      className={`w-5 h-5 ${bookmarked.has(item.id) ? 'fill-primary text-primary' : 'text-muted-foreground/20'}`}
                    />
                  </button>
                </div>

                <p className="text-sm text-foreground/60 line-clamp-2">{item.description}</p>

                <div className="flex flex-wrap gap-3 text-xs text-foreground/55">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> Toàn quốc
                  </span>
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-accent" /> {Number(item.value_amount).toLocaleString()} USD
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" /> Hạn nộp: {new Date(item.deadline).toLocaleDateString()}
                  </span>
                </div>

                {eligibilityResult[item.id] && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                      eligibilityResult[item.id].is_eligible
                        ? 'bg-accent/10 border-accent/20 text-accent'
                        : 'bg-primary/10 border-primary/20 text-primary'
                    }`}
                  >
                    {eligibilityResult[item.id].is_eligible ? (
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span className="font-medium leading-normal">
                      {eligibilityResult[item.id].message}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5 min-w-[170px] border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-4">
                <Button
                  onClick={() => handleCheckEligibility(item.id)}
                  disabled={checkingId === item.id}
                  variant="outline"
                  className="w-full py-3 rounded-lg text-[11px] font-bold"
                >
                  {checkingId === item.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : 'Kiểm tra phù hợp'}
                </Button>
                <Button
                  onClick={() => openApplyModal(item)}
                  className="w-full py-3 rounded-lg bg-primary text-foreground text-[11px] font-bold"
                >
                  Nộp đơn ngay
                </Button>
              </div>
            </Card>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-6">
              <Button
                onClick={handleLoadMore}
                disabled={loadingMore}
                variant="outline"
                className="rounded-full"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {loadingMore ? 'Đang tải...' : 'Tải thêm học bổng'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="Không tìm thấy học bổng nào"
          description="Thử điều chỉnh từ khóa hoặc bộ lọc của bạn."
        />
      )}
    </ContentShell>
  );
}
