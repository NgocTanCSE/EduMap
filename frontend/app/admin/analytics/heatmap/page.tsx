"use client";
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Map as MapIcon, Layers, Info, Filter, Download } from 'lucide-react';
import { adminService } from '@/reporting/services/admin.service';

// Import Map component dynamic to avoid SSR issues
const MapWithNoSSR = dynamic(() => import('@/components/ui/MapComponent'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-card animate-pulse rounded-3xl" />
});

export default function AdminHeatmapPage() {
  const [stats, setStats] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('Vừa xong');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await adminService.getStats();
        setStats(data);
        setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col">
      {/* Top Controls */}
      <div className="p-6 bg-card border-b border-border flex justify-between items-center z-20">
         <div className="flex items-center gap-4">
            <div className="p-3 bg-primary rounded-2xl">
               <MapIcon className="w-6 h-6 text-white" />
            </div>
            <div>
               <h1 className="text-xl font-bold">Phân tích Mật độ Địa lý</h1>
               <p className="text-xs text-muted-foreground/40">Dữ liệu thời gian thực từ PostGIS Engine.</p>
            </div>
         </div>
         <div className="flex gap-4">
            <div className="flex items-center bg-card/40 rounded-xl px-4 border border-border">
               <span className="text-[10px] font-bold text-muted-foreground/40 uppercase mr-3">Dữ liệu hiển thị:</span>
               <select className="bg-card border-none text-xs font-bold outline-none cursor-pointer text-primary">
                  <option>Mật độ Sinh viên</option>
                  <option>Lượt quyên góp</option>
                  <option>Điểm thực tập</option>
               </select>
            </div>
            <button className="p-3 rounded-xl bg-card border border-border hover:bg-card transition-all">
               <Filter className="w-5 h-5 text-muted-foreground/60" />
            </button>
            <button className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/80 text-xs font-bold flex items-center gap-2 transition-all">
               <Download className="w-4 h-4" /> Xuất dữ liệu GIS
            </button>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
         {/* Sidebar Stats */}
         <div className="w-80 border-r border-border p-6 space-y-8 overflow-y-auto no-scrollbar">
            <div className="p-6 rounded-3xl bg-primary/10 border border-primary/20">
               <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary/70" />
                  Vùng hoạt động mạnh
               </h3>
               <div className="space-y-4">
                  {[
                    { name: 'Tổng người dùng', count: stats?.total_users || '...', color: 'bg-primary' },
                    { name: 'Tổng điểm bản đồ', count: stats?.total_map_points || '...', color: 'bg-green-500' },
                    { name: 'Chờ phê duyệt', count: stats?.pending_approval_points || '...', color: 'bg-primary/80' },
                  ].map(region => (
                    <div key={region.name} className="flex justify-between items-center">
                       <span className="text-xs text-muted-foreground/60">{region.name}</span>
                       <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{region.count}</span>
                          <div className={`w-2 h-2 rounded-full ${region.color}`} />
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="p-6 rounded-3xl bg-card border border-border">
               <h3 className="text-sm font-bold mb-2">Chỉ số giáo dục (AI)</h3>
               <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                     <span className="text-muted-foreground/40">Tỷ lệ nhập học:</span>
                     <span className="text-primary font-bold">{stats?.education_metrics?.enrollment_rate || '96.4%'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                     <span className="text-muted-foreground/40">Tỉ lệ SV/GV:</span>
                     <span className="text-primary font-bold">{stats?.education_metrics?.student_teacher_ratio || '18.5'}</span>
                  </div>
               </div>
            </div>

            <div className="p-6 rounded-3xl bg-card border border-border">
               <h3 className="text-sm font-bold mb-2">Chú giải Heatmap</h3>
               <div className="h-2 w-full bg-primary transition-all rounded-full mb-4" />
               <div className="flex justify-between text-[10px] text-muted-foreground/40 uppercase font-bold">
                  <span>Thấp</span>
                  <span>Trung bình</span>
                  <span>Cao</span>
               </div>
            </div>

            <div className="p-6 rounded-3xl bg-primary/10 border border-primary/10">
               <p className="text-[10px] text-primary font-bold mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" /> THÔNG TIN
               </p>
               <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                  Bản đồ này tổng hợp dữ liệu thực tế từ hệ thống để xác định các khu vực hoạt động mạnh.
               </p>
            </div>
         </div>

         {/* Map Interface */}
         <div className="flex-1 relative">
            <div className="absolute inset-0">
               <MapWithNoSSR />
            </div>
            {/* Map Overlay Badge */}
            <div className="absolute top-6 right-6 p-4 rounded-2xl bg-card border border-border z-10">
               <p className="text-[10px] text-muted-foreground/40 font-bold uppercase mb-1">Cập nhật lúc</p>
               <p className="text-xs font-mono font-bold text-green-400">{lastUpdated}</p>
            </div>
         </div>
      </div>
    </div>
  );
}
