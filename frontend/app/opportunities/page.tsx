"use client";
import React, { useEffect, useState } from 'react';
import { Target, Search, Filter, MapPin, Calendar, Users, ArrowRight, Loader2, Compass } from 'lucide-react';
import { opportunityService, Opportunity } from '@/src/services/opportunity.service';
import { toast } from 'sonner';
import Link from 'next/link';

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');

  useEffect(() => {
    fetchOpportunities();
  }, [activeCategory]);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const data = await opportunityService.getOpportunities(activeCategory || undefined);
      setOpportunities(data);
    } catch (error: any) {
      toast.error('Không thể tải danh sách cơ hội');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = opportunities.filter(opp => 
      opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold uppercase tracking-widest">
                <Compass className="w-4 h-4" /> Bản đồ Cơ hội
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Mở Rộng Giới Hạn</h1>
            <p className="text-white/60 leading-relaxed">
                Khám phá các khóa học miễn phí, cuộc thi, hoạt động ngoại khóa và tìm kiếm đồng đội để cùng nhau chinh phục thử thách.
            </p>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card border border-white/10 p-4 rounded-3xl sticky top-20 z-10 backdrop-blur-md">
            <div className="flex overflow-x-auto w-full md:w-auto gap-2 pb-2 md:pb-0 custom-scrollbar">
                {['', 'Cuộc thi', 'Khóa học', 'Hoạt động'].map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-6 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-orange-500 text-white' : 'bg-zinc-900 text-white/40 hover:text-white hover:bg-zinc-800 border border-white/5'}`}
                    >
                        {cat || 'Tất cả'}
                    </button>
                ))}
            </div>
            
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm..." 
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:border-orange-500 outline-none"
                />
            </div>
        </div>

        {/* Grid */}
        {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-orange-500 animate-spin" /></div>
        ) : filteredData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredData.map(opp => (
                    <div key={opp.id} className="bg-card border border-white/10 rounded-3xl p-6 hover:border-orange-500/50 transition-all group flex flex-col h-full shadow-xl">
                        <div className="flex justify-between items-start mb-4">
                            <span className="px-3 py-1 bg-zinc-900 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-orange-400">
                                {opp.category}
                            </span>
                            {opp.is_team_finding_open && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
                                    <Users className="w-3 h-3"/> TÌM ĐỒNG ĐỘI
                                </span>
                            )}
                        </div>
                        
                        <h3 className="text-xl font-bold mb-3 group-hover:text-orange-400 transition-colors line-clamp-2">
                            {opp.title}
                        </h3>
                        
                        <p className="text-sm text-white/60 line-clamp-3 mb-6 flex-1">
                            {opp.description}
                        </p>
                        
                        <div className="space-y-3 pt-4 border-t border-white/5 mb-6">
                            <div className="flex items-center gap-2 text-xs text-white/40">
                                <MapPin className="w-4 h-4 text-white/20" />
                                <span className="truncate">{opp.address || 'Trực tuyến'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-white/40">
                                <Calendar className="w-4 h-4 text-white/20" />
                                {opp.deadline ? `Hạn chót: ${new Date(opp.deadline).toLocaleDateString('vi-VN')}` : 'Không có hạn chót'}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6">
                            {opp.tags?.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-[10px] bg-white/5 text-white/60 px-2 py-1 rounded border border-white/5">#{tag}</span>
                            ))}
                        </div>
                        
                        <Link href={`/opportunities/${opp.id}`} className="w-full py-3 rounded-xl bg-zinc-900 border border-white/10 group-hover:bg-orange-500 group-hover:border-transparent group-hover:text-white transition-all text-sm font-bold flex justify-center items-center gap-2">
                            XEM CHI TIẾT <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                <Target className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40">Không tìm thấy cơ hội nào phù hợp.</p>
            </div>
        )}

      </div>
    </div>
  );
}
