"use client";
import React, { useEffect, useState } from 'react';
import { Atom, Microscope, MapPin, CheckCircle2, MonitorSmartphone, Calendar, Clock, Loader2, Search, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';
import { stemService, StemLab } from '@/src/services/stem.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/ui/Pagination';

export default function StemLabsPage() {
  const [labs, setLabs] = useState<StemLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

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

  const paginatedLabs = filteredLabs.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
  );

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] w-full lg:min-h-screen bg-background text-foreground">
      {/* Booking Modal */}
      {showBookingModal && selectedLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 max-w-md w-full relative shadow-xl">
                <button onClick={() => setShowBookingModal(false)} className="absolute top-5 right-5 rounded-lg p-1 text-muted-foreground/60 hover:text-foreground">
                  ✕
                </button>
                <h3 className="text-xl font-bold mb-1 flex items-center gap-2"><Cpu className="text-primary w-5 h-5"/> Đặt thiết bị STEM</h3>
                <p className="text-xs text-primary font-bold mb-5 truncate">{selectedLab.name}</p>
                
                <div className="p-3.5 bg-muted/50 border border-border rounded-xl mb-5 flex items-center gap-3">
                    <MonitorSmartphone className="w-5 h-5 text-primary" />
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Thiết bị chọn</p>
                        <p className="text-sm font-bold text-foreground">{selectedEquipment}</p>
                    </div>
                </div>

                <form onSubmit={handleBook} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground block mb-1.5 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Ngày mượn *</label>
                            <Input
                                type="date"
                                required
                                value={bookingDate}
                                onChange={e => setBookingDate(e.target.value)}
                                className="h-10 text-xs"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground block mb-1.5 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Giờ nhận *</label>
                            <Input
                                type="time"
                                required
                                value={bookingTime}
                                onChange={e => setBookingTime(e.target.value)}
                                className="h-10 text-xs"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Thời gian sử dụng</label>
                        <Select value={bookingDuration} onChange={e => setBookingDuration(e.target.value)} className="h-10 text-xs">
                            <option value="1">1 Tiếng</option>
                            <option value="2">2 Tiếng</option>
                            <option value="4">4 Tiếng (Nửa ngày)</option>
                        </Select>
                    </div>
                    
                    <Button
                        type="submit"
                        disabled={bookingInProgress}
                        loading={bookingInProgress}
                        icon={<Calendar className="w-4 h-4" />}
                        loadingText="ĐANG ĐẶT..."
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-3 rounded-xl shadow-sm transition-all"
                    >
                        XÁC NHẬN ĐẶT LỊCH
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1"><ShieldCheck className="w-3 h-3 text-primary"/> Xác thực bằng AI chống trùng lịch</p>
                </form>
            </div>
        </div>
      )}

      {/* Full width container using full website dimensions */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        {/* Header Banner */}
        <div className="bg-card p-6 sm:p-8 rounded-2xl border border-border/80 shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-3">
              <Atom className="w-3.5 h-3.5" /> STEM Lab Network
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Hệ Thống Phòng Lab STEM</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Khám phá và đặt lịch sử dụng các thiết bị nghiên cứu khoa học, bộ kit robot và máy in 3D tại các phòng Lab đối tác của EduMap.
            </p>
          </div>
          <div className="relative z-10 w-full md:w-80">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Tìm phòng lab, địa chỉ..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 h-11 bg-background border border-border rounded-xl text-sm focus:border-primary outline-none"
              />
            </div>
          </div>
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Microscope className="w-32 h-32" />
          </div>
        </div>

        {/* Labs Grid - 4 cards per row */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-9 h-9 text-primary animate-spin" /></div>
        ) : filteredLabs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedLabs.map(lab => (
                <div key={lab.id} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm hover:shadow-md transition-all hover:border-primary/50 flex flex-col justify-between group relative">
                  <div className="absolute top-3.5 right-3.5 z-10">
                    <BookmarkButton targetType="stem_lab" targetId={lab.id} size="sm" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3 pr-8">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/20">
                        <CheckCircle2 className="w-3 h-3"/> Đang mở cửa
                      </span>
                    </div>

                    <div className="flex items-start gap-3 mb-2.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
                        <Atom className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 min-h-[3rem]">
                          {lab.name}
                        </h3>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{lab.address || 'Chưa cập nhật địa chỉ'}</span>
                    </p>

                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                      {lab.description || 'Phòng thí nghiệm hiện đại phục vụ nghiên cứu và phát triển kỹ năng thực hành STEM.'}
                    </p>
                  </div>

                  <div>
                    <div className="pt-3 border-t border-border/80 mb-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Thiết bị khả dụng</p>
                      <div className="flex flex-wrap gap-1.5">
                        {lab.equipment && lab.equipment.length > 0 ? (
                          lab.equipment.slice(0, 3).map((eq, i) => (
                            <button
                              key={i}
                              onClick={() => openBookingModal(lab, eq)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/60 hover:bg-primary hover:text-primary-foreground border border-border rounded-md text-[11px] font-medium transition-colors truncate max-w-[150px]"
                              title={`Đặt ${eq}`}
                            >
                              <MonitorSmartphone className="w-3 h-3 shrink-0" />
                              <span className="truncate">{eq}</span>
                            </button>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Thiết bị chung</span>
                        )}
                        {lab.equipment && lab.equipment.length > 3 && (
                          <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded">
                            +{lab.equipment.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => openBookingModal(lab, lab.equipment?.[0] || 'Thiết bị thí nghiệm')}
                      className="w-full py-2.5 px-3 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      Đặt thiết bị ngay <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredLabs.length > pageSize && (
              <div className="pt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredLabs.length / pageSize)}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-card border border-dashed border-border rounded-2xl">
            <Microscope className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Không tìm thấy phòng Lab STEM nào phù hợp.</p>
          </div>
        )}
      </div>
    </div>
  );
}
