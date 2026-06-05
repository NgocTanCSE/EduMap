"use client";
import React, { useEffect, useState } from 'react';
import { 
  Sun, MapPin, Calendar, Users, Loader2, CheckCircle2,
  TrendingUp, Activity, Leaf, ShieldCheck, HeartHandshake
} from 'lucide-react';
import { summerService, SummerCampaign } from '@/src/services/summer.service';
import { authService } from '@/src/services/auth.service';
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
      setCampaigns(data);
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
          setReportData(data);
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
    <div className="min-h-screen bg-[#050505] text-white p-8">
      
      {/* Report Modal */}
      {showReportModal && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#121215] border border-white/10 rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                <button onClick={() => setShowReportModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white">X</button>
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Activity className="w-6 h-6 text-green-500" /> Báo cáo Hoạt động</h3>
                <p className="text-sm text-green-400 font-bold mb-6">{selectedCampaign.name}</p>
                
                <div className="mb-6 flex items-center gap-4">
                    <label className="text-sm font-bold text-white/60">Chọn ngày:</label>
                    <input 
                        type="date" 
                        value={reportDate}
                        onChange={handleDateChange}
                        className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-green-500 outline-none" 
                    />
                </div>

                {loadingReport ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-green-500 animate-spin" /></div>
                ) : reportData ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl">
                                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Tình nguyện viên</p>
                                <p className="text-2xl font-black text-blue-400">{reportData.total_volunteers_active}</p>
                            </div>
                            <div className="p-4 bg-zinc-900 border border-white/5 rounded-2xl">
                                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Tiến độ chung</p>
                                <p className="text-2xl font-black text-green-400">{reportData.completed_percentage}</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm mb-4 border-b border-white/10 pb-2">Hoạt động chi tiết</h4>
                            <div className="space-y-3">
                                {reportData.activities?.map((act: any, idx: number) => (
                                    <div key={idx} className="p-4 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-sm mb-1">{act.type}</p>
                                            <p className="text-xs text-white/40 flex items-center gap-3">
                                                <span>{act.hours} Giờ</span>
                                                <span className="flex items-center gap-1"><Users className="w-3 h-3"/> {act.volunteers} TNV</span>
                                            </p>
                                        </div>
                                        <span className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold rounded-lg border border-green-500/20">{act.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10 text-white/40">Không có dữ liệu báo cáo cho ngày này.</div>
                )}
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-gradient-to-br from-green-600/20 to-blue-600/10 p-12 rounded-[40px] border border-white/5 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-black mb-4">Mùa Hè Xanh</h1>
            <p className="text-white/60 max-w-xl leading-relaxed">
              Chiến dịch thanh niên tình nguyện tham gia phát triển cộng đồng, dạy học và cải thiện cơ sở hạ tầng tại các vùng khó khăn.
            </p>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Sun className="w-64 h-64" />
          </div>
        </div>

        {/* Campaigns List */}
        <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Leaf className="text-green-500 w-6 h-6"/> Các chiến dịch đang diễn ra</h2>
            
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-green-500 animate-spin" /></div>
            ) : campaigns.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {campaigns.map(camp => (
                        <div key={camp.id} className="bg-card border border-white/10 rounded-[32px] p-8 hover:border-green-500/30 transition-all group flex flex-col h-full relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-[40px] rounded-full -mr-10 -mt-10" />
                            
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                                    camp.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-zinc-800 text-white/40 border-white/10'
                                }`}>
                                    {camp.status === 'active' ? 'ĐANG TUYỂN QUÂN' : 'ĐÃ KẾT THÚC'}
                                </span>
                                <span className="text-2xl font-black text-white/10">{camp.year}</span>
                            </div>
                            
                            <h3 className="text-2xl font-bold mb-3 group-hover:text-green-400 transition-colors relative z-10">{camp.name}</h3>
                            <p className="text-sm text-white/60 mb-6 flex-1 relative z-10 line-clamp-3">
                                {camp.description || 'Chiến dịch tình nguyện chung tay xây dựng cộng đồng và hỗ trợ các em nhỏ vùng sâu vùng xa.'}
                            </p>
                            
                            <div className="space-y-3 pt-4 border-t border-white/5 relative z-10 mb-6">
                                <div className="flex items-center gap-3 text-xs text-white/70">
                                    <MapPin className="w-4 h-4 text-green-500" />
                                    Địa bàn: <strong className="text-white">{camp.location}</strong>
                                </div>
                            </div>
                            
                            <div className="flex gap-3 relative z-10">
                                <button 
                                    onClick={() => handleViewReport(camp)}
                                    className="flex-1 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-bold transition-all flex justify-center items-center gap-2"
                                >
                                    <TrendingUp className="w-4 h-4 text-blue-400" /> XEM BÁO CÁO
                                </button>
                                <button 
                                    onClick={() => handleRegister(camp.id)}
                                    disabled={registeringId === camp.id || camp.status !== 'active'}
                                    className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {registeringId === camp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <HeartHandshake className="w-4 h-4" />} 
                                    {camp.status === 'active' ? 'ĐĂNG KÝ THAM GIA' : 'ĐÃ ĐÓNG'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                    <Sun className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40">Hiện tại chưa có chiến dịch Mùa hè xanh nào.</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
