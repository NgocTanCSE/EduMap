"use client";
import React, { useEffect, useState, use } from 'react';
import { Target, MapPin, Calendar, Users, ArrowLeft, Loader2, Share2, Compass, Tag } from 'lucide-react';
import { opportunityService, Opportunity } from '@/src/services/opportunity.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import Link from 'next/link';

export default function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const oppId = resolvedParams.id;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (oppId) {
      fetchOpportunity();
    }
  }, [oppId]);

  const fetchOpportunity = async () => {
    try {
      setLoading(true);
      const data = await opportunityService.getOpportunityById(oppId);
      setOpportunity(data);
    } catch (error: any) {
      toast.error('Không thể tải chi tiết cơ hội');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTeam = async () => {
      if (!authService.isLoggedIn()) {
          toast.error('Vui lòng đăng nhập để sử dụng tính năng này');
          return;
      }
      try {
          setToggling(true);
          const updated = await opportunityService.toggleTeamFinding(oppId);
          setOpportunity(updated);
          toast.success(updated.is_team_finding_open ? 'Đã BẬT tìm đồng đội' : 'Đã TẮT tìm đồng đội');
      } catch (error: any) {
          toast.error(error.message);
      } finally {
          setToggling(false);
      }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-white/60 mb-8">Không tìm thấy cơ hội này.</p>
        <Link href="/opportunities" className="px-8 py-3 rounded-full bg-orange-600 font-bold hover:bg-orange-500 transition-all">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <Link href="/opportunities" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-bold w-fit">
          <ArrowLeft className="w-4 h-4" /> QUAY LẠI
        </Link>

        <div className="bg-card border border-white/10 rounded-[40px] p-8 md:p-12 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[80px] rounded-full -mr-10 -mt-10 pointer-events-none" />
            
            <div className="relative z-10 space-y-6">
                <div className="flex justify-between items-start mb-2">
                    <span className="px-4 py-2 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest border border-orange-500/30">
                        {opportunity.category}
                    </span>
                    <button className="p-3 bg-zinc-900 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                        <Share2 className="w-5 h-5 text-white/60" />
                    </button>
                </div>
                
                <h1 className="text-3xl md:text-5xl font-black leading-tight">{opportunity.title}</h1>
                
                <div className="flex flex-wrap gap-4 text-sm text-white/60 pt-4 border-t border-white/5">
                    <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-400" /> {opportunity.address || 'Trực tuyến'}</span>
                    <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-400" /> Hạn chót: {opportunity.deadline ? new Date(opportunity.deadline).toLocaleDateString('vi-VN') : 'Không có'}</span>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
                <div className="bg-card border border-white/5 rounded-3xl p-8">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Compass className="w-5 h-5 text-orange-500"/> Chi tiết cơ hội
                    </h2>
                    <div className="prose prose-invert max-w-none text-white/70 leading-relaxed whitespace-pre-wrap">
                        {opportunity.description}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-gradient-to-b from-blue-900/20 to-transparent border border-blue-500/20 rounded-3xl p-6 text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto border border-blue-500/30">
                        <Users className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-bold mb-2">Tìm Đồng Đội</h3>
                        <p className="text-xs text-white/60 mb-6">Bạn có muốn mở tín hiệu để các học sinh khác tìm thấy và mời bạn vào nhóm không?</p>
                        
                        <button 
                            onClick={handleToggleTeam}
                            disabled={toggling}
                            className={`w-full py-4 rounded-xl font-bold text-sm transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 ${
                                opportunity.is_team_finding_open 
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' 
                                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                            }`}
                        >
                            {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {opportunity.is_team_finding_open ? 'TẮT TÌM ĐỒNG ĐỘI' : 'BẬT TÌM ĐỒNG ĐỘI'}
                        </button>
                    </div>
                </div>

                {opportunity.tags && opportunity.tags.length > 0 && (
                    <div className="bg-card border border-white/5 rounded-3xl p-6">
                        <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-white/40"/> Thẻ phân loại</h3>
                        <div className="flex flex-wrap gap-2">
                            {opportunity.tags.map((tag, i) => (
                                <span key={i} className="px-3 py-1 bg-zinc-900 border border-white/10 rounded-lg text-xs text-white/60">#{tag}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}
