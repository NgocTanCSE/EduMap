"use client";
import React, { useEffect, useState } from 'react';
import {
  Briefcase, MapPin, DollarSign, Clock, Building2, ArrowUpRight, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { internshipService, Internship } from '@/src/services/internship.service';
import { toast } from 'sonner';
import ContentShell from '@/components/ui/ContentShell';
import SectionHeader from '@/components/ui/SectionHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Card, CardContent } from '@/components/ui/card';
import Skeleton from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { internshipIllustration, onImageError } from '@/src/lib/illustrations';

export default function InternshipPage() {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
      // Handle both wrapped ({success, data:{items,meta}}) and direct ({items,meta})
      const payload = data.data ?? data;
      const items = payload.items || (Array.isArray(payload) ? payload : []) || [];
      const meta = payload.meta || {};

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
    job.company?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ContentShell>
      <SectionHeader
        title="Cơ hội Thực tập"
        subtitle="Tìm kiếm các vị trí thực tập tốt nhất từ các đối tác doanh nghiệp của EduMap."
        icon={Briefcase}
        right={<span className="text-xs text-foreground/40">{internships.length} vị trí mới</span>}
      />

      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Tìm tên công ty, vị trí..."
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-20">
              <CardContent className="p-0"><Skeleton className="h-full w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : filteredInternships.length > 0 ? (
        <div className="space-y-3">
          {filteredInternships.map(job => (
            <Link href={`/internships/${job.id}`} key={job.id} className="block group">
              <Card className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-lg font-bold text-foreground overflow-hidden border border-border shrink-0">
                  <img
                    src={job.company?.avatar_url || internshipIllustration(job.field, job.title)}
                    onError={onImageError(internshipIllustration(job.field, job.title))}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                      {job.title}
                    </h3>
                    <BookmarkButton targetType="internships" targetId={job.id} size="sm" />
                  </div>

                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-foreground/55">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3 text-primary" /> {job.company?.full_name || 'Doanh nghiệp ẩn danh'}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location ? 'Có địa chỉ' : 'Chưa cập nhật'}</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{job.salary_range || 'Thỏa thuận'}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(job.created_at).toLocaleDateString('vi-VN')}</span>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-foreground/5 text-foreground/55">
                      {job.field || 'Thực tập'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        job.status === 'open'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-destructive/15 text-destructive'
                      }`}
                    >
                      {job.status === 'open' ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-foreground/40 group-hover:text-primary transition-transform group-hover:translate-x-1 shrink-0" />
              </Card>
            </Link>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-full border border-border text-sm font-medium hover:bg-foreground/5 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loadingMore ? 'Đang tải...' : 'Tải thêm thực tập'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="Không tìm thấy vị trí thực tập nào"
          description="Thử điều chỉnh từ khóa tìm kiếm của bạn."
        />
      )}
    </ContentShell>
  );
}
