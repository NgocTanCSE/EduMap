"use client";
import React, { useEffect, useState } from 'react';
import { Target, Search, MapPin, Calendar, Users, ArrowRight, Loader2, Compass } from 'lucide-react';
import { opportunityService, Opportunity } from '@/src/services/opportunity.service';
import { toast } from 'sonner';
import Link from 'next/link';
import Thumb from '@/components/ui/Thumb';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { opportunityIllustration } from '@/src/lib/illustrations';
import { BookmarkButton } from '@/components/ui/BookmarkButton';

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
      setOpportunities((data as any).data || (Array.isArray(data) ? data : []) || []);
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
    <div className="page-shell">
      {/* Header */}
      <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
              <Compass className="w-4 h-4" /> Bản đồ Cơ hội
          </div>
          <h1 className="h1-page">Mở Rộng Giới Hạn</h1>
          <p className="text-muted-foreground/60 leading-relaxed">
              Khám phá các khóa học miễn phí, cuộc thi, hoạt động ngoại khóa và tìm kiếm đồng đội để cùng nhau chinh phục thử thách.
          </p>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card border border-border p-4 rounded-xl">
          <div className="flex overflow-x-auto w-full md:w-auto gap-2 pb-2 md:pb-0 scrollbar-hide">
              {['', 'Cuộc thi', 'Khóa học', 'Hoạt động'].map(cat => (
                  <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-6 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground/60 hover:text-foreground hover:bg-muted border border-border'}`}
                  >
                      {cat || 'Tất cả'}
                  </button>
              ))}
          </div>

          <div className="relative w-full md:w-80">
              <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm kiếm..."
                  icon={Search}
                  className="form-input input-with-icon"
              />
          </div>
      </div>

      {/* Grid */}
      {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>
      ) : filteredData.length > 0 ? (
          <div className="card-grid">
              {filteredData.map(opp => (
                  <div key={opp.id} className="card-surface card-equal group flex flex-col relative">
                      <BookmarkButton targetType="opportunity" targetId={opp.id} size="sm" className="absolute top-3 right-3 z-10" />
                      <div className="-mx-6 -mt-6 mb-5 overflow-hidden rounded-t-xl border-b border-border">
                          <Thumb
                              src={opportunityIllustration(opp.category, opp.title)}
                              alt={opp.title}
                              aspect="16/7"
                              className="rounded-none"
                          />
                      </div>
                      <div className="flex justify-between items-start mb-4">
                          <span className="px-3 py-1 bg-card border border-border rounded-full text-[10px] font-bold uppercase tracking-widest text-primary/90">
                              {opp.category}
                          </span>
                          {opp.is_team_finding_open && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">
                                  <Users className="w-3 h-3"/> TÌM ĐỒNG ĐỘI
                              </span>
                          )}
                      </div>

                      <h3 className="h3-card mb-3 group-hover:text-primary/90 transition-colors line-clamp-2">
                          {opp.title}
                      </h3>

                      <p className="text-sm text-muted-foreground/60 line-clamp-3 mb-6 flex-1">
                          {opp.description}
                      </p>

                      <div className="space-y-3 pt-4 border-t border-border mb-6">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                              <MapPin className="w-4 h-4 text-primary" />
                              <span className="truncate">{opp.address || 'Trực tuyến'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                              <Calendar className="w-4 h-4 text-primary" />
                              {opp.deadline ? `Hạn chót: ${new Date(opp.deadline).toLocaleDateString('vi-VN')}` : 'Không có hạn chót'}
                          </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-6">
                          {opp.tags?.slice(0, 3).map((tag, i) => (
                              <span key={i} className="text-[10px] bg-card/20 text-muted-foreground/60 px-2 py-1 rounded border border-border">#{tag}</span>
                          ))}
                      </div>

                      <Link href={`/opportunities/${opp.id}`} className="card-footer group-hover:bg-primary group-hover:border-transparent group-hover:text-foreground transition-all text-sm font-bold">
                          <span className="flex items-center gap-2">ZEM CHI TIẾT <ArrowRight className="w-4 h-4" /></span>
                      </Link>
                  </div>
              ))}
          </div>
      ) : (
          <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl">
              <Target className="w-12 h-12 text-muted-foreground/10 mx-auto mb-4" />
              <p className="text-muted-foreground/60">Không tìm thấy cơ hội nào phù hợp.</p>
          </div>
      )}

    </div>
  );
}
