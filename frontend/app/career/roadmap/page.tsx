"use client";
import React, { useEffect, useState } from 'react';
import { 
  Users, 
  MessageSquare, 
  Video, 
  Calendar, 
  Star, 
  ChevronRight, 
  Search, 
  Filter,
  Clock,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Map as MapIcon,
  Play,
  TrendingUp
} from 'lucide-react';

export default function CareerRoadmapPage() {
  const [paths, setPaths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPaths() {
      try {
        const res = await fetch('/api/career/paths');
        if (res.ok) {
          const data = await res.json();
          setPaths(data);
        }
      } catch (error) {
        console.error("Lỗi fetch career paths:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPaths();
  }, []);

  const activePath = paths[0] || null;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-6 mb-12 p-8 rounded-3xl bg-yellow-600/10 border border-yellow-500/20 relative overflow-hidden">
          <div className="p-4 bg-yellow-600 rounded-2xl shadow-lg shadow-yellow-600/40">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Lộ trình: {activePath?.title || "AI Engineer"}</h1>
            <p className="text-sm text-white/50">{activePath?.description || "Bắt đầu hành trình chinh phục kỹ năng mới"}</p>
          </div>
          <div className="text-right">
             <p className="text-xs text-white/40 mb-1">Tiến độ tổng quát</p>
             <p className="text-xl font-bold">25%</p>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <MapIcon className="w-32 h-32" />
          </div>
        </div>

        {/* Roadmap Path */}
        <div className="space-y-4 relative">
          {/* Connecting Line */}
          <div className="absolute left-[39px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-yellow-500 via-yellow-500/20 to-transparent" />

          {loading ? (
            [1, 2].map(i => (
              <div key={i} className="h-40 bg-card animate-pulse rounded-3xl border border-white/10" />
            ))
          ) : (
            (activePath?.roadmap_json || []).map((step: any, index: number) => (
              <div key={index} className={`flex gap-8 relative transition-all`}>
                {/* Step Circle */}
                <div className={`w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center border-4 z-10 transition-all ${
                  index === 0 ? 'bg-yellow-600 border-yellow-400' : 
                  'bg-[#050505] border-white/10'
                }`}>
                  {index === 0 ? <CheckCircle2 className="w-8 h-8 text-white" /> : 
                   <span className="text-xl font-bold text-white/20">{index + 1}</span>}
                </div>

                {/* Step Content */}
                <div className={`flex-1 p-8 rounded-3xl border transition-all ${
                  index === 1 ? 'bg-card border-yellow-500/50 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 
                  'bg-card border-white/10'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h3 className="text-xl font-bold mb-1">{step.title}</h3>
                        <div className="flex gap-4 text-[10px] text-white/40 uppercase font-bold tracking-wider">
                           <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {step.duration || "4 tuần"}</span>
                           <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> 8 học liệu</span>
                        </div>
                     </div>
                     {index === 1 && (
                       <span className="px-3 py-1 rounded-full bg-yellow-500 text-white text-[10px] font-bold">TIẾP TỤC HỌC</span>
                     )}
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed mb-6">
                    {step.description || "Nắm vững các kiến thức nền tảng và thực hành dự án thực tế."}
                  </p>
                  <div className="flex gap-4">
                     <button className="flex-1 py-3 rounded-xl bg-card border border-white/10 text-xs font-bold hover:bg-card transition-all flex items-center justify-center gap-2">
                        <GraduationCap className="w-4 h-4" /> Xem bài giảng
                     </button>
                     <button className="w-12 h-12 rounded-xl bg-card border border-white/10 flex items-center justify-center hover:bg-card transition-all">
                        <Star className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Bar */}
        <div className="mt-12 p-8 rounded-3xl bg-gradient-to-br from-purple-600/20 to-yellow-600/20 border border-white/10 text-center">
           <h4 className="text-xl font-bold mb-4">Cần trợ giúp từ chuyên gia?</h4>
           <p className="text-sm text-white/50 mb-6">Kết nối với Mentor để được giải đáp các thắc mắc trong lộ trình này.</p>
           <button className="px-8 py-4 rounded-2xl bg-white text-black font-bold text-sm hover:bg-yellow-400 transition-colors inline-flex items-center gap-2">
              Đặt lịch Mentor ngay <ChevronRight className="w-4 h-4" />
           </button>
        </div>
      </div>
    </div>
  );
}
