/**
 * Trang danh sách Thử thách xanh — `/green`
 *
 * Dạng trang đầy đủ (giống mẫu `/hackathon`) thay thế popup chuyển hướng cũ.
 * Người dùng có thể duyệt / tìm kiếm thử thách sống xanh và bật nút
 * "Xem trên bản đồ" để mở lớp trạm xanh trên Bản đồ EduMap (/map?tool=green).
 *
 * Dữ liệu thực (scripts/real_vn_data.py:GREEN_CHALLENGES — WWF, Doãn, MONRE),
 * luôn hiển thị trạng thái thực. Trạng thái "chưa có thử thách" hiển thị
 * EmptyState trung thự như /hackathon.
 */
"use client";
import React, { useEffect, useState } from 'react';
import { Leaf, Trophy, Users, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { greenService, GreenChallenge } from '@/src/services/green.service';
import { toast } from 'sonner';
import ContentShell from '@/components/ui/ContentShell';
import SectionHeader from '@/components/ui/SectionHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Card, CardContent } from '@/components/ui/card';
import Skeleton from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/EmptyState';

type FilterKey = 'all' | 'active' | 'completed';

const STATUS_LABELS: Record<string, string> = {
  active: 'Đang diễn ra',
  ongoing: 'Đang diễn ra',
  upcoming: 'Sắp mở',
  completed: 'Hoàn thành',
};

function statusBadge(status: string) {
  const s = (status || 'active').toLowerCase();
  if (s === 'completed') return { label: STATUS_LABELS.completed, cls: 'bg-foreground/5 text-foreground/40' };
  if (s === 'upcoming') return { label: STATUS_LABELS.upcoming, cls: 'bg-primary/10 text-primary/70' };
  return { label: STATUS_LABELS.active ?? 'Đang diễn ra', cls: 'bg-green-100/30 text-green-600' };
}

export default function GreenChallengePage() {
  const [challenges, setChallenges] = useState<GreenChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      setLoading(true);
      const data = await greenService.getChallenges();
      setChallenges(Array.isArray(data) ? data : (data as any)?.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải thử thách xanh');
    } finally {
      setLoading(false);
    }
  };

  const filtered = challenges.filter((c) => {
    const term = searchTerm.toLowerCase().trim();
    if (term && !(c.title.toLowerCase().includes(term) || (c.description || '').toLowerCase().includes(term))) return false;
    if (filter === 'completed' && (c.status || '').toLowerCase() !== 'completed') return false;
    if (filter === 'active' && !['active', 'ongoing'].includes((c.status || '').toLowerCase())) return false;
    return true;
  });

  const totalPoints = challenges.reduce((sum, c) => sum + (Number(c.points) || 0), 0);

  return (
    <ContentShell>
      <SectionHeader
        title="Thử thách xanh"
        subtitle="Tham gia các chiến dịch môi trường thực — trồng cây, tắt đèn, dọn rác — và kiếm điểm xanh cùng cộng đồng giáo dục."
        icon={Leaf}
      />

      {/* Highlight banner */}
      <Card className="border-primary/20 p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100/20 text-green-700 text-xs font-bold uppercase tracking-wider border border-green-400/30">
              <Sparkles className="w-3 h-3" /> Thử thách sống xanh
            </span>
            <h2 className="text-xl md:text-2xl font-bold">Cùng làm xanh giáo dục — tích lũy điểm & thành tích</h2>
            <p className="text-sm text-foreground/55 max-w-xl">
              Mỗi hoạt động xanh bạn tham gia sẽ tích lũy carbon_saved và điểm thưởng.
              Xem vị trí trên bản đồ để khám phá cùng cộng đồng.
            </p>
            <div className="flex gap-3 pt-2">
              <Link
                href="/map?tool=green"
                className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
              >
                <Leaf className="w-4 h-4" /> Mở trên bản đồ
              </Link>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-3 text-right">
            <div className="flex flex-col">
              <b className="text-2xl text-green-600">{challenges.length}</b>
              <span className="text-xs text-foreground/55">Thử thách</span>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="flex flex-col">
              <b className="text-2xl text-amber-500">{totalPoints}</b>
              <span className="text-xs text-foreground/55">Tổng điểm</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Tìm thử thách xanh..." />
        <div className="flex gap-1.5 text-xs">
          {([
            ['all', 'Tất cả'],
            ['active', 'Đang diễn ra'],
            ['completed', 'Hoàn thành'],
          ] as [FilterKey, string][]).map(([key, label]) => {
            const on = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full transition-all ${
                  on ? 'bg-primary text-primary-foreground shadow' : 'bg-muted/30 text-muted-foreground hover:bg-muted border border-border'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-lg font-semibold mb-3">
          <Trophy className="w-4 h-4 text-primary" /> Danh sách thử thách
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-56">
                <CardContent className="p-0"><Skeleton className="h-full w-full" /></CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((c) => {
              const badge = statusBadge(c.status || '');
              const pts = Number(c.points) || 0;
              const participants = Number(c.participants_count) || 0;
              const carbon = Number(c.carbon_saved_kg) || pts * 0.5;
              return (
                <Card key={c.id} className="flex flex-col h-full">
                  <div className="h-1.5 w-full bg-green-600 rounded-t-lg" />
                  <CardContent className="flex-1 flex flex-col gap-2 text-sm p-6 pt-4">
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full self-start ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <h3 className="font-medium text-foreground text-base line-clamp-1">{c.title}</h3>
                    {c.description ? (
                      <p className="text-muted-foreground/60 text-xs line-clamp-2 flex-1">{c.description}</p>
                    ) : (
                      <p className="text-muted-foreground/60 text-xs italic flex-1">Chưa có mô tả chi tiết.</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/60 mt-1">
                      {pts > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100/30 text-green-700">
                          <Sparkles className="w-3 h-3" /> {pts} điểm
                        </span>
                      )}
                      {carbon > 0 && (
                        <span>CO₂: {Math.round(carbon)} kg</span>
                      )}
                      {participants > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3" /> {participants} người
                        </span>
                      )}
                      {c.address && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {c.address}
                        </span>
                      )}
                    </div>
                    <Link
                      href="/map?tool=green"
                      className="mt-auto pt-2 text-xs font-medium text-green-600 hover:text-green-700 inline-flex items-center gap-1"
                    >
                      Xem trên bản đồ <ArrowRight className="w-3 h-3" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Leaf className="w-8 h-8 text-foreground/30" />}
            title="Chưa có thử thách xanh nào"
            description="Các thử thách sống xanh sẽ xuất hiện tại đây khi có cập nhật."
          />
        )}
      </div>
    </ContentShell>
  );
}
