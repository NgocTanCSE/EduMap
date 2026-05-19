"use client";
import React from 'react';
import { BrainCircuit, Star, Compass, ArrowRight, ShieldCheck, Zap, Activity, Book } from 'lucide-react';

const paths = [
  { name: 'AI Engineer', match: 85, status: 'High Fit', color: 'text-blue-400' },
  { name: 'Data Scientist', match: 65, status: 'Learning', color: 'text-purple-400' },
  { name: 'Product Manager', match: 40, status: 'Skill Gap', color: 'text-orange-400' },
];

export default function PredictiveCareerPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Profile Analysis */}
        <div className="p-10 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-xl flex gap-10 items-center">
           <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-blue-500/20 flex items-center justify-center relative">
                 <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                 <BrainCircuit className="w-12 h-12 text-blue-500" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-blue-600 p-2 rounded-xl shadow-lg">
                 <Zap className="w-4 h-4 text-white" />
              </div>
           </div>
           <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">Phân tích từ AI</h1>
              <p className="text-sm text-white/50 leading-relaxed mb-6">
                 Dựa trên 15 khóa học đã hoàn thành và các dự án thực tập gần đây, AI của chúng tôi đã mô phỏng được 3 kịch bản nghề nghiệp cho bạn.
              </p>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2 text-[10px] text-green-400 font-bold uppercase tracking-widest bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                    <ShieldCheck className="w-3 h-3" /> Profile Verifed
                 </div>
                 <div className="flex items-center gap-2 text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
                    <Activity className="w-3 h-3" /> Data Driven
                 </div>
              </div>
           </div>
        </div>

        {/* Prediction Paths */}
        <div className="space-y-6">
           <h2 className="text-xl font-bold px-4">Khả năng thích ứng sự nghiệp</h2>
           <div className="grid grid-cols-1 gap-4">
              {paths.map(path => (
                <div key={path.name} className="p-8 rounded-[32px] bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all group flex items-center justify-between">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:bg-blue-600/10 transition-colors">
                         <Compass className={`w-8 h-8 ${path.color}`} />
                      </div>
                      <div>
                         <h3 className="text-xl font-bold">{path.name}</h3>
                         <p className="text-xs text-white/40">{path.status}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-8">
                      <div className="text-right">
                         <p className="text-3xl font-bold">{path.match}%</p>
                         <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Match Score</p>
                      </div>
                      <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
                         <ArrowRight className="w-5 h-5" />
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Next Best Action */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="p-8 rounded-[32px] bg-blue-600/10 border border-blue-500/20">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                 <Star className="w-5 h-5 text-yellow-400" />
                 Kỹ năng cần bổ sung
              </h3>
              <ul className="space-y-4">
                 {['Kỹ năng thuyết trình (Gap: 40%)', 'Tiếng Anh chuyên ngành (Gap: 15%)'].map(skill => (
                   <li key={skill} className="flex items-center gap-3 text-sm text-white/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {skill}
                   </li>
                 ))}
              </ul>
              <button className="w-full mt-8 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all">
                 TÌM KHÓA HỌC PHÙ HỢP
              </button>
           </div>
           <div className="p-8 rounded-[32px] bg-purple-600/10 border border-purple-500/20">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                 <Book className="w-5 h-5 text-purple-400" />
                 Tài liệu gợi ý
              </h3>
              <div className="space-y-4">
                 <div className="p-4 rounded-xl bg-black/20 border border-white/5 hover:bg-black/40 cursor-pointer transition-all">
                    <p className="text-xs font-bold">The AI First Company</p>
                    <p className="text-[10px] text-white/40 mt-1">Ebook • 350 trang</p>
                 </div>
                 <div className="p-4 rounded-xl bg-black/20 border border-white/5 hover:bg-black/40 cursor-pointer transition-all">
                    <p className="text-xs font-bold">Deep Learning Specialization</p>
                    <p className="text-[10px] text-white/40 mt-1">Video • 12 bài giảng</p>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
