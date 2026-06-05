"use client";
import React, { useEffect, useState } from 'react';
import { BrainCircuit, Star, Compass, ArrowRight, ShieldCheck, Zap, Activity, Book, Loader2, AlertCircle } from 'lucide-react';
import { careerService } from '@/src/services/career.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';

interface CareerPath {
  title: string;
  match_score: number;
  explanation: string;
  missing_skills: string[];
  status?: string;
  color?: string;
}

export default function PredictiveCareerPage() {
  const [paths, setPaths] = useState<CareerPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAIAdvice();
  }, []);

  const fetchAIAdvice = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!authService.isLoggedIn()) {
        setError("Vui lòng đăng nhập để xem phân tích sự nghiệp từ AI.");
        setLoading(false);
        return;
      }

      const data = await careerService.getAIAdvice();
      // Assume data returned is an array of recommendations from AI
      if (Array.isArray(data)) {
        setPaths(data.map((p: any, idx: number) => ({
          ...p,
          status: p.match_score > 80 ? 'High Fit' : p.match_score > 60 ? 'Learning' : 'Skill Gap',
          color: idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-purple-400' : 'text-orange-400'
        })));
      } else {
        setPaths([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch AI advice:", err);
      setError(err.message || "Không thể kết nối với trí tuệ nhân tạo. Vui lòng thử lại sau.");
      toast.error("Lỗi phân tích AI");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
        <p className="text-yellow-500 font-bold animate-pulse uppercase tracking-widest text-xs">AI đang đọc hồ sơ của bạn...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-10 rounded-[40px] max-w-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Ối! Đã có lỗi xảy ra</h2>
          <p className="text-white/60 mb-8">{error}</p>
          {!authService.isLoggedIn() ? (
            <button 
              onClick={() => window.location.href = '/auth/login?redirect=/career/predictive'}
              className="px-8 py-3 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all"
            >
              ĐĂNG NHẬP NGAY
            </button>
          ) : (
            <button 
              onClick={fetchAIAdvice}
              className="px-8 py-3 bg-zinc-800 font-bold rounded-2xl hover:bg-zinc-700 transition-all"
            >
              THỬ LẠI
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Profile Analysis */}
        <div className="p-10 rounded-[40px] bg-card border border-white/10 flex flex-col md:flex-row gap-10 items-center">
           <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-yellow-500/20 flex items-center justify-center relative">
                 <div className="absolute inset-0 rounded-full border-4 border-yellow-500 border-t-transparent animate-spin-slow" />
                 <BrainCircuit className="w-12 h-12 text-yellow-500" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-yellow-600 p-2 rounded-xl shadow-lg">
                 <Zap className="w-4 h-4 text-white" />
              </div>
           </div>
           <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold mb-2">Phân tích từ AI</h1>
              <p className="text-sm text-white/50 leading-relaxed mb-6">
                 Dựa trên lịch sử học tập, kỹ năng hiện tại và các tương tác của bạn trên hệ thống EduMap, AI đã mô phỏng các kịch bản nghề nghiệp phù hợp nhất.
              </p>
              <div className="flex gap-4 justify-center md:justify-start">
                 <div className="flex items-center gap-2 text-[10px] text-green-400 font-bold uppercase tracking-widest bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                    <ShieldCheck className="w-3 h-3" /> Profile Verified
                 </div>
                 <div className="flex items-center gap-2 text-[10px] text-yellow-400 font-bold uppercase tracking-widest bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/20">
                    <Activity className="w-3 h-3" /> Data Driven
                 </div>
              </div>
           </div>
        </div>

        {/* Prediction Paths */}
        <div className="space-y-6">
           <h2 className="text-xl font-bold px-4">Khả năng thích ứng sự nghiệp</h2>
           <div className="grid grid-cols-1 gap-4">
              {paths.length > 0 ? paths.map(path => (
                <div key={path.title} className="p-8 rounded-[32px] bg-card border border-white/10 hover:border-yellow-500/30 transition-all group flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-card border border-white/5 flex items-center justify-center group-hover:bg-yellow-600/10 transition-colors">
                         <Compass className={`w-8 h-8 ${path.color}`} />
                      </div>
                      <div>
                         <h3 className="text-xl font-bold">{path.title}</h3>
                         <p className="text-xs text-white/40">{path.status} • {path.explanation}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-8">
                      <div className="text-right">
                         <p className="text-3xl font-bold">{path.match_score}%</p>
                         <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Match Score</p>
                      </div>
                      <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
                         <ArrowRight className="w-5 h-5" />
                      </div>
                   </div>
                </div>
              )) : (
                <div className="p-10 text-center border border-dashed border-white/10 rounded-[32px]">
                   <p className="text-white/30">AI chưa có đủ dữ liệu để phân tích. Hãy hoàn thành thêm các khóa học và cập nhật kỹ năng nhé!</p>
                </div>
              )}
           </div>
        </div>

        {/* Next Best Action */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="p-8 rounded-[32px] bg-yellow-600/10 border border-yellow-500/20">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                 <Star className="w-5 h-5 text-yellow-400" />
                 Kỹ năng ưu tiên
              </h3>
              <ul className="space-y-4">
                 {paths[0]?.missing_skills?.slice(0, 3).map(skill => (
                   <li key={skill} className="flex items-center gap-3 text-sm text-white/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                      {skill}
                   </li>
                 )) || (
                   <li className="text-sm text-white/40 italic">Cập nhật kỹ năng để nhận gợi ý</li>
                 )}
              </ul>
              <button 
                onClick={() => window.location.href = '/library'}
                className="w-full mt-8 py-3 rounded-2xl bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold transition-all"
              >
                 KHÁM PHÁ HỌC LIỆU
              </button>
           </div>
           <div className="p-8 rounded-[32px] bg-purple-600/10 border border-purple-500/20">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                 <Book className="w-5 h-5 text-purple-400" />
                 Tài liệu gợi ý từ AI
              </h3>
              <div className="space-y-4">
                 <div className="p-4 rounded-xl bg-black/20 border border-white/5 hover:bg-black/40 cursor-pointer transition-all">
                    <p className="text-xs font-bold">Lộ trình học tập cá nhân hóa</p>
                    <p className="text-[10px] text-white/40 mt-1">Dựa trên kịch bản {paths[0]?.title || 'nghề nghiệp'}</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
