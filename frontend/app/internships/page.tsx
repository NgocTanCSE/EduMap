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
import Pagination from '@/components/ui/Pagination';

export default function InternshipPage() {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    fetchInternships(1);
  }, []);

  const fetchInternships = async (pageNum: number) => {
    try {
      setLoading(true);
      const data: any = await internshipService.getInternships(pageNum, 50);
      const payload = data.data ?? data;
      const items = payload.items || (Array.isArray(payload) ? payload : []) || [];
      setInternships(items);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải danh sách thực tập');
    } finally {
      setLoading(false);
    }
  };

  const filteredInternships = internships.filter(job =>
    (job.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (job.company?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (job.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedInternships = filteredInternships.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <ContentShell>
      <SectionHeader
        title="Cơ hội Thực tập"
        subtitle="Tìm kiếm các vị trí thực tập tốt nhất từ các đối tác doanh nghiệp của EduMap."
        icon={Briefcase}
        right={<span className="text-xs text-muted-foreground">{filteredInternships.length} vị trí khả dụng</span>}
      />

      <SearchInput
        value={searchTerm}
        onChange={(val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        }}
        placeholder="Tìm tên công ty, vị trí, địa điểm..."
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="h-64 rounded-2xl">
              <CardContent className="p-0 h-full"><Skeleton className="h-full w-full rounded-2xl" /></CardContent>
            </Card>
          ))}
        </div>
      ) : filteredInternships.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedInternships.map(job => (
              <Link href={`/internships/${job.id}`} key={job.id} className="block group h-full">
                <div className="h-full rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all hover:border-primary/50 flex flex-col justify-between relative">
                  <div className="absolute top-3.5 right-3.5 z-10">
                    <BookmarkButton targetType="internships" targetId={job.id} size="sm" />
                  </div>

                  <div>
                    {/* Top: Avatar & Status */}
                    <div className="flex items-center gap-3 mb-3 pr-8">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/80">
                        {job.company?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={job.company.avatar_url}
                            alt={job.company?.full_name || ''}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            job.status === 'open'
                              ? 'bg-accent/15 text-accent border border-accent/20'
                              : 'bg-destructive/15 text-destructive border border-destructive/20'
                          }`}
                        >
                          {job.status === 'open' ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                        </span>
                        <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">
                          {job.company?.full_name || 'Doanh nghiệp đối tác'}
                        </p>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 min-h-[3rem] mb-2">
                      {job.title}
                    </h3>

                    {/* Meta info */}
                    <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{job.location || 'Biên Hòa, Đồng Nai'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold text-accent">
                        <DollarSign className="w-3.5 h-3.5 shrink-0" />
                        <span>{job.salary_range || 'Thỏa thuận'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>Hạn: {new Date(job.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom bar */}
                  <div className="pt-3 border-t border-border/80 flex items-center justify-between">
                    <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-foreground truncate max-w-[140px]">
                      {job.field || 'Thực tập'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:text-primary/80">
                      Chi tiết <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {filteredInternships.length > pageSize && (
            <div className="pt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredInternships.length / pageSize)}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="Không tìm thấy cơ hội thực tập"
          description="Hãy thử thay đổi từ khóa tìm kiếm hoặc kiểm tra lại sau."
          icon={<Briefcase className="w-10 h-10 text-muted-foreground/30" />}
        />
      )}
    </ContentShell>
  );
}
