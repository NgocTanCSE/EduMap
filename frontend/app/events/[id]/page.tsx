"use client";
import React, { useEffect, useState } from 'react';
import {
  Calendar, MapPin, Ticket, ArrowLeft, Share2, ShieldCheck,
  Loader2, CheckCircle2, Download, Clock
} from 'lucide-react';
import Link from 'next/link';
import { eventsService, Event, EventRegistrationResponse } from '@/src/services/events.service';
import { authService } from '@/src/services/auth.service';
import { shareLink } from '@/src/lib/share';
import { toast } from 'sonner';
import Thumb from '@/components/ui/Thumb';
import { eventIllustration } from '@/src/lib/illustrations';
import { Card, CardContent } from '@/components/ui/card';
import { BookmarkButton } from '@/components/ui/BookmarkButton';

export default function EventDetailPage({ params }: { params: { id: string } }) {
    const eventId = params.id;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<EventRegistrationResponse | null>(null);

  const isLoggedIn = authService.isLoggedIn();

  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
    }
  }, [eventId]);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const data = await eventsService.getEventById(eventId);
      setEvent((data as any).data ?? data);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải thông tin sự kiện');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    await shareLink({
      title: event.title,
      text: `Sự kiện: ${event.title}`,
      url: `${window.location.origin}/events/${event.id}`,
    });
  };

  const downloadTicket = () => {
    if (!ticket) return;
    const link = document.createElement('a');
    link.href = ticket.ticket_qr;
    link.download = `ve-${ticket.ticket_code}.png`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Đang tải vé của bạn.');
  };

  const handleRegister = async () => {
    if (!isLoggedIn) {
      toast.error('Vui lòng đăng nhập để đăng ký tham gia!');
      window.location.href = `/auth/login?redirect=/events/${eventId}`;
      return;
    }
    try {
      setSubmitting(true);
      const result = await eventsService.registerEvent(eventId);
      setTicket(result);
      toast.success('Đăng ký tham gia thành công!');
      fetchEventDetails(); // Refresh to update registered_count
    } catch (error: any) {
      toast.error(error.message || 'Đăng ký thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">404</h1>
        <p className="text-muted-foreground/60 mb-8">Không tìm thấy sự kiện này.</p>
        <Link
          href="/events"
          className="px-6 py-2.5 rounded-full bg-primary font-medium hover:bg-primary/80 transition-colors"
        >
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const progress = Math.min(100, Math.round((event.registered_count / event.capacity) * 100)) || 0;
  const startDate = new Date(event.start_date);
  const isFull = event.registered_count >= event.capacity;

  return (
    <div className="min-h-screen bg-background text-foreground py-8">
      <div className="w-full mx-auto space-y-8">
        <Link
          href="/events"
          className="flex items-center gap-2 text-muted-foreground/40 hover:text-foreground transition-colors group text-sm font-bold w-fit"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> QUAY LẠI DANH SÁCH
        </Link>

        {ticket ? (
          /* Ticket View after successful registration */
          <div className="max-w-2xl mx-auto">
            <div className="border border-primary/30 rounded-xl overflow-hidden">
              <div className="bg-primary p-8 text-center">
                <CheckCircle2 className="w-14 h-14 text-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold">VÉ THAM GIA CỦA BẠN</h2>
                <p className="text-foreground/80 text-sm mt-2">Mã vé: {ticket.ticket_code}</p>
              </div>

              <div className="p-8 flex flex-col md:flex-row gap-8 items-center">
                <div className="shrink-0">
                  <img src={ticket.ticket_qr} alt="Ticket QR" className="w-32 h-32 rounded-lg" />
                </div>

                <div className="space-y-4 flex-1 text-center md:text-left">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{ticket.event_title}</h3>
                    <p className="text-muted-foreground/50 text-sm flex items-center justify-center md:justify-start gap-2">
                      <Calendar className="w-4 h-4" /> {new Date(ticket.start_date).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <MapPin className="w-4 h-4 text-primary" /> {ticket.location}
                  </div>

                  <div className="pt-6 border-t border-border flex gap-3">
                    <button
                      type="button"
                      onClick={downloadTicket}
                      className="flex-1 py-3 rounded-xl bg-card hover:bg-card/50 transition-colors text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> TẢI VÉ
                    </button>
                    <button
                      onClick={() => setTicket(null)}
                      className="flex-1 py-3 rounded-xl border border-border text-xs font-bold hover:bg-foreground/5 transition-colors"
                    >
                      XEM SỰ KIỆN
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center mt-6 text-muted-foreground/40 text-xs px-6">
              * Vui lòng xuất trình mã QR này tại quầy check-in để được vào cổng.
              Hãy tải vé hoặc chụp màn hình để sử dụng khi cần.
            </p>
          </div>
        ) : (
          /* Normal Detail View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Info */}
            <div className="lg:col-span-2 space-y-8">
              <div className="rounded-xl overflow-hidden border border-border aspect-video relative">
                <Thumb
                  src={event.image_url}
                  fallbackSrc={eventIllustration(event.type, event.title)}
                  alt={event.title}
                  aspect="16/10"
                />
                <div className="absolute bottom-6 left-6 right-6">
                  <span className="px-3 py-1 rounded-full bg-primary text-[10px] font-bold mb-3 inline-block uppercase">
                    {event.type || 'Sự kiện'}
                  </span>
                  <h1 className="text-2xl font-semibold text-foreground">{event.title}</h1>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-card border border-border space-y-2">
                  <Calendar className="text-primary w-5 h-5" />
                  <p className="text-[10px] text-muted-foreground/40 font-bold uppercase">Thời gian</p>
                  <p className="text-sm font-medium">{startDate.toLocaleDateString('vi-VN')}</p>
                </div>
                <div className="p-5 rounded-xl bg-card border border-border space-y-2">
                  <Clock className="text-primary w-5 h-5" />
                  <p className="text-[10px] text-muted-foreground/40 font-bold uppercase">Bắt đầu</p>
                  <p className="text-sm font-medium">
                    {startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="p-5 rounded-xl bg-card border border-border space-y-2">
                  <MapPin className="text-primary w-5 h-5" />
                  <p className="text-[10px] text-muted-foreground/40 font-bold uppercase">Địa điểm</p>
                  <p className="text-sm font-medium truncate">{event.location}</p>
                </div>
              </div>

              <div className="prose prose-invert max-w-none">
                <h2 className="text-xl font-semibold">Nội dung sự kiện</h2>
                <div className="text-foreground/70 leading-relaxed whitespace-pre-wrap">
                  {event.description || 'Đang cập nhật nội dung chi tiết cho sự kiện này...'}
                </div>
              </div>
            </div>

            {/* Right: Registration Card */}
            <div className="space-y-6">
              <Card className="p-6 sticky top-8">
                <div className="flex justify-end mb-1">
                  <BookmarkButton targetType="event" targetId={event.id} size="sm" />
                </div>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">
                        Tình trạng chỗ
                      </span>
                      <span className="text-xs font-bold text-primary">
                        {event.registered_count} / {event.capacity}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-foreground/10 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/10 border border-primary/10">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-bold">EduMap Verified</p>
                      <p className="text-[10px] text-muted-foreground/40">
                        Sự kiện đã được kiểm duyệt nội dung bởi đội ngũ EduMap.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleRegister}
                    disabled={submitting || isFull || event.status !== 'active'}
                    className="w-full py-4 rounded-xl bg-primary hover:bg-primary/80 text-foreground font-bold transition-all disabled:bg-card disabled:shadow-none disabled:text-muted-foreground/40 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ticket className="w-5 h-5" />}
                    {isFull ? 'HẾT CHỖ' : event.status !== 'active' ? 'ĐÃ KẾT THÚC' : 'ĐĂNG KÝ THAM GIA'}
                  </button>

                  <div className="pt-6 border-t border-border space-y-3">
                    <button
                      type="button"
                      onClick={handleShare}
                      className="w-full py-3 rounded-xl bg-card border border-border text-xs font-bold flex items-center justify-center gap-2 hover:bg-foreground/5 transition-colors"
                    >
                      <Share2 className="w-4 h-4" /> CHIA SẺ SỰ KIỆN
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
