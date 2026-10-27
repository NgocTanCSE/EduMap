"use client";
import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Users, ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { eventsService, Event } from '@/src/services/events.service';
import { toast } from 'sonner';
import ContentShell from '@/components/ui/ContentShell';
import SectionHeader from '@/components/ui/SectionHeader';
import SearchInput from '@/components/ui/SearchInput';
import Thumb from '@/components/ui/Thumb';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Skeleton from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { eventIllustration } from '@/src/lib/illustrations';

export default function EventsListPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await eventsService.getAllEvents();
      // Unwrap backend { success, data: [...] } wrapper if present
      setEvents((data as any).data || (Array.isArray(data) ? data : []) || []);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải danh sách sự kiện');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (event.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ContentShell>
      <SectionHeader
        title="Workshop & Sự kiện"
        subtitle="Nâng cao kiến thức và kết nối cùng cộng đồng EduMap."
        icon={Calendar}
        right={
          <Link
            href="/events/create"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/85"
          >
            <Plus className="h-4 w-4" /> Tạo sự kiện
          </Link>
        }
      />

      <SearchInput
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Tìm kiếm sự kiện, địa điểm..."
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-64">
              <CardContent className="p-0"><Skeleton className="h-full w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map(event => {
            const capacity = Math.max(1, Number(event.capacity) || 100);
            const progress = Math.min(100, Math.round(((Number(event.registered_count) || 0) / capacity) * 100));
            const startDate = new Date(event.start_date);
            const badge = event.status === 'active' ? 'SẮP DIỄN RA' : 'ĐÃ KẾT THÚC';
            return (
              <Link href={`/events/${event.id}`} key={event.id} className="group">
                <Card className="flex flex-col h-full">
                  <div className="relative">
                    <Thumb
                      src={event.image_url}
                      fallbackSrc={eventIllustration(event.type, event.title)}
                      alt={event.title}
                      aspect="16/10"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-foreground/10 text-foreground">
                      {badge}
                    </span>
                    <BookmarkButton targetType="event" targetId={event.id} size="sm" className="absolute top-3 right-3 z-10" />
                  </div>
                  <CardHeader>
                    <CardTitle className="min-h-[2.75rem] text-base line-clamp-2 group-hover:text-primary transition-colors">
                      {event.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col space-y-2 text-sm text-foreground/60">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      {startDate.toLocaleDateString('vi-VN')} ·{' '}
                      {startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      {event.registered_count}/{capacity} người tham gia
                    </div>

                    <div className="flex justify-between text-xs font-medium pt-2">
                      <span className={progress >= 90 ? 'text-destructive' : 'text-foreground/60'}>
                        {progress}%
                      </span>
                      <span className="text-foreground/40">chỗ trống</span>
                    </div>
                    <div className="h-1.5 w-full bg-foreground/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${progress >= 90 ? 'bg-destructive' : 'bg-primary'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-2 text-xs font-medium text-primary">
                      CHI TIẾT <ArrowRight className="w-3 h-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Không tìm thấy sự kiện nào"
          description="Thử điều chỉnh từ khóa tìm kiếm của bạn."
        />
      )}
    </ContentShell>
  );
}
