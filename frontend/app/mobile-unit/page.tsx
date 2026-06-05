"use client";
import React, { useEffect, useState } from 'react';
import { Truck, MapPin, Calendar, BookOpen, Navigation, Loader2, ArrowRight, Clock, ShieldCheck, Map as MapIcon } from 'lucide-react';
import { mobileUnitService, MobileUnit } from '@/src/services/mobile-unit.service';
import { toast } from 'sonner';
import Link from 'next/link';

export default function MobileUnitPage() {
  const [units, setUnits] = useState<MobileUnit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      setLoading(true);
      const data = await mobileUnitService.getUnits();
      setUnits(data);
    } catch (error: any) {
      toast.error(error.message || 'Lỗi tải danh sách xe tri thức');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest">
                <Truck className="w-4 h-4" /> EduMap Mobile Library
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Xe Tri Thức Lưu Động</h1>
            <p className="text-white/60 leading-relaxed">
                Hệ thống xe thư viện di động mang sách, công nghệ và các lớp học STEM đến với trẻ em ở những khu vực vùng sâu, vùng xa chưa có điều kiện tiếp cận.
            </p>
        </div>

        {/* Units List */}
        <div>
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-cyan-500 animate-spin" /></div>
            ) : units.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {units.map(unit => (
                        <Link href={`/mobile-unit/${unit.id}`} key={unit.id} className="group">
                            <div className="bg-card border border-white/10 rounded-[32px] p-8 hover:border-cyan-500/50 transition-all hover:bg-cyan-500/5 relative overflow-hidden h-full flex flex-col">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 blur-[60px] rounded-full -mr-10 -mt-10 pointer-events-none" />
                                
                                <div className="flex justify-between items-start mb-6 relative z-10">
                                    <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                                        <Truck className="w-8 h-8 text-cyan-400" />
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                                        unit.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 
                                        'bg-zinc-800 text-white/40 border-white/10'
                                    }`}>
                                        {unit.status === 'active' ? 'ĐANG HOẠT ĐỘNG' : 'ĐANG BẢO TRÌ'}
                                    </span>
                                </div>
                                
                                <h3 className="text-2xl font-bold mb-2 group-hover:text-cyan-400 transition-colors relative z-10">{unit.name}</h3>
                                <p className="text-white/50 text-sm mb-6 flex-1 relative z-10 line-clamp-3">
                                    {unit.description || 'Chưa có thông tin mô tả cho xe tri thức này.'}
                                </p>
                                
                                <div className="space-y-3 pt-6 border-t border-white/5 relative z-10">
                                    <div className="flex items-center gap-3 text-xs text-white/70">
                                        <ShieldCheck className="w-4 h-4 text-cyan-500" />
                                        Biển số: <strong className="text-white">{unit.vehicle_plate}</strong>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-white/70">
                                        <MapPin className="w-4 h-4 text-blue-500" />
                                        Vị trí: {unit.current_location ? 'Đang cập nhật GPS Real-time' : 'Chưa xác định'}
                                    </div>
                                </div>
                                
                                <div className="mt-8 flex items-center justify-between text-xs font-bold text-cyan-400 group-hover:translate-x-2 transition-transform w-fit relative z-10">
                                    XEM LỊCH TRÌNH & VỊ TRÍ <ArrowRight className="w-4 h-4 ml-1" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                    <Truck className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40">Hệ thống chưa có xe tri thức lưu động nào.</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
