"use client";
import React from 'react';
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

const roadmapSteps = [
  {
    id: 1,
    title: 'Nền tảng Toán học & Python',
    desc: 'Nắm vững xác suất thống kê, đại số tuyến tính và ngôn ngữ lập trình Python.',
    status: 'completed',
    resources: 12,
    time: '4 tuần',
  },
  {
    id: 2,
    title: 'Machine Learning Fundamentals',
    desc: 'Học về Regression, Classification, Clustering và Scikit-learn.',
    status: 'current',
    resources: 8,
    time: '6 tuần',
  },
  {
    id: 3,
    title: 'Deep Learning & Neural Networks',
    desc: 'Khám phá CNN, RNN và các framework như TensorFlow, PyTorch.',
    status: 'locked',
    resources: 15,
    time: '8 tuần',
  },
  {
    id: 4,
    title: 'LLMs & Generative AI',
    desc: 'Làm chủ Prompt Engineering và Fine-tuning các mô hình ngôn ngữ lớn.',
    status: 'locked',
    resources: 10,
    time: '5 tuần',
  },
];

export default function CareerRoadmapPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-6 mb-12 p-8 rounded-3xl bg-blue-600/10 border border-blue-500/20 relative overflow-hidden">
          <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/40">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Lộ trình: AI Engineer</h1>
            <p className="text-sm text-white/50">Dựa trên kỹ năng hiện tại: Python, Data Analysis</p>
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
          <div className="absolute left-[39px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-500 via-blue-500/20 to-transparent" />

          {roadmapSteps.map((step, index) => (
            <div key={step.id} className={`flex gap-8 relative transition-all ${step.status === 'locked' ? 'opacity-50' : 'opacity-100'}`}>
              {/* Step Circle */}
              <div className={`w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center border-4 z-10 transition-all ${
                step.status === 'completed' ? 'bg-blue-600 border-blue-400' : 
                step.status === 'current' ? 'bg-[#050505] border-blue-500 animate-pulse' : 
                'bg-[#050505] border-white/10'
              }`}>
                {step.status === 'completed' ? <CheckCircle2 className="w-8 h-8 text-white" /> : 
                 step.status === 'current' ? <Play className="w-8 h-8 text-blue-500" /> : 
                 <span className="text-xl font-bold text-white/20">{index + 1}</span>}
              </div>

              {/* Step Content */}
              <div className={`flex-1 p-8 rounded-3xl border transition-all ${
                step.status === 'current' ? 'bg-white/10 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 
                'bg-white/5 border-white/10'
              }`}>
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <h3 className="text-xl font-bold mb-1">{step.title}</h3>
                      <div className="flex gap-4 text-[10px] text-white/40 uppercase font-bold tracking-wider">
                         <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {step.time}</span>
                         <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {step.resources} học liệu</span>
                      </div>
                   </div>
                   {step.status === 'current' && (
                     <span className="px-3 py-1 rounded-full bg-blue-500 text-white text-[10px] font-bold">TIẾP TỤC HỌC</span>
                   )}
                </div>
                <p className="text-sm text-white/60 leading-relaxed mb-6">
                  {step.desc}
                </p>
                <div className="flex gap-4">
                   <button className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                      <GraduationCap className="w-4 h-4" /> Xem bài giảng
                   </button>
                   <button className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                      <Star className="w-4 h-4" />
                   </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Bar */}
        <div className="mt-12 p-8 rounded-3xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-white/10 text-center">
           <h4 className="text-xl font-bold mb-4">Cần trợ giúp từ chuyên gia?</h4>
           <p className="text-sm text-white/50 mb-6">Kết nối với Mentor để được giải đáp các thắc mắc trong lộ trình này.</p>
           <button className="px-8 py-4 rounded-2xl bg-white text-black font-bold text-sm hover:bg-blue-400 transition-colors inline-flex items-center gap-2">
              Đặt lịch Mentor ngay <ChevronRight className="w-4 h-4" />
           </button>
        </div>
      </div>
    </div>
  );
}
