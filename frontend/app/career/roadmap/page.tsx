"use client";
import React, { useEffect, useState } from 'react';
import { 
  Users, 
  ChevronRight, 
  Clock,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Map as MapIcon,
  TrendingUp,
  BrainCircuit,
  Loader2,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export default function CareerRoadmapPage() {
  const [roadmap, setRoadmap] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [targetRole, setTargetRole] = useState('Fullstack Developer');
  const [currentLevel, setCurrentLevel] = useState('Beginner');
  const [hoursPerWeek, setHoursPerWeek] = useState(15);

  const generateRoadmap = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch('/api/ai/learning-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_role: targetRole,
          current_level: currentLevel,
          time_commitment_hours_per_week: hoursPerWeek
        })
      });
      
      if (!res.ok) throw new Error('Không thể tạo lộ trình');
      const data = await res.json();
      setRoadmap(data);
      toast.success('Lộ trình AI đã được khởi tạo!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi kết nối với AI Service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Input Section */}
        <div className="mb-12 p-8 rounded-[2.5rem] bg-zinc-900/50 border border-white/5 backdrop-blur-xl">
           <div className="flex items-center gap-2 text-yellow-500 mb-6 uppercase text-[10px] font-black tracking-[0.2em]">
              <BrainCircuit className="w-4 h-4" /> AI Personalized Generator
           </div>
           <h2 className="text-3xl font-black mb-8">Bạn muốn trở thành ai?</h2>
           
           <form onSubmit={generateRoadmap} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                 <label className="text-[10px] uppercase font-bold text-white/40 ml-2">Mục tiêu nghề nghiệp</label>
                 <input 
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:ring-1 focus:ring-yellow-500 transition-all text-sm"
                    placeholder="VD: Data Scientist"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] uppercase font-bold text-white/40 ml-2">Trình độ hiện tại</label>
                 <select 
                    value={currentLevel}
                    onChange={(e) => setCurrentLevel(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:ring-1 focus:ring-yellow-500 transition-all text-sm appearance-none"
                 >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                 </select>
              </div>
              <div className="flex items-end">
                 <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl transition-all shadow-xl shadow-yellow-500/10 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                 >
                    {loading ? <Loader2 className="animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {loading ? "Đang xử lý..." : "Tạo lộ trình"}
                 </button>
              </div>
           </form>
        </div>

        {roadmap && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header */}
            <div className="flex items-center gap-6 mb-12 p-8 rounded-3xl bg-yellow-600/10 border border-yellow-500/20 relative overflow-hidden">
              <div className="p-4 bg-yellow-600 rounded-2xl shadow-lg shadow-yellow-600/40">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">Lộ trình: {roadmap.target_role}</h1>
                <p className="text-sm text-white/50">Dự kiến hoàn thành trong {roadmap.total_estimated_months} tháng</p>
              </div>
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <MapIcon className="w-32 h-32" />
              </div>
            </div>

            {/* Roadmap Path */}
            <div className="space-y-4 relative">
              <div className="absolute left-[39px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-yellow-500 via-yellow-500/20 to-transparent" />

              {roadmap.steps?.map((step: any, index: number) => (
                <div key={index} className="flex gap-8 relative group">
                  <div className={`w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center border-4 z-10 transition-all ${
                    index === 0 ? 'bg-yellow-600 border-yellow-400' : 'bg-[#050505] border-white/10 group-hover:border-yellow-500/30'
                  }`}>
                    <span className="text-xl font-bold text-white">{step.step_number}</span>
                  </div>

                  <div className="flex-1 p-8 rounded-[2rem] border border-white/5 bg-zinc-900/30 backdrop-blur-sm group-hover:border-yellow-500/20 transition-all">
                    <div className="flex justify-between items-start mb-4">
                       <div>
                          <h3 className="text-xl font-black mb-1 text-yellow-500/90">{step.title}</h3>
                          <div className="flex gap-4 text-[10px] text-white/30 uppercase font-black tracking-widest">
                             <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {step.estimated_weeks} tuần</span>
                             <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> AI Curated Resources</span>
                          </div>
                       </div>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!roadmap && !loading && (
            <div className="text-center py-20 border border-dashed border-white/5 rounded-[3rem]">
                <p className="text-white/20 font-black uppercase tracking-widest text-xs">Vui lòng nhập mục tiêu để bắt đầu</p>
            </div>
        )}
      </div>
    </div>
  );
}
