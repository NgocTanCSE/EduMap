"use client";
import React, { useEffect, useState } from 'react';
import { Briefcase, MapPin, DollarSign, Clock, Building2, Search, Filter, Bookmark, ArrowUpRight, Loader2 } from 'lucide-react';
import { internshipService, Internship } from '@/src/services/internship.service';
import { toast } from 'sonner';
import Link from 'next/link';

export default function InternshipPage() {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchInternships(1);
  }, []);

  const fetchInternships = async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const data: any = await internshipService.getInternships(pageNum, 10);
      const items = data.items || data.data || [];
      const meta = data.meta || {};

      if (pageNum === 1) {
        setInternships(items);
      } else {
        setInternships(prev => [...prev, ...items]);
      }

      setHasMore(meta.currentPage < meta.totalPages);
      setPage(pageNum);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải danh sách thực tập');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchInternships(page + 1);
    }
  };

  const filteredInternships = internships.filter(job => 
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    job.company?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-card p-12 rounded-2xl border border-border relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-4">Cơ hội Thực tập</h1>
            <p className="text-muted-foreground/50 max-w-md">Tìm kiếm các vị trí thực tập tốt nhất từ các đối tác doanh nghiệp của EduMap.</p>
          </div>
          <div className="flex gap-4 relative z-10">
            <div className="p-6 rounded-3xl bg-card/40 border border-border text-center min-w-[120px]">
              <p className="text-2xl font-bold">{internships.length}</p>
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-bold">Vị trí mới</p>
            </div>
            <div className="p-6 rounded-3xl bg-card/40 border border-border text-center min-w-[120px]">
              <p className="text-2xl font-bold">{new Set(internships.map(i => i.company?.id)).size}</p>
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-bold">Công ty</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-5">
            <Briefcase className="w-64 h-64" />
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex gap-4">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30" />
             <input 
                type="text" 
                placeholder="Tìm tên công ty, vị trí..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-card border border-border rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary transition-colors text-primary" 
             />
           </div>
           <button className="p-4 rounded-2xl bg-card border border-border hover:bg-card/20 transition-colors">
              <Filter className="w-6 h-6 text-muted-foreground/60" />
           </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20">
             <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        ) : filteredInternships.length > 0 ? (
          <div className="space-y-4">
            {filteredInternships.map(job => (
              <Link href={`/internships/${job.id}`} key={job.id} className="block">
                  <div className="p-6 rounded-3xl bg-card border border-border hover:border-primary/50 transition-all group flex items-center gap-6 shadow-xl">
                      <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-2xl font-bold text-white shadow-lg overflow-hidden border border-border">
                        {job.company?.avatar_url ? (
                            <img src={job.company.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            job.company?.full_name?.charAt(0) || 'B'
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-bold group-hover:text-primary/70 transition-colors">{job.title}</h3>
                            <button className="text-muted-foreground/20 hover:text-white transition-colors" onClick={e => e.preventDefault()}><Bookmark className="w-5 h-5" /></button>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/40 mb-4">
                            <span className="flex items-center gap-1 font-bold text-foreground/70"><Building2 className="w-3 h-3 text-primary" /> {job.company?.full_name || 'Doanh nghiệp ẩn danh'}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location ? 'Xem trên bản đồ' : 'Chưa cập nhật địa chỉ'}</span>
                            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {job.salary_range || "Thỏa thuận"}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(job.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="flex gap-2">
                            <span className="px-2 py-1 rounded-md bg-card/20 border border-border text-[10px] text-muted-foreground/60">{job.field || "Thực tập"}</span>
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${job.status === 'open' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                {job.status === 'open' ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                            </span>
                        </div>
                      </div>
                      <div className="p-4 rounded-full bg-card/20 border border-border group-hover:bg-primary group-hover:text-white group-hover:border-transparent transition-all">
                        <ArrowUpRight className="w-6 h-6" />
                      </div>
                  </div>
              </Link>
            ))}
            {hasMore && (
              <div className="flex justify-center pt-8">
                <button 
                  onClick={handleLoadMore} 
                  disabled={loadingMore}
                  className="px-8 py-3 rounded-full border border-border text-white hover:bg-card/20 text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin"/> : null}
                  {loadingMore ? 'Đang tải...' : 'Tải thêm thực tập'}
                </button>
              </div>
            )}
          </div>
        ) : (
            <div className="text-center py-20 bg-card border border-dashed border-border rounded-2xl">
                <Briefcase className="w-12 h-12 text-muted-foreground/10 mx-auto mb-4" />
                <p className="text-muted-foreground/40">Không tìm thấy vị trí thực tập nào phù hợp.</p>
            </div>
        )}

      </div>
    </div>
  );
}
