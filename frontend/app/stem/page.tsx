"use client";
import React, { useEffect, useState } from 'react';
import { Atom, Microscope, MapPin, CheckCircle2, MonitorSmartphone, Calendar, Clock, Loader2, Search, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';
import { stemService, StemLab } from '@/src/services/stem.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import ContentShell from '@/components/ui/ContentShell';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import SectionHeader from '@/components/ui/SectionHeader';

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
      // Unwrap backend { success, data: [...] } wrapper if present
      setLabs((data as any).data || (Array.isArray(data) ? data : []) || []);
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
      (lab.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lab.address || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] w-full lg:min-h-screen">
      {/* Booking Modal */}
      {showBookingModal && selectedLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-card border border-border rounded-xl p-8 max-w-md w-full relative">
                <button onClick={() => setShowBookingModal(false)} className="absolute top-4 right-4 rounded-lg p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors">
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
                <h3 className="h2-section mb-2 flex items-center gap-2"><Cpu className="text-accent w-6 h-6"/> Đặt thiết bị STEM</h3>
                <p className="text-sm text-accent font-bold mb-6">{selectedLab.name}</p>
                
                <div className="p-4 bg-card border border-border rounded-lg mb-6 flex items-center gap-3">
                    <MonitorSmartphone className="w-5 h-5 text-muted-foreground/60" />
                    <div>
                        <p className="text-xs text-muted-foreground/60 uppercase tracking-widest font-bold flex items-center gap-2">Thiết bị chọn</p>
                        <p className="font-bold">{selectedEquipment}</p>
                    </div>
                </div>

                <form onSubmit={handleBook} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label-form block mb-2 flex items-center gap-2"><Calendar className="w-4 h-4"/> Ngày mượn *</label>
                            <Input
                                type="date"
                                required
                                value={bookingDate}
                                onChange={e => setBookingDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label-form block mb-2 flex items-center gap-2"><Clock className="w-4 h-4"/> Giờ nhận *</label>
                            <Input
                                type="time"
                                required
                                value={bookingTime}
                                onChange={e => setBookingTime(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="label-form block mb-2">Thời gian sử dụng</label>
                        <Select value={bookingDuration} onChange={e => setBookingDuration(e.target.value)}>
                            <option value="1">1 Tiếng</option>
                            <option value="2">2 Tiếng</option>
                            <option value="4">4 Tiếng (Nửa ngày)</option>
                        </Select>
                    </div>
                    
                    <Button
                        type="submit"
                        disabled={bookingInProgress}
                        loading={bookingInProgress}
                        icon={<Calendar className="w-5 h-5" />}
                        loadingText="ĐANG ĐẶT..."
                        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-lg shadow-accent/20"
                    >
                        XÁC NHẬN ĐẶT LỊCH
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground/60 flex items-center justify-center gap-1"><ShieldCheck className="w-3 h-3"/> Xác thực bằng AI chống trùng lịch</p>
                </form>
            </div>
        </div>
      )}

      <div className="page-shell">
        {/* Header */}
        <div className="bg-card p-6 sm:p-8 rounded-xl border border-border relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="h1-page mb-4">Hệ Thống Phòng Lab STEM</h1>
            <p className="text-muted-foreground/60 max-w-md leading-relaxed">
              Khám phá và đặt lịch sử dụng các thiết bị nghiên cứu khoa học, bộ kit robot và máy in 3D tại các phòng Lab đối tác của EduMap.
            </p>
          </div>
          <div className="relative z-10 mt-6">
            <div className="relative w-full max-w-md">
              <Search className="input-icon" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Tìm phòng lab, địa chỉ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input input-with-icon"
              />
            </div>
          </div>
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Microscope className="w-24 h-24" />
          </div>
        </div>

        {/* Labs List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 text-accent animate-spin" /></div>
        ) : filteredLabs.length > 0 ? (
          <div className="space-y-6">
            {filteredLabs.map(lab => (
              <div key={lab.id} className="p-6 sm:p-8 rounded-xl bg-card border border-border flex flex-col md:flex-row gap-6 sm:gap-8 hover:border-accent/30 transition-colors group">
                <div
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 md:h-32 md:w-32"
                  aria-hidden="true"
                >
                  <Atom className="h-9 w-9 text-primary/60" />
                </div>

                <div className="flex-1 space-y-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="label-pill bg-primary/10 text-primary border border-accent/20 flex items-center gap-1 px-2.5 py-1 rounded-lg">
                                <CheckCircle2 className="w-3 h-3"/> Đang mở cửa
                            </span>
                        </div>
                        <h3 className="h3-card group-hover:text-accent transition-colors">{lab.name}</h3>
                        <p className="text-sm text-muted-foreground/60 flex items-center gap-2 mt-2"><MapPin className="w-4 h-4 text-accent"/> {lab.address || 'Chưa cập nhật địa chỉ'}</p>
                    </div>
                    
                    <p className="text-sm text-muted-foreground/60 leading-relaxed max-w-2xl">
                        {lab.description}
                    </p>

                    <div className="pt-4 border-t border-border">
                        <h4 className="label-form mb-3">Thiết bị khả dụng</h4>
                        <div className="flex flex-wrap gap-2">
                            {lab.equipment && lab.equipment.length > 0 ? lab.equipment.map((eq, i) => (
                                <button
                                    key={i}
                                    onClick={() => openBookingModal(lab, eq)}
                                    className="flex items-center gap-2 px-4 py-2 bg-card border border-border hover:border-accent hover:bg-accent/5 rounded-lg text-sm transition-all group/eq"
                                >
                                    <MonitorSmartphone className="w-4 h-4 text-muted-foreground/60" />
                                    <span>{eq}</span>
                                    <ArrowRight className="w-3 h-3 text-accent opacity-0 group-hover/eq:opacity-100 transition-opacity ml-auto" />
                                </button>
                            )) : (
                                <span className="text-sm text-muted-foreground/60 italic">Chưa có thiết bị nào được liệt kê</span>
                            )}
                        </div>
                    </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
            <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl">
                <Microscope className="w-12 h-12 text-muted-foreground/10 mx-auto mb-4" />
                <p className="text-muted-foreground/60">Không tìm thấy phòng Lab STEM nào.</p>
            </div>
        )}

      </div>
    </div>
  );
}
