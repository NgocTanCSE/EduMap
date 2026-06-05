"use client";
import React, { useEffect, useState, use } from 'react';
import { 
  Calendar, MapPin, Users, Ticket, ArrowRight, 
  Search, Filter, Loader2, Sparkles, Clock 
} from 'lucide-react';
import { eventsService, Event } from '@/src/services/events.service';
import Link from 'next/link';
import { toast } from 'sonner';

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
      setEvents(data);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải danh sách sự kiện');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => 
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
              <Sparkles className="text-yellow-500 w-8 h-8" />
              Workshop & Sự kiện
            </h1>
            <p className="text-white/40 text-sm">Nâng cao kiến thức và kết nối cùng cộng đồng EduMap.</p>
          </div>
          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input 
              type="text" 
              placeholder="Tìm kiếm sự kiện, địa điểm..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-yellow-500 outline-none transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
            <p className="text-white/40 animate-pulse">Đang tải danh sách sự kiện...</p>
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map(event => {
              const progress = Math.min(100, Math.round((event.registered_count / event.capacity) * 100));
              const startDate = new Date(event.start_date);
              
              return (
                <Link href={`/events/${event.id}`} key={event.id} className="group">
                  <div className="bg-card border border-white/10 rounded-[40px] overflow-hidden hover:border-yellow-500/50 transition-all flex flex-col h-full shadow-xl hover:shadow-yellow-500/5">
                    {/* Image Area */}
                    <div className="aspect-[16/10] relative overflow-hidden">
                      <img 
                        src={event.image_url || `https://images.unsplash.com/photo-1540575861501-7ad05823c9f5?q=80&w=800`} 
                        alt={event.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold border border-white/10">
                          {event.status === 'active' ? 'SẮP DIỄN RA' : 'ĐÃ KẾT THÚC'}
                        </span>
                      </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="text-xl font-bold mb-4 line-clamp-2 group-hover:text-yellow-500 transition-colors">
                        {event.title}
                      </h3>
                      
                      <div className="space-y-3 mb-6 flex-1">
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          <Calendar className="w-4 h-4 text-yellow-500" />
                          {startDate.toLocaleDateString('vi-VN')} • {startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          <MapPin className="w-4 h-4 text-yellow-500" />
                          <span className="line-clamp-1">{event.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          <Users className="w-4 h-4 text-yellow-500" />
                          {event.registered_count}/{event.capacity} người tham gia
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2 mb-6">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-yellow-500">Tình trạng chỗ</span>
                          <span className={progress >= 90 ? 'text-red-500' : 'text-white/40'}>{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${progress >= 90 ? 'bg-red-500' : 'bg-yellow-500'}`} 
                            style={{ width: `${progress}%` }} 
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <span className="text-xs font-bold text-yellow-500 flex items-center gap-2">
                          CHI TIẾT <ArrowRight className="w-3 h-3" />
                        </span>
                        <div className="bg-yellow-500/10 p-2 rounded-xl border border-yellow-500/20">
                          <Ticket className="w-4 h-4 text-yellow-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
            <Search className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/40">Không tìm thấy sự kiện nào phù hợp với tìm kiếm của bạn.</p>
          </div>
        )}
      </div>
    </div>
  );
}
