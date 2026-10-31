"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GraduationCap, MapPin, DollarSign, Clock,
  CheckCircle2, AlertTriangle, Loader2, FileText, UploadCloud, X,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { scholarshipService, Scholarship, EligibilityResponse } from '@/src/services/scholarship.service';
import FileUpload from '@/src/components/ui/FileUpload';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import Pagination from '@/components/ui/Pagination';
import ContentShell from '@/components/ui/ContentShell';
import SectionHeader from '@/components/ui/SectionHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Skeleton from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { DetailPopup } from '@/components/ui/DetailPopup';

export default function ScholarshipPage() {
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();

  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [eligibilityResult, setEligibilityResult] = useState<{ [key: string]: EligibilityResponse }>({});

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState<Scholarship | null>(null);
  const [selectedScholarshipDetail, setSelectedScholarshipDetail] = useState<Scholarship | null>(null);
  const [personalStatement, setPersonalStatement] = useState('');
  const [cvUrl, setCvUrl] = useState('');
  const [cvUploading, setCvUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfTranscript, setPdfTranscript] = useState<{
    gpa: number | null;
    overall_grade: string | null;
    courses: any[];
    student_name: string | null;
  } | null>(null);

  useEffect(() => {
    fetchScholarships(1);
  }, []);

  const fetchScholarships = async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      const data: any = await scholarshipService.getScholarships(pageNum, 10);
      // Handle both wrapped ({success, data:{items,meta}}) and direct ({items,meta})
      const payload = data.data ?? data;
      const items = payload.items || (Array.isArray(payload) ? payload : []) || [];
      const meta = payload.meta || {};
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
      const result = await scholarshipService.checkEligibility(scholarshipId, pdfTranscript);
      setEligibilityResult(prev => ({ ...prev, [scholarshipId]: result }));
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi kiểm tra hồ sơ');
    } finally {
      setCheckingId(null);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('pdf') && file.type !== 'application/pdf') {
      toast.error('Vui lòng tải lên file PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File PDF quá lớn (giới hạn 10MB).');
      return;
    }

    setPdfUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = authService.getAccessToken();
      const res = await fetch('/api/ai/pdf-transcript', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.message || 'Lỗi trích xuất PDF');

      const parsed = data.parsed;
      if (parsed) {
        setPdfTranscript({
          gpa: parsed.gpa,
          overall_grade: parsed.overall_grade,
          courses: parsed.courses || [],
          student_name: parsed.student_name,
        });
        toast.success(`Đã đọc bảng điểm: GPA ${parsed.gpa ?? 'N/A'} — ${parsed.overall_grade || 'Chưa xác định'}`);
      } else {
        setPdfTranscript(null);
        toast('PDF đã được tải lên nhưng chưa tự động trích xuất GPA. Bạn vẫn có thể dùng dữ liệu thủ công.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải lên PDF');
      console.error(err);
    } finally {
      setPdfUploading(false);
      e.target.value = '';
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

  const paginatedScholarships = filteredScholarships.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <ContentShell>
      {/* Application Modal */}
      {showApplyModal && selectedScholarship && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-xl p-8 max-w-2xl w-full shadow-lg relative">
            <button
              onClick={() => setShowApplyModal(false)}
              className="absolute top-6 right-6 text-muted-foreground/60 hover:text-foreground"
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
                  <div className="text-xs text-muted-foreground/60">Hoặc tải CV lên máy chủ (PDF, DOC, DOCX - tối đa 10MB):</div>
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
                className="w-full py-4 mt-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {submitting ? 'ĐANG GỬI HỒ SƠ...' : 'XÁC NHẬN NỘP ĐƠN'}
              </button>
              <p className="text-[10px] text-center text-muted-foreground/60 mt-2">
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

      {/* PDF Transcript Upload Section */}
      <div className="mb-6 p-4 bg-card/50 border border-border rounded-xl">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Tải lên bảng điểm (PDF) để tự động kiểm tra học bổng
        </h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors text-sm font-medium">
            <UploadCloud className="w-4 h-4 text-primary" />
            {pdfUploading ? 'Đang xử lý...' : 'Chọn file PDF'}
            <input
              type="file"
              accept="application/pdf"
              onChange={handlePdfUpload}
              disabled={pdfUploading}
              className="hidden"
            />
          </label>
          {pdfUploading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          {pdfTranscript && (
            <div className="text-xs text-foreground/60">
              GPA: <span className="font-bold text-primary">{pdfTranscript.gpa ?? 'N/A'}</span> |
              Xếp loại: <span className="font-bold text-accent">{pdfTranscript.overall_grade || 'N/A'}</span>
              {pdfTranscript.courses.length > 0 && ` | ${pdfTranscript.courses.length} môn học`}
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-2">Hỗ trợ PDF bảng điểm máy tính (text-based). File scan/OCR sẽ được cập nhật trong phiên bản sau.</p>
      </div>

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
                  ? 'bg-primary border-primary text-primary-foreground'
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedScholarships.map(item => (
              <Card
                key={item.id}
                className="group flex h-full flex-col justify-between rounded-[22px] border border-border/80 bg-card p-5 shadow-orvel hover:shadow-pop transition-all hover:border-primary/50"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-[14px] bg-primary/10 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary shrink-0 shadow-xs">
                        {item.provider?.charAt(0) || 'S'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-primary font-semibold truncate">
                          {item.provider || 'Đang cập nhật'}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <MapPin className="w-3 h-3 text-primary" /> Toàn quốc
                        </span>
                      </div>
                    </div>
                    <BookmarkButton targetType="scholarships" targetId={item.id} size="sm" />
                  </div>

                  <h3
                    onClick={() => setSelectedScholarshipDetail(item)}
                    className="text-base font-bold line-clamp-2 text-foreground group-hover:text-primary transition-colors cursor-pointer leading-snug"
                  >
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-border/40 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">
                      <DollarSign className="w-3.5 h-3.5" />
                      {Number(item.value_amount).toLocaleString()} USD
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3 text-primary" />
                      {item.deadline && new Date(item.deadline).getTime() > 0
                        ? new Date(item.deadline).toLocaleDateString('vi-VN')
                        : 'Mở định kỳ'}
                    </span>
                  </div>

                  {eligibilityResult[item.id] && (
                    <div
                      className={`mt-3 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                        eligibilityResult[item.id].is_eligible
                          ? 'bg-accent/10 border-accent/20 text-accent'
                          : 'bg-primary/10 border-primary/20 text-primary'
                      }`}
                    >
                      {eligibilityResult[item.id].is_eligible ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      )}
                      <span className="font-medium text-[11px] leading-tight">
                        {eligibilityResult[item.id].message}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleCheckEligibility(item.id)}
                    disabled={checkingId === item.id}
                    variant="outline"
                    className="w-full py-2 h-9 rounded-xl text-[11px] font-bold"
                  >
                    {checkingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : 'Kiểm tra'}
                  </Button>
                  <Button
                    onClick={() => openApplyModal(item)}
                    className="w-full py-2 h-9 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90"
                  >
                    Nộp đơn
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {filteredScholarships.length > pageSize && (
            <div className="pt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredScholarships.length / pageSize)}
                onPageChange={(p: number) => {
                  setCurrentPage(p);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                totalItems={filteredScholarships.length}
                pageSize={pageSize}
              />
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="Không tìm thấy học bổng nào"
          description="Thử điều chỉnh từ khóa hoặc bộ lọc của bạn."
        />
      )}

      {/* Scholarship Detail Popup (replaces full-page redirect on card click) */}
      {selectedScholarshipDetail && (
        <DetailPopup
          open={!!selectedScholarshipDetail}
          onClose={() => setSelectedScholarshipDetail(null)}
          title={selectedScholarshipDetail.title}
          subtitle={selectedScholarshipDetail.provider || "Đang cập nhật"}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-sm">
            <p className="text-foreground/80 leading-relaxed">
              {selectedScholarshipDetail.description}
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent" />
                <span className="font-medium">Giá trị:</span>
                <span>{Number(selectedScholarshipDetail.value_amount).toLocaleString()} USD</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-medium">Hạn nộp:</span>
                <span>
                  {selectedScholarshipDetail.deadline &&
                  new Date(selectedScholarshipDetail.deadline).getTime() > 0
                    ? new Date(selectedScholarshipDetail.deadline).toLocaleDateString("vi-VN")
                    : "Xem trang chính thức"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="font-medium">Phạm vi:</span>
                <span>Toàn quốc</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <Button
                onClick={() => {
                  setSelectedScholarshipDetail(null);
                  openApplyModal(selectedScholarshipDetail);
                }}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold"
              >
                Nộp đơn ngay
              </Button>
            </div>

            {selectedScholarshipDetail.apply_url && (
              <div className="text-xs text-muted-foreground/60 pt-2 border-t border-border">
                <a
                  href={selectedScholarshipDetail.apply_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Nguồn chính thức ↗ <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </DetailPopup>
      )}
    </ContentShell>
  );
}
