"use client";
import React, { useEffect, useState } from 'react';
import { Heart, Target, Users, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { donateService, DonationCampaign } from '@/src/services/donate.service';
import { toast } from 'sonner';
import Link from 'next/link';

export default function DonationListPage() {
  const [campaigns, setCampaigns] = useState<DonationCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const data = await donateService.getAllCampaigns();
      setCampaigns(data);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải danh sách chiến dịch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center space-y-4 py-12">
           <h1 className="text-5xl font-black tracking-tight">Quyên góp & Đồng hành</h1>
           <p className="text-white/40 max-w-2xl mx-auto">
             Mỗi đóng góp của bạn, dù nhỏ nhất, đều góp phần xây dựng tương lai bền vững cho cộng đồng EduMap.
           </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {campaigns.map(campaign => {
              const progress = Math.min(100, Math.round((campaign.current_amount / campaign.target_amount) * 100)) || 0;
              return (
                <Link href={`/donate/campaign/${campaign.id}`} key={campaign.id} className="group">
                  <div className="bg-card border border-white/10 rounded-[40px] overflow-hidden hover:border-yellow-500/50 transition-all flex flex-col h-full shadow-xl">
                    <div className="aspect-video relative overflow-hidden">
                       <img 
                         src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=800" 
                         alt={campaign.title} 
                         className="w-full h-full object-cover transition-transform group-hover:scale-110 opacity-70"
                       />
                       <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                    </div>
                    <div className="p-8 flex-1 flex flex-col">
                      <h3 className="text-xl font-bold mb-4 line-clamp-2">{campaign.title}</h3>
                      <p className="text-white/40 text-sm mb-6 line-clamp-3 flex-1">{campaign.description}</p>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <span className="text-lg font-bold">{(campaign.current_amount / 1000000).toFixed(1)}tr</span>
                          <span className="text-xs text-white/40">Mục tiêu: {(campaign.target_amount / 1000000).toFixed(1)}tr</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                           <div className="h-full bg-yellow-500" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-yellow-500">{progress}% hoàn thành</span>
                          <span className="text-white/40">Sắp kết thúc</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
