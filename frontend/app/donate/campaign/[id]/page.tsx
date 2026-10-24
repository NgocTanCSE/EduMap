"use client";
import React, { useEffect, useState } from 'react';
import { avatarFallback, onImageError } from '@/src/lib/illustrations';
import { Users, Calendar, Share2, ShieldCheck, ArrowRight, MessageCircle, Loader2 } from 'lucide-react';
import { donateService, DonationCampaign } from '@/src/services/donate.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import Thumb from '@/components/ui/Thumb';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DonationDetailPage({ params }: { params: { id: string } }) {
    const campaignId = params.id;

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
      const [campaignData, donorsData] = await Promise.all([
        donateService.getCampaignById(campaignId),
        donateService.getDonorsByCampaignId(campaignId),
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">404</h1>
        <p className="text-muted-foreground/60 mb-8">Không tìm thấy chiến dịch quyên góp này.</p>
        <button
          onClick={() => (window.location.href = '/donate')}
          className="px-6 py-2.5 rounded-full bg-primary font-medium hover:bg-primary/80"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const progress = Math.min(100, Math.round((campaign.current_amount / campaign.target_amount) * 100)) || 0;
  const formattedEndDate = campaign.end_date
    ? new Date(campaign.end_date).toLocaleDateString('vi-VN')
    : 'Không giới hạn';

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
    <div className="min-h-screen bg-background text-foreground py-8">
      <div className="w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left: Campaign Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="rounded-xl overflow-hidden border border-border aspect-video relative">
            {/* Branded placeholder — no Unsplash stock image */}
            <Thumb src={undefined} alt={campaign.title} aspect="16/10" />
            <div className="absolute bottom-6 left-6 right-6">
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold mb-3 inline-block ${
                  campaign.status === 'active' ? 'bg-accent text-foreground' : 'bg-destructive text-foreground'
                }`}
              >
                {campaign.status === 'active' ? 'ĐANG DIỄN RA' : 'ĐÃ KẾT THÚC'}
              </span>
              <h1 className="text-2xl font-semibold text-foreground">{campaign.title}</h1>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            <h2 className="text-xl font-semibold">Về chiến dịch này</h2>
            <p className="text-foreground/60 leading-relaxed">
              {campaign.description || 'Chưa có mô tả chi tiết cho chiến dịch này.'}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-primary/70" />
                Người đóng góp gần đây ({donors.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {donors.length > 0 ? (
                donors.map(donation => (
                  <div
                    key={donation.id}
                    className="flex justify-between items-center p-4 rounded-xl bg-card border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                        <img
                          src={donation.donor?.avatar_url || avatarFallback(donation.donor?.fullName || donation.donor?.full_name)}
                          onError={onImageError(avatarFallback(donation.donor?.fullName || donation.donor?.full_name))}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{donation.donor?.fullName || 'Nhà hảo tâm ẩn danh'}</p>
                        <p className="text-[10px] text-muted-foreground/40">
                          {formatTimeAgo(donation.created_at)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-primary/70">
                      {Number(donation.amount).toLocaleString()} VNĐ
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground/40 py-4 text-sm">
                  Chưa có lượt đóng góp nào. Hãy là người đầu tiên!
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Donation Card */}
        <div className="space-y-6">
          <Card className="p-6 sticky top-8">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-3xl font-bold">
                    {(campaign.current_amount / 1000000).toFixed(1)}tr
                  </span>
                  <span className="text-sm text-muted-foreground/40">
                    Mục tiêu: {(campaign.target_amount / 1000000).toFixed(1)}tr
                  </span>
                </div>
                <div className="h-4 w-full bg-foreground/10 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-primary/70 font-bold uppercase tracking-wider">
                    {progress}% hoàn thành
                  </span>
                  <span className="text-[10px] text-muted-foreground/40">
                    {donors.length} lượt đóng góp
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[100000, 500000, 1000000].map(val => (
                  <button
                    key={val}
                    onClick={() => handleDonation(val)}
                    disabled={submitting || campaign.status !== 'active'}
                    className="py-3 rounded-xl border border-border hover:border-primary/50 transition-colors text-xs font-bold disabled:opacity-50"
                  >
                    {(val / 1000).toLocaleString()}k
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder="Số tiền khác (VNĐ)..."
                  className="w-full bg-card border border-border rounded-xl py-3 px-4 text-sm focus:border-primary outline-none text-primary"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={e => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-card focus:ring-primary"
                  />
                  <span className="text-[10px] text-muted-foreground/50">
                    Quyên góp ẩn danh
                  </span>
                </label>
              </div>

              <button
                onClick={() => handleDonation()}
                disabled={submitting || campaign.status !== 'active'}
                className="w-full py-4 rounded-xl bg-primary hover:bg-primary/80 text-foreground font-bold transition-colors disabled:bg-card disabled:text-muted-foreground/40 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {campaign.status === 'active' ? 'QUYÊN GÓP NGAY' : 'CHIẾN DỊCH ĐÃ ĐÓNG'}
              </button>

              <div className="flex items-center gap-2 justify-center text-[10px] text-muted-foreground/40 pt-2 border-t border-border">
                <ShieldCheck className="w-3 h-3" />
                <span>Giao dịch bảo mật bởi EduMap Secure</span>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-border space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/60">Hạn chót:</span>
                <span className="font-medium">{formattedEndDate}</span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-3 rounded-xl bg-card border border-border text-xs font-bold flex items-center justify-center gap-2 hover:bg-foreground/5 transition-colors">
                  <Share2 className="w-4 h-4" /> Chia sẻ
                </button>
                <BookmarkButton targetType="donate_campaign" targetId={campaign.id} size="sm" />
                <button className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
