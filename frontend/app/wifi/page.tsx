/**
 * Trang danh sách Trạm Wifi — `/wifi`
 *
 * Dạng trang đầy đủ (giống mẫu `/hackathon`) thay thế popup chuyển hướng cũ.
 * Người dùng duyệt / tìm kiếm trạm wifi (category_id = 6) và bật
 * "Xem trên bản đồ" để mở lớp trạm wifi trên Bản đồ EduMap (/map?tool=wifi).
 *
 * `locations` table không có cột `is_free`/`speed_mbps` dedicated — chúng được
 * suy luận từ name/description (xem deriveWifiMeta ở WifiTool). Trạng thái
 * "chưa có trạm" hiển thị EmptyState giống hệt /hackathon.
 */
"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { Wifi, MapPin, ArrowRight, ShieldCheck, Gauge } from 'lucide-react';
import Link from 'next/link';
import { wifiService } from '@/src/services/wifi.service';
import { toast } from 'sonner';
import ContentShell from '@/components/ui/ContentShell';
import SectionHeader from '@/components/ui/SectionHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Card, CardContent } from '@/components/ui/card';
import Skeleton from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/EmptyState';

interface WifiLoc {
  id: string;
  name?: string;
  ssid?: string;
  address?: string;
  description?: string;
  rating_avg?: number;
  rating_count?: number;
  is_verified?: boolean;
  coordinates?: any;
}

/** Derive free/paid flag + qualitative speed tier from the row's text fields,
 *  because the `locations` table stores no dedicated is_free/speed columns. */
function deriveWifiMeta(loc: any): { isFree: boolean; speedLabel: string } {
  const text = `${loc?.name || ''} ${loc?.description || ''}`.toLowerCase();
  const isFree = /free|miễn phí/i.test(text);
  let speedLabel = 'Ổn định';
  if (/cáp quang|fiber|siêu tốc/i.test(text)) speedLabel = 'Rất nhanh';
  else if (/tốc độ cao|high-speed/i.test(text)) speedLabel = 'Nhanh';
  return { isFree, speedLabel };
}

type FilterKey = 'all' | 'free' | 'paid';

export default function WifiPage() {
  const [locations, setLocations] = useState<WifiLoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const data = await wifiService.getLocations();
      const raw = Array.isArray(data) ? data : (data as any)?.data || [];
      setLocations(raw);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải danh sách Wifi');
    } finally {
      setLoading(false);
    }
  };

  const items = useMemo(() => {
    return (Array.isArray(locations) ? locations : []).map((w) => {
      const meta = deriveWifiMeta(w);
      return { ...w, is_free: meta.isFree, speedLabel: meta.speedLabel };
    });
  }, [locations]);

  const filtered = items.filter((w) => {
    const term = searchTerm.toLowerCase().trim();
    const label = (w.name || w.ssid || '').toLowerCase();
    const addr = (w.address || '').toLowerCase();
    if (term && !label.includes(term) && !addr.includes(term)) return false;
    if (filter === 'free' && !w.is_free) return false;
    if (filter === 'paid' && w.is_free) return false;
    return true;
  });

  const freeCount = items.filter((w) => w.is_free).length;

  return (
    <ContentShell className="max-w-none">
      <SectionHeader
        title="Trạm Wifi"
        subtitle="Bản đồ các trạm Wifi công cộng miễn phí và trả tiền trên toàn mạng lưới giáo dục. Nhấn vào bất kỳ điểm nào để xem chi tiết hoặc mở trên bản đồ."
        icon={Wifi}
      />

      {/* Highlight banner */}
      <Card className="border-primary/20 p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold uppercase tracking-wider border border-primary/30">
              <Wifi className="w-3 h-3" /> Mạng lưới Wifi
            </span>
            <h2 className="text-xl md:text-2xl font-bold">Tìm wifi học tập & làm việc xanh quanh bạn</h2>
            <p className="text-sm text-foreground/55 max-w-xl">
              {freeCount > 0
                ? `${freeCount} trạm Wifi miễn phí khả dụng gần các trường học, thư viện và khu phố.`
                : 'Các trạm Wifi sẽ xuất hiện tại đây khi có dữ liệu cập nhật.'}
            </p>
            <div className="flex gap-3 pt-2">
              <Link
                href="/map?tool=wifi"
                className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                <Wifi className="w-4 h-4" /> Mở trên bản đồ
              </Link>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-3 text-right">
            <div className="flex flex-col">
              <b className="text-2xl text-primary">{items.length}</b>
              <span className="text-xs text-foreground/55">Trạm Wifi</span>
            </div>
            <div className="w-px h-10 bg-border" />
            <div className="flex flex-col">
              <b className="text-2xl text-green-600">{freeCount}</b>
              <span className="text-xs text-foreground/55">Miễn phí</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Tìm wifi, khu vực..." />
        <div className="flex gap-1.5 text-xs">
          {([
            ['all', 'Tất cả'],
            ['free', 'Miễn phí'],
            ['paid', 'Trả tiền'],
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
          <MapPin className="w-4 h-4 text-primary" /> Danh sách trạm Wifi
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-48">
                <CardContent className="p-0"><Skeleton className="h-full w-full" /></CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filtered.map((w) => {
              const rating = Number(w.rating_avg) || 0;
              const reviewCount = Number(w.rating_count) || 0;
              const speedColor =
                w.speedLabel === 'Rất nhanh' ? 'text-green-600'
                : w.speedLabel === 'Nhanh' ? 'text-amber-500'
                : 'text-foreground/60';
              return (
                <Card key={w.id} className="flex flex-col h-full">
                  <div className="h-1.5 w-full bg-primary/20 rounded-t-lg" />
                  <CardContent className="flex-1 flex flex-col gap-2 text-sm p-6 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-foreground text-base line-clamp-1">
                        {w.name || w.ssid || 'Trạm Wifi'}
                      </h3>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                          w.is_free ? 'bg-green-100/30 text-green-700' : 'bg-orange-100/30 text-orange-700'
                        }`}
                      >
                        {w.is_free ? 'Miễn phí' : 'Trả tiền'}
                      </span>
                    </div>
                    {w.address && (
                      <p className="text-xs text-muted-foreground/60 line-clamp-2 flex-1">
                        {w.address}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/60 mt-1">
                      <span className={`inline-flex items-center gap-1 ${speedColor}`}>
                        <Gauge className="w-3 h-3" /> {w.speedLabel}
                      </span>
                      {w.is_verified && (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <ShieldCheck className="w-3 h-3" /> Đã xác minh
                        </span>
                      )}
                      {reviewCount > 0 && (
                        <span>★ {rating.toFixed(1)} ({reviewCount})</span>
                      )}
                    </div>
                    <Link
                      href="/map?tool=wifi"
                      className="mt-auto pt-2 text-xs font-medium text-primary hover:text-primary/80 inline-flex items-center gap-1"
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
            icon={<Wifi className="w-8 h-8 text-foreground/30" />}
            title="Chưa có trạm Wifi nào"
            description="Các trạm Wifi sẽ xuất hiện tại đây khi có dữ liệu cập nhật."
            action={{
              label: 'Mở bản đồ Wifi',
              onClick: () => { window.location.href = '/map?tool=wifi'; },
            }}
          />
        )}
      </div>
    </ContentShell>
  );
}
