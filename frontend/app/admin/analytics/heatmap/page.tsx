"use client";
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Map as MapIcon, Layers, Info, Filter, Download } from 'lucide-react';
import { adminService } from '@/src/services/admin.service';

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
      <div className="p-6 bg-card border-b border-white/10 flex justify-between items-center z-20">
         <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-600 rounded-2xl">
               <MapIcon className="w-6 h-6 text-white" />
            </div>
            <div>
               <h1 className="text-xl font-bold">Phân tích Mật độ Địa lý</h1>
               <p className="text-xs text-white/40">Dữ liệu thời gian thực từ PostGIS Engine.</p>
            </div>
         </div>
         <div className="flex gap-4">
            <div className="flex items-center bg-black/40 rounded-xl px-4 border border-white/5">
               <span className="text-[10px] font-bold text-white/40 uppercase mr-3">Dữ liệu hiển thị:</span>
               <select className="bg-zinc-900 border-none text-xs font-bold outline-none cursor-pointer text-yellow-500">
                  <option>Mật độ Sinh viên</option>
                  <option>Lượt quyên góp</option>
                  <option>Điểm thực tập</option>
               </select>
            </div>
            <button className="p-3 rounded-xl bg-card border border-white/10 hover:bg-card transition-all">
               <Filter className="w-5 h-5 text-white/60" />
            </button>
            <button className="px-6 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-xs font-bold flex items-center gap-2 transition-all">
               <Download className="w-4 h-4" /> Xuất dữ liệu GIS
            </button>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
         {/* Sidebar Stats */}
         <div className="w-80 border-r border-white/10 p-6 space-y-8 overflow-y-auto no-scrollbar">
            <div className="p-6 rounded-3xl bg-yellow-500/10 border border-yellow-500/20">
               <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-yellow-400" />
                  Vùng hoạt động mạnh
               </h3>
               <div className="space-y-4">
                  {[
                    { name: 'Tổng người dùng', count: stats?.total_users || '...', color: 'bg-blue-500' },
                    { name: 'Tổng điểm bản đồ', count: stats?.total_map_points || '...', color: 'bg-green-500' },
                    { name: 'Chờ phê duyệt', count: stats?.pending_approval_points || '...', color: 'bg-yellow-500' },
                  ].map(region => (
                    <div key={region.name} className="flex justify-between items-center">
                       <span className="text-xs text-white/60">{region.name}</span>
                       <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{region.count}</span>
                          <div className={`w-2 h-2 rounded-full ${region.color}`} />
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="p-6 rounded-3xl bg-card border border-white/10">
               <h3 className="text-sm font-bold mb-2">Chỉ số giáo dục (AI)</h3>
               <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                     <span className="text-white/40">Tỷ lệ nhập học:</span>
                     <span className="text-yellow-500 font-bold">{stats?.education_metrics?.enrollment_rate || '96.4%'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                     <span className="text-white/40">Tỉ lệ SV/GV:</span>
                     <span className="text-yellow-500 font-bold">{stats?.education_metrics?.student_teacher_ratio || '18.5'}</span>
                  </div>
               </div>
            </div>

            <div className="p-6 rounded-3xl bg-card border border-white/10">
               <h3 className="text-sm font-bold mb-2">Chú giải Heatmap</h3>
               <div className="h-2 w-full bg-gradient-to-r from-yellow-500 via-yellow-500 to-red-500 rounded-full mb-4" />
               <div className="flex justify-between text-[10px] text-white/40 uppercase font-bold">
                  <span>Thấp</span>
                  <span>Trung bình</span>
                  <span>Cao</span>
               </div>
            </div>

            <div className="p-6 rounded-3xl bg-yellow-500/5 border border-yellow-500/10">
               <p className="text-[10px] text-yellow-500 font-bold mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" /> THÔNG TIN
               </p>
               <p className="text-[11px] text-white/60 leading-relaxed">
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
            <div className="absolute top-6 right-6 p-4 rounded-2xl bg-card border border-white/10 z-10">
               <p className="text-[10px] text-white/40 font-bold uppercase mb-1">Cập nhật lúc</p>
               <p className="text-xs font-mono font-bold text-green-400">{lastUpdated}</p>
            </div>
         </div>
      </div>
    </div>
  );
}
