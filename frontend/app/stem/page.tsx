"use client";
import React, { useEffect, useState } from 'react';
import { Microscope, MapPin, CheckCircle2, MonitorSmartphone, Calendar, Clock, Loader2, Search, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';
import { stemService, StemLab } from '@/src/services/stem.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';

export default function StemLabsPage() {
  const [labs, setLabs] = useState<StemLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Booking Modal
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedLab, setSelectedLab] = useState<StemLab | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingDuration, setBookingDuration] = useState('2');
  const [bookingInProgress, setBookingInProgress] = useState(false);

  useEffect(() => {
    fetchLabs();
  }, []);

  const fetchLabs = async () => {
    try {
      setLoading(true);
      const data = await stemService.getLabs();
      setLabs(data);
    } catch (error: any) {
      toast.error('Không thể tải danh sách STEM Lab');
    } finally {
      setLoading(false);
    }
  };

  const openBookingModal = (lab: StemLab, eq: string) => {
      if (!authService.isLoggedIn()) {
          toast.error('Vui lòng đăng nhập để đặt thiết bị');
          window.location.href = '/auth/login?redirect=/stem';
          return;
      }
      setSelectedLab(lab);
      setSelectedEquipment(eq);
      setShowBookingModal(true);
  };

  const handleBook = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedLab || !selectedEquipment) return;
      if (!bookingDate || !bookingTime) {
          toast.error('Vui lòng chọn ngày và giờ');
          return;
      }

      // Calculate start and end times
      const start = new Date(`${bookingDate}T${bookingTime}:00`);
      const end = new Date(start.getTime() + Number(bookingDuration) * 60 * 60 * 1000);

      if (start < new Date()) {
          toast.error('Thời gian đặt phải trong tương lai');
          return;
      }

      try {
          setBookingInProgress(true);
          const result = await stemService.bookEquipment(
              selectedLab.id, 
              selectedEquipment, 
              start.toISOString(), 
              end.toISOString()
          );
          toast.success(`Đặt thành công! Mã Code: ${result.booking_id}`);
          setShowBookingModal(false);
      } catch (error: any) {
          toast.error(error.message);
      } finally {
          setBookingInProgress(false);
      }
  };

  const filteredLabs = labs.filter(lab => 
      lab.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      lab.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 relative">
      
      {/* Booking Modal */}
      {showBookingModal && selectedLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#121215] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                <button onClick={() => setShowBookingModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white">X</button>
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Cpu className="text-cyan-500 w-6 h-6"/> Đặt thiết bị STEM</h3>
                <p className="text-sm text-cyan-400 font-bold mb-6">{selectedLab.name}</p>
                
                <div className="p-4 bg-zinc-900 border border-white/10 rounded-xl mb-6 flex items-center gap-3">
                    <MonitorSmartphone className="w-5 h-5 text-white/40" />
                    <div>
                        <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Thiết bị chọn</p>
                        <p className="font-bold">{selectedEquipment}</p>
                    </div>
                </div>

                <form onSubmit={handleBook} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2 flex items-center gap-2"><Calendar className="w-4 h-4"/> Ngày mượn *</label>
                            <input 
                                type="date" 
                                required
                                value={bookingDate}
                                onChange={e => setBookingDate(e.target.value)}
                                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-cyan-500 outline-none" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2 flex items-center gap-2"><Clock className="w-4 h-4"/> Giờ nhận *</label>
                            <input 
                                type="time" 
                                required
                                value={bookingTime}
                                onChange={e => setBookingTime(e.target.value)}
                                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-cyan-500 outline-none" 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Thời gian sử dụng</label>
                        <select 
                            value={bookingDuration}
                            onChange={e => setBookingDuration(e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-cyan-500 outline-none appearance-none" 
                        >
                            <option value="1">1 Tiếng</option>
                            <option value="2">2 Tiếng</option>
                            <option value="4">4 Tiếng (Nửa ngày)</option>
                        </select>
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={bookingInProgress}
                        className="w-full py-4 mt-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black font-black transition-all shadow-lg shadow-cyan-600/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {bookingInProgress ? <Loader2 className="w-5 h-5 animate-spin" /> : null} XÁC NHẬN ĐẶT LỊCH
                    </button>
                    <p className="text-[10px] text-center text-white/40 flex items-center justify-center gap-1"><ShieldCheck className="w-3 h-3"/> Xác thực bằng AI chống trùng lịch</p>
                </form>
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-gradient-to-br from-cyan-600/20 to-blue-600/10 p-12 rounded-[40px] border border-white/5 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-4xl font-black mb-4">Hệ Thống Phòng Lab STEM</h1>
            <p className="text-white/60 max-w-md leading-relaxed">
              Khám phá và đặt lịch sử dụng các thiết bị nghiên cứu khoa học, bộ kit robot và máy in 3D tại các phòng Lab đối tác của EduMap.
            </p>
          </div>
          <div className="relative z-10">
             <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input 
                  type="text" 
                  placeholder="Tìm phòng lab, địa chỉ..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-cyan-500 transition-colors backdrop-blur-md" 
                />
             </div>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Microscope className="w-64 h-64" />
          </div>
        </div>

        {/* Labs List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-cyan-500 animate-spin" /></div>
        ) : filteredLabs.length > 0 ? (
          <div className="space-y-6">
            {filteredLabs.map(lab => (
              <div key={lab.id} className="p-8 rounded-3xl bg-card border border-white/10 flex flex-col md:flex-row gap-8 hover:border-cyan-500/30 transition-colors group">
                <div className="w-24 h-24 shrink-0 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center">
                    <Microscope className="w-10 h-10 text-cyan-500/50 group-hover:text-cyan-400 transition-colors" />
                </div>

                <div className="flex-1 space-y-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold uppercase rounded border border-green-500/20 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3"/> Đang mở cửa
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold group-hover:text-cyan-400 transition-colors">{lab.name}</h3>
                        <p className="text-sm text-white/60 flex items-center gap-2 mt-2"><MapPin className="w-4 h-4 text-cyan-500"/> {lab.address}</p>
                    </div>
                    
                    <p className="text-sm text-white/60 leading-relaxed max-w-2xl">
                        {lab.description}
                    </p>

                    <div className="pt-4 border-t border-white/5">
                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Thiết bị khả dụng</h4>
                        <div className="flex flex-wrap gap-3">
                            {lab.equipment && lab.equipment.length > 0 ? lab.equipment.map((eq, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => openBookingModal(lab, eq)}
                                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/10 hover:border-cyan-500 hover:bg-cyan-500/5 rounded-xl text-sm transition-all"
                                >
                                    <MonitorSmartphone className="w-4 h-4 text-white/40" />
                                    <span>{eq}</span>
                                    <ArrowRight className="w-3 h-3 text-cyan-500 opacity-0 -ml-2 transition-all" />
                                </button>
                            )) : (
                                <span className="text-sm text-white/40 italic">Chưa có thiết bị nào được liệt kê</span>
                            )}
                        </div>
                    </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
            <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                <Microscope className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40">Không tìm thấy phòng Lab STEM nào.</p>
            </div>
        )}

      </div>
    </div>
  );
}
