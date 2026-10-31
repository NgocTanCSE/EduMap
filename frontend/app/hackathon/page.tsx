"use client";
import React, { useEffect, useState } from 'react';
import { Code, Users, Calendar, Trophy, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { hackathonService, Hackathon } from '@/src/services/hackathon.service';
import { toast } from 'sonner';
import ContentShell from '@/components/ui/ContentShell';
import SectionHeader from '@/components/ui/SectionHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Skeleton from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';

export default function HackathonListPage() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    fetchHackathons();
  }, []);

  const fetchHackathons = async () => {
    try {
      setLoading(true);
      const data = await hackathonService.getHackathons();
      setHackathons((data as any).data || (Array.isArray(data) ? data : []) || []);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải danh sách Hackathon');
    } finally {
      setLoading(false);
    }
  };

  const filteredHackathons = hackathons.filter(h =>
    h.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ContentShell>
      <SectionHeader
        title="Sân chơi Hackathon"
        subtitle="Nơi hội tụ những ý tưởng đột phá và giải pháp công nghệ."
        icon={Trophy}
      />

      {/* Highlight banner — de-generified (no blur orb / rotate-3 / giant code block) */}
      <div className="rounded-[22px] border border-border/80 bg-card p-6 md:p-8 shadow-orvel">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold uppercase tracking-wider border border-primary/30">
              <Code className="w-3 h-3" /> Mùa giải mới
            </span>
            <h2 className="text-xl md:text-2xl font-bold">Hackathon Mùa Hè 2026: AI & Education</h2>
            <p className="text-sm text-foreground/55 max-w-xl">
              Ứng dụng trí tuệ nhân tạo để giải quyết thách thức giáo dục ở các vùng sâu, xã.
              Tổng giải thưởng lên đến 100,000,000 VNĐ.
            </p>
            <div className="flex gap-3 pt-2">
              <button className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium">
                Đăng ký ngay
              </button>
              <button className="px-5 py-2 rounded-lg border border-border font-medium">
                Thể lệ
              </button>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="w-24 h-24 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Code className="w-10 h-10 text-primary" />
            </div>
          </div>
        </div>
      </div>

      <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Tìm kiếm cuộc thi..." />

      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Các cuộc thi đang diễn ra
        </h3>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-56">
                <CardContent className="p-0"><Skeleton className="h-full w-full" /></CardContent>
              </Card>
            ))}
          </div>
        ) : filteredHackathons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHackathons.slice((page - 1) * pageSize, page * pageSize).map(hackathon => {
              const startDate = new Date(hackathon.start_date);
              const endDate = new Date(hackathon.end_date);
              return (
                <Link href={`/hackathon/${hackathon.id}`} key={hackathon.id} className="group">
                  <div className="flex flex-col h-full rounded-[22px] border border-border/80 bg-card shadow-orvel hover:shadow-pop transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 overflow-hidden">
                    <div className="h-1.5 w-full bg-primary rounded-t-lg" />
                    <CardHeader>
                      <span
                        className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full self-start ${
                          hackathon.status === 'ongoing'
                            ? 'bg-primary/15 text-primary'
                            : hackathon.status === 'upcoming'
                            ? 'bg-primary/10 text-primary/70'
                            : 'bg-foreground/5 text-foreground/40'
                        }`}
                      >
                        {hackathon.status === 'ongoing'
                          ? 'ĐANG DIỄN RA'
                          : hackathon.status === 'upcoming'
                          ? 'SẮP MỞ ĐĂNG KÝ'
                          : 'ĐÃ KẾT THÚC'}
                      </span>
                      <CardTitle className="mt-2 min-h-[2.75rem] text-base line-clamp-2 group-hover:text-primary transition-colors">
                        {hackathon.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-2 text-sm text-foreground/60">
                      <p className="line-clamp-2 flex-1">
                        {hackathon.description || 'Chưa có thông tin chi tiết.'}
                      </p>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        {startDate.toLocaleDateString('vi-VN')} - {endDate.toLocaleDateString('vi-VN')}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" /> Đăng ký theo đội (3-5 người)
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2 text-xs font-medium text-primary">
                        XEM CHI TIẾT <ArrowRight className="w-3 h-3" />
                      </div>
                    </CardContent>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Chưa có cuộc thi nào"
            description="Các cuộc thi sẽ xuất hiện tại đây khi có cập nhật."
          />
        )}
      </div>
    </ContentShell>
  );
}
