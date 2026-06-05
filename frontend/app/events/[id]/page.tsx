"use client";
import React, { useEffect, useState, use } from 'react';
import { 
  Calendar, MapPin, Users, Ticket, ArrowLeft, 
  Share2, ShieldCheck, MessageCircle, Loader2,
  CheckCircle2, Download, ExternalLink, Clock
} from 'lucide-react';
import { eventsService, Event, EventRegistrationResponse } from '@/src/services/events.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import Link from 'next/link';

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;

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
      setEvent(data);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải thông tin sự kiện');
    } finally {
      setLoading(false);
    }
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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-white/60 mb-8">Không tìm thấy sự kiện này.</p>
        <Link 
          href="/events"
          className="px-8 py-3 rounded-full bg-yellow-600 font-bold hover:bg-yellow-500 transition-all"
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
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        <Link href="/events" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group text-sm font-bold">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> QUAY LẠI DANH SÁCH
        </Link>

        {ticket ? (
          /* Ticket View after successful registration */
          <div className="max-w-2xl mx-auto">
            <div className="bg-card border border-yellow-500/30 rounded-[40px] overflow-hidden shadow-2xl shadow-yellow-500/10">
              <div className="bg-yellow-600 p-8 text-center">
                <CheckCircle2 className="w-16 h-16 text-white mx-auto mb-4" />
                <h2 className="text-2xl font-black">VÉ THAM GIA CỦA BẠN</h2>
                <p className="text-white/80 text-sm mt-2">Mã vé: {ticket.ticket_code}</p>
              </div>
              
              <div className="p-10 flex flex-col md:flex-row gap-10 items-center">
                <div className="bg-white p-4 rounded-3xl shrink-0">
                  <img src={ticket.ticket_qr} alt="Ticket QR" className="w-40 h-40" />
                </div>
                
                <div className="space-y-6 flex-1 text-center md:text-left">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{ticket.event_title}</h3>
                    <p className="text-white/40 text-sm flex items-center justify-center md:justify-start gap-2">
                      <Calendar className="w-4 h-4" /> {new Date(ticket.start_date).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 text-xs font-bold uppercase tracking-widest text-white/60">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      <MapPin className="w-4 h-4 text-yellow-500" /> {ticket.location}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 flex gap-4">
                    <button className="flex-1 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 transition-all text-xs font-bold flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" /> TẢI VÉ
                    </button>
                    <button onClick={() => setTicket(null)} className="flex-1 py-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all text-xs font-bold">
                      XEM SỰ KIỆN
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center mt-8 text-white/40 text-xs px-10">
              * Vui lòng xuất trình mã QR này tại quầy check-in để được vào cổng. 
              Thông tin vé cũng đã được gửi đến email của bạn.
            </p>
          </div>
        ) : (
          /* Normal Detail View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Left: Info */}
            <div className="lg:col-span-2 space-y-8">
              <div className="rounded-[40px] overflow-hidden border border-white/10 aspect-video relative group">
                <img src={event.image_url || `https://images.unsplash.com/photo-1540575861501-7ad05823c9f5?q=80&w=1200`} alt={event.title} className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  <span className="px-4 py-2 rounded-full bg-yellow-600 text-xs font-bold mb-4 inline-block">WORKSHOP</span>
                  <h1 className="text-4xl font-bold leading-tight">{event.title}</h1>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-3xl bg-card border border-white/5 space-y-2">
                  <Calendar className="text-yellow-500 w-5 h-5" />
                  <p className="text-[10px] text-white/40 font-bold uppercase">Thời gian</p>
                  <p className="text-sm font-bold">{startDate.toLocaleDateString('vi-VN')}</p>
                </div>
                <div className="p-6 rounded-3xl bg-card border border-white/5 space-y-2">
                  <Clock className="text-yellow-500 w-5 h-5" />
                  <p className="text-[10px] text-white/40 font-bold uppercase">Bắt đầu</p>
                  <p className="text-sm font-bold">{startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="p-6 rounded-3xl bg-card border border-white/5 space-y-2">
                  <MapPin className="text-yellow-500 w-5 h-5" />
                  <p className="text-[10px] text-white/40 font-bold uppercase">Địa điểm</p>
                  <p className="text-sm font-bold truncate">{event.location}</p>
                </div>
              </div>

              <div className="prose prose-invert max-w-none">
                <h2 className="text-2xl font-bold">Nội dung sự kiện</h2>
                <div className="text-white/60 leading-relaxed whitespace-pre-wrap">
                  {event.description || 'Đang cập nhật nội dung chi tiết cho sự kiện này...'}
                </div>
              </div>
            </div>

            {/* Right: Registration Card */}
            <div className="space-y-6">
              <div className="p-8 rounded-[40px] bg-card border border-white/10 sticky top-8">
                <div className="space-y-8">
                   <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Tình trạng chỗ</span>
                        <span className="text-xs font-bold text-yellow-500">{event.registered_count} / {event.capacity}</span>
                      </div>
                      <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-gradient-to-r from-yellow-600 to-purple-600 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/10">
                        <ShieldCheck className="w-5 h-5 text-yellow-500 shrink-0" />
                        <div>
                          <p className="text-xs font-bold">EduMap Verified</p>
                          <p className="text-[10px] text-white/40">Sự kiện đã được kiểm duyệt nội dung bởi đội ngũ EduMap.</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={handleRegister}
                        disabled={submitting || isFull || event.status !== 'active'}
                        className="w-full py-5 rounded-[24px] bg-yellow-600 hover:bg-yellow-500 text-white font-bold transition-all shadow-xl shadow-yellow-600/20 disabled:bg-zinc-800 disabled:shadow-none flex items-center justify-center gap-2"
                      >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ticket className="w-5 h-5" />}
                        {isFull ? 'HẾT CHỖ' : event.status !== 'active' ? 'ĐÃ KẾT THÚC' : 'ĐĂNG KÝ THAM GIA'}
                      </button>
                   </div>

                   <div className="pt-8 border-t border-white/5 space-y-4">
                      <button className="w-full py-4 rounded-2xl bg-zinc-900 border border-white/10 text-xs font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all">
                        <Share2 className="w-4 h-4" /> CHIA SẺ SỰ KIỆN
                      </button>
                      <button className="w-full py-4 rounded-2xl border border-white/5 text-xs font-bold flex items-center justify-center gap-2 text-white/40 hover:text-white transition-all">
                        <MessageCircle className="w-4 h-4" /> HỎI ĐÁP VỀ SỰ KIỆN
                      </button>
                   </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
