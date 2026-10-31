"use client";
import React, { useEffect, useState } from 'react';
import { 
  Sun, MapPin, Calendar, Users, Loader2, CheckCircle2,
  TrendingUp, Activity, Leaf, ShieldCheck, HeartHandshake, ArrowRight
} from 'lucide-react';
import { summerService, SummerCampaign } from '@/src/services/summer.service';
import { authService } from '@/src/services/auth.service';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import Pagination from '@/components/ui/Pagination';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SummerCampaignsPage() {
  const [campaigns, setCampaigns] = useState<SummerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Report Modal States
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<SummerCampaign | null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const data = await summerService.getCampaigns();
      setCampaigns((data as any).data || (Array.isArray(data) ? data : []) || []);
    } catch {
      toast.error('Không thể tải danh sách chiến dịch');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (id: string) => {
      if (!authService.isLoggedIn()) {
          toast.error('Vui lòng đăng nhập để đăng ký');
          window.location.href = '/auth/login?redirect=/summer';
          return;
      }
      try {
          setRegisteringId(id);
          const result = await summerService.registerVolunteer(id);
          toast.success(result.message || 'Đăng ký tham gia thành công!');
      } catch (error: any) {
          toast.error(error.message || 'Lỗi đăng ký');
      } finally {
          setRegisteringId(null);
      }
  };

  const handleViewReport = async (campaign: SummerCampaign) => {
      setSelectedCampaign(campaign);
      setShowReportModal(true);
      fetchReport(campaign.id, reportDate);
  };

  const fetchReport = async (id: string, date: string) => {
      try {
          setLoadingReport(true);
          const data = await summerService.getDailyReport(id, date);
          setReportData((data as any)?.data ?? data);
      } catch {
          toast.error('Lỗi khi tải báo cáo');
      } finally {
          setLoadingReport(false);
      }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDate = e.target.value;
      setReportDate(newDate);
      if (selectedCampaign) {
          fetchReport(selectedCampaign.id, newDate);
      }
  };

  const paginatedCampaigns = campaigns.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] w-full lg:min-h-screen bg-background text-foreground">
      {/* Report Modal */}
      {showReportModal && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto scrollbar-hide shadow-xl">
            <button onClick={() => setShowReportModal(false)} className="absolute top-5 right-5 rounded-lg p-1 text-muted-foreground/60 hover:text-foreground">
              ✕
            </button>
            <h3 className="text-xl font-bold mb-1 flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Báo cáo Hoạt động Chiến Dịch</h3>
            <p className="text-xs text-primary font-bold mb-5 truncate">{selectedCampaign.name}</p>
            
            <div className="mb-5 flex items-center gap-3 bg-muted/40 p-3 rounded-xl border border-border/60">
              <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">Chọn ngày:</label>
              <Input
                type="date"
                value={reportDate}
                onChange={handleDateChange}
                className="h-9 text-xs"
              />
            </div>

            {loadingReport ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
            ) : reportData ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-muted/40 border border-border rounded-xl">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Tình nguyện viên đang hoạt động</p>
                    <p className="text-2xl font-bold text-primary">{reportData.total_volunteers_active || 0}</p>
                  </div>
                  <div className="p-4 bg-muted/40 border border-border rounded-xl">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Tiến độ nhiệm vụ</p>
                    <p className="text-2xl font-bold text-accent">{reportData.completed_percentage || '0%'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3 pb-2 border-b border-border">Hoạt động trong ngày</h4>
                  <div className="space-y-2.5">
                    {reportData.activities && reportData.activities.length > 0 ? (
                      reportData.activities.map((act: any, idx: number) => (
                        <div key={idx} className="p-3 bg-card border border-border/80 rounded-xl flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-foreground mb-0.5">{act.type}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                              <span>{act.hours} Giờ</span>
                              <span>•</span>
                              <span className="flex items-center gap-1"><Users className="w-3 h-3"/> {act.volunteers} TNV</span>
                            </p>
                          </div>
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-md border border-primary/20">{act.status}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic text-center py-4">Chưa có nhật ký hoạt động nào cho ngày này.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-muted-foreground">Không có dữ liệu báo cáo cho ngày này.</div>
            )}
          </div>
        </div>
      )}

      {/* Full width container using full website dimensions */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-card p-6 sm:p-8 rounded-2xl border border-border/80 shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-3">
              <Sun className="w-3.5 h-3.5" /> Chiến Dịch Tình Nguyện
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Chiến Dịch Mùa Hè Xanh</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Chiến dịch thanh niên tình nguyện tham gia phát triển cộng đồng, phổ cập kiến thức, dạy học và nâng cấp cơ sở vật chất tại các vùng khó khăn tại Đồng Nai.
            </p>
          </div>
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Sun className="w-32 h-32" />
          </div>
        </div>

        {/* Campaigns Grid - 1 hàng 4 card gọn gàng */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-9 h-9 text-primary animate-spin" /></div>
        ) : campaigns.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedCampaigns.map(camp => (
                <div key={camp.id} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm hover:shadow-md transition-all hover:border-primary/50 flex flex-col justify-between group relative">
                  <div className="absolute top-3.5 right-3.5 z-10">
                    <BookmarkButton targetType="summer" targetId={camp.id} size="sm" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3 pr-8">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        camp.status === 'active'
                          ? 'bg-accent/15 text-accent border-accent/25'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {camp.status === 'active' ? 'Đang tuyển quân' : 'Đã kết thúc'}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">{camp.year}</span>
                    </div>

                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 min-h-[3rem] mb-2">
                      {camp.name}
                    </h3>

                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">Địa bàn: <strong className="text-foreground/90 font-medium">{camp.location}</strong></span>
                    </p>

                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                      {camp.description || 'Chiến dịch tình nguyện chung tay xây dựng cộng đồng và hỗ trợ các em nhỏ vùng sâu vùng xa.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border/80 flex gap-2">
                    <button
                      onClick={() => handleViewReport(camp)}
                      className="flex-1 py-2 px-2.5 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-xs font-bold transition-all text-center flex items-center justify-center gap-1"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-primary" /> Báo cáo
                    </button>
                    <button
                      onClick={() => handleRegister(camp.id)}
                      disabled={registeringId === camp.id || camp.status !== 'active'}
                      className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                        camp.status === 'active'
                          ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm'
                          : 'bg-muted text-muted-foreground opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {registeringId === camp.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <HeartHandshake className="w-3.5 h-3.5" />
                      )}
                      <span>{camp.status === 'active' ? 'Đăng ký' : 'Đã đóng'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {campaigns.length > pageSize && (
              <div className="pt-6">
                <Pagination
                  currentPage={page}
                  totalPages={Math.ceil(campaigns.length / pageSize)}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-card border border-dashed border-border rounded-2xl">
            <Sun className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Hiện tại chưa có chiến dịch Mùa hè xanh nào.</p>
          </div>
        )}
      </div>
    </div>
  );
}
