"use client";
import React, { useEffect, useState, use } from 'react';
import { Heart, Users, Target, Calendar, Share2, ShieldCheck, ArrowRight, MessageCircle, Loader2 } from 'lucide-react';
import { donateService, DonationCampaign } from '@/src/services/donate.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';

export default function DonationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Use React.use() to unwrap params in Next.js 15+
  const resolvedParams = use(params);
  const campaignId = resolvedParams.id;
  
  const [campaign, setCampaign] = useState<DonationCampaign | null>(null);
  const [donors, setDonors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const isLoggedIn = authService.isLoggedIn();

  useEffect(() => {
    if (campaignId) {
      fetchData();
    }
  }, [campaignId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch both campaign info and donors in parallel for efficiency
      const [campaignData, donorsData] = await Promise.all([
        donateService.getCampaignById(campaignId),
        donateService.getDonorsByCampaignId(campaignId)
      ]);
      
      setCampaign(campaignData);
      setDonors(donorsData);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải thông tin chiến dịch');
    } finally {
      setLoading(false);
    }
  };

  const handleDonation = async (amountToDonate?: number) => {
    const amount = amountToDonate || Number(customAmount.replace(/[^0-9]/g, ''));

    if (!amount || amount <= 0) {
      toast.error('Vui lòng nhập số tiền quyên góp hợp lệ');
      return;
    }

    try {
      setSubmitting(true);
      const result = await donateService.processDonation(campaignId, amount, isAnonymous);
      
      toast.success(result.message || 'Quyên góp thành công! Cảm ơn bạn.');
      
      // Refresh data to show updated progress and new donor in list
      fetchData();
      setCustomAmount('');
    } catch (error: any) {
      toast.error(error.message || 'Có lỗi xảy ra trong quá trình quyên góp');
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

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-white/60 mb-8">Không tìm thấy chiến dịch quyên góp này.</p>
        <button 
          onClick={() => window.location.href = '/donate'}
          className="px-8 py-3 rounded-full bg-yellow-600 font-bold hover:bg-yellow-500 transition-all"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const progress = Math.min(100, Math.round((campaign.current_amount / campaign.target_amount) * 100)) || 0;
  const formattedEndDate = campaign.end_date ? new Date(campaign.end_date).toLocaleDateString('vi-VN') : 'Không giới hạn';

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'Vừa xong';
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} giờ trước`;
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Left: Campaign Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="rounded-[40px] overflow-hidden border border-white/10 aspect-video relative group">
            <img src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=1200" alt={campaign.title} className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <span className={`px-4 py-2 rounded-full text-xs font-bold mb-4 inline-block ${campaign.status === 'active' ? 'bg-green-600' : 'bg-red-600'}`}>
                {campaign.status === 'active' ? 'ĐANG DIỄN RA' : 'ĐÃ KẾT THÚC'}
              </span>
              <h1 className="text-4xl font-bold leading-tight">{campaign.title}</h1>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            <h2 className="text-2xl font-bold">Về chiến dịch này</h2>
            <p className="text-white/60 leading-relaxed">
              {campaign.description || 'Chưa có mô tả chi tiết cho chiến dịch này.'}
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-card border border-white/10">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
               <Users className="w-5 h-5 text-yellow-400" />
               Người đóng góp gần đây ({donors.length})
            </h3>
            <div className="space-y-4">
               {donors.length > 0 ? (
                 donors.map(donation => (
                   <div key={donation.id} className="flex justify-between items-center p-4 rounded-2xl bg-card border border-white/5">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full overflow-hidden bg-yellow-500/20 flex items-center justify-center">
                            {donation.donor?.avatar_url ? (
                                <img src={donation.donor.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <Heart className="w-5 h-5 text-yellow-400" />
                            )}
                         </div>
                         <div>
                            <p className="text-sm font-bold">{donation.donor?.fullName || 'Nhà hảo tâm ẩn danh'}</p>
                            <p className="text-[10px] text-white/40">{formatTimeAgo(donation.created_at)}</p>
                         </div>
                      </div>
                      <p className="text-sm font-mono text-yellow-400">{Number(donation.amount).toLocaleString()} VNĐ</p>
                   </div>
                 ))
               ) : (
                 <p className="text-center text-white/40 py-4 text-sm">Chưa có lượt đóng góp nào. Hãy là người đầu tiên!</p>
               )}
            </div>
            {donors.length > 5 && (
                <button className="w-full mt-6 py-3 text-sm text-white/40 hover:text-white transition-colors flex items-center justify-center gap-2">
                    Xem tất cả đóng góp <ArrowRight className="w-4 h-4" />
                </button>
            )}
          </div>
        </div>

        {/* Right: Donation Card */}
        <div className="space-y-6">
          <div className="p-8 rounded-[40px] bg-card border border-white/10 sticky top-8">
            <div className="space-y-6">
               <div>
                  <div className="flex justify-between items-end mb-2">
                     <span className="text-3xl font-bold">{(campaign.current_amount / 1000000).toFixed(1)}tr</span>
                     <span className="text-sm text-white/40">Mục tiêu: {(campaign.target_amount / 1000000).toFixed(1)}tr</span>
                  </div>
                  <div className="h-4 w-full bg-card rounded-full overflow-hidden border border-white/5">
                     <div className="h-full bg-gradient-to-r from-yellow-600 to-purple-600 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between mt-2">
                     <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">{progress}% hoàn thành</span>
                     <span className="text-[10px] text-white/40">{donors.length} lượt đóng góp</span>
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-2">
                  {[100000, 500000, 1000000].map(val => (
                    <button 
                      key={val} 
                      onClick={() => handleDonation(val)}
                      disabled={submitting || campaign.status !== 'active'}
                      className="py-3 rounded-xl border border-white/10 hover:border-yellow-500 transition-all text-xs font-bold disabled:opacity-50"
                    >
                      {(val / 1000).toLocaleString()}k
                    </button>
                  ))}
               </div>

               <div className="space-y-2">
                  <input 
                    type="text" 
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Số tiền khác (VNĐ)..." 
                    className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 px-6 text-sm focus:border-yellow-500 outline-none text-yellow-500" 
                  />
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-4 h-4 rounded border-white/10 bg-zinc-900 checked:bg-yellow-600 focus:ring-yellow-600"
                    />
                    <span className="text-[10px] text-white/40 group-hover:text-white/60 transition-colors">Quyên góp ẩn danh</span>
                  </label>
               </div>

               <button 
                onClick={() => handleDonation()}
                disabled={submitting || campaign.status !== 'active'}
                className="w-full py-5 rounded-[24px] bg-yellow-600 hover:bg-yellow-500 text-white font-bold transition-all shadow-xl shadow-yellow-600/20 disabled:bg-zinc-700 disabled:shadow-none flex items-center justify-center gap-2"
               >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {campaign.status === 'active' ? 'QUYÊN GÓP NGAY' : 'CHIẾN DỊCH ĐÃ ĐÓNG'}
               </button>

               <div className="flex items-center gap-2 justify-center text-[10px] text-white/40">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Giao dịch bảo mật bởi EduMap Secure</span>
               </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
               <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Hạn chót:</span>
                  <span className="font-medium">{formattedEndDate}</span>
               </div>
               <div className="flex gap-2">
                  <button className="flex-1 py-3 rounded-xl bg-card border border-white/10 text-xs font-bold flex items-center justify-center gap-2">
                     <Share2 className="w-4 h-4" /> Chia sẻ
                  </button>
                  <button className="w-12 h-12 rounded-xl bg-card border border-white/10 flex items-center justify-center">
                     <MessageCircle className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
