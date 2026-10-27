"use client";
import React, { useEffect, useState } from 'react';
import { 
  Sun, MapPin, Calendar, Users, Loader2, CheckCircle2,
  TrendingUp, Activity, Leaf, ShieldCheck, HeartHandshake
} from 'lucide-react';
import { summerService, SummerCampaign } from '@/src/services/summer.service';
import { authService } from '@/src/services/auth.service';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SummerCampaignsPage() {
  const [campaigns, setCampaigns] = useState<SummerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);

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
      // Unwrap backend { success, data: [...] } wrapper if present
      setCampaigns((data as any).data || (Array.isArray(data) ? data : []) || []);
    } catch (error: any) {
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
          toast.success(result.message);
      } catch (error: any) {
          toast.error(error.message);
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
      } catch (error: any) {
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

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] w-full lg:min-h-screen">
      {/* Report Modal */}
      {showReportModal && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-xl p-8 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto scrollbar-hide">
            <button onClick={() => setShowReportModal(false)} className="absolute top-4 right-4 rounded-lg p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors">
              <Calendar className="w-4 h-4 rotate-90" />
            </button>
            <h3 className="h2-section mb-2 flex items-center gap-2"><Activity className="w-6 h-6 text-primary" /> Báo cáo Hoạt động</h3>
            <p className="text-sm text-primary font-bold mb-6">{selectedCampaign.name}</p>
            
            <div className="mb-6 flex items-center gap-4">
              <label className="text-sm font-bold text-muted-foreground/60">Chọn ngày:</label>
              <Input
                type="date"
                value={reportDate}
                onChange={handleDateChange}
              />
            </div>

            {loadingReport ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
            ) : reportData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-card border border-border rounded-lg">
                    <p className="label-pill text-muted-foreground/60 mb-1">Tình nguyện viên</p>
                    <p className="text-2xl font-semibold text-primary">{reportData.total_volunteers_active}</p>
                  </div>
                  <div className="p-4 bg-card border border-border rounded-lg">
                    <p className="label-pill text-muted-foreground/60 mb-1">Tiến độ chung</p>
                    <p className="text-2xl font-semibold text-primary">{reportData.completed_percentage}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm mb-4 border-b border-border pb-2">Hoạt động chi tiết</h4>
                  <div className="space-y-3">
                    {reportData.activities?.map((act: any, idx: number) => (
                      <div key={idx} className="p-4 bg-card/40 rounded-xl border border-border flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm mb-1">{act.type}</p>
                          <p className="text-xs text-muted-foreground/60 flex items-center gap-3">
                            <span>{act.hours} Giờ</span>
                            <span className="flex items-center gap-1"><Users className="w-3 h-3"/> {act.volunteers} TNV</span>
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg border border-accent/20">{act.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground/60">Không có dữ liệu báo cáo cho ngày này.</div>
            )}
          </div>
        </div>
      )}

      <div className="page-shell">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-card p-6 sm:p-8 rounded-xl border border-border relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="h1-page mb-4">Mùa Hè Xanh</h1>
            <p className="text-muted-foreground/60 max-w-xl leading-relaxed">
              Chiến dịch thanh niên tình nguyện tham gia phát triển cộng đồng, dạy học và cải thiện cơ sở hạ tầng tại các vùng khó khăn.
            </p>
          </div>
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Sun className="w-24 h-24" />
          </div>
        </div>

        {/* Campaigns List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>
        ) : campaigns.length > 0 ? (
          <div className="space-y-6">
            {campaigns.map(camp => (
              <div key={camp.id} className="bg-card border border-border rounded-xl p-6 sm:p-8 hover:border-accent/30 transition-all group flex flex-col h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[40px] rounded-full -mr-10 -mt-10" />
                <BookmarkButton targetType="summer" targetId={camp.id} size="sm" className="absolute top-3 right-3 z-10" />
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <span className="label-pill px-3 py-1 rounded-full border bg-primary/20 text-primary border-accent/30">
                    {camp.status === 'active' ? 'ĐANG TUYỂN QUÂN' : 'ĐÃ KẾT THÚC'}
                  </span>
                  <span className="text-2xl font-semibold text-muted-foreground/10">{camp.year}</span>
                </div>
                
                <h3 className="h3-card mb-3 group-hover:text-primary transition-colors relative z-10 line-clamp-2">{camp.name}</h3>
                <p className="text-sm text-muted-foreground/60 mb-6 flex-1 relative z-10 line-clamp-3">
                  {camp.description || 'Chiến dịch tình nguyện chung tay xây dựng cộng đồng và hỗ trợ các em nhỏ vùng sâu vùng xa.'}
                </p>
                
                <div className="space-y-3 pt-4 border-t border-border relative z-10 mb-6">
                  <div className="flex items-center gap-3 text-xs text-foreground/70">
                    <MapPin className="w-4 h-4 text-primary" />
                    Địa bàn: <strong className="text-foreground">{camp.location}</strong>
                  </div>
                </div>
                
                <div className="flex gap-3 relative z-10">
                  <Button
                    onClick={() => handleViewReport(camp)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <TrendingUp className="w-4 h-4 text-primary mr-1" /> XEM BÁO CÁO
                  </Button>
                  <Button
                    onClick={() => handleRegister(camp.id)}
                    disabled={registeringId === camp.id || camp.status !== 'active'}
                    loading={registeringId === camp.id}
                    icon={<HeartHandshake className="w-4 h-4" />}
                    loadingText="ĐANG ĐĂNG KÝ..."
                    className="flex-1 bg-accent hover:bg-primary text-accent-foreground shadow-lg shadow-accent/20"
                  >
                    {camp.status === 'active' ? 'ĐĂNG KÝ THAM GIA' : 'ĐÃ ĐÓNG'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl">
            <Sun className="w-12 h-12 text-muted-foreground/10 mx-auto mb-4" />
            <p className="text-muted-foreground/60">Hiện tại chưa có chiến dịch Mùa hè xanh nào.</p>
          </div>
        )}

      </div>
    </div>
  );
}
