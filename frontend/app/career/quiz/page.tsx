"use client";
import React, { useState } from 'react';
import { Sparkles, BrainCircuit, Target, ArrowRight, ArrowLeft, Trophy, Map, Loader2 } from 'lucide-react';
import { careerService } from '@/src/services/career.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';

const QUESTIONS = [
  { id: 1, text: "Bạn thích làm việc với con người hay máy móc?", options: ["Con người", "Máy móc", "Cả hai"] },
  { id: 2, text: "Kỹ năng nào bạn tự tin nhất?", options: ["Lập trình", "Thiết kế", "Quản lý", "Viết lách"] },
  { id: 3, text: "Bạn thích môi trường làm việc như thế nào?", options: ["Năng động", "Yên tĩnh", "Linh hoạt"] },
  { id: 4, text: "Mức thu nhập kỳ vọng của bạn là bao nhiêu?", options: ["Dưới 15tr", "15tr - 30tr", "Trên 30tr"] },
];

export default function CareerQuizPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleNext = async (option: string) => {
    const newAnswers = [...answers, option];
    setAnswers(newAnswers);
    
    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      if (!authService.isLoggedIn()) {
        toast.error("Vui lòng đăng nhập để AI có thể lưu và phân tích kết quả của bạn.");
        window.location.href = '/auth/login?redirect=/career/quiz';
        return;
      }

      setLoading(true);
      setIsFinished(true);
      try {
        const data = await careerService.getCareerSuggestions();
        setSuggestions(Array.isArray(data) ? data : []);
        toast.success("AI đã hoàn tất phân tích!");
      } catch (error: any) {
        console.error("Lỗi AI suggest:", error);
        toast.error(error.message || "Không thể lấy gợi ý từ AI");
      } finally {
        setLoading(false);
      }
    }
  };

  if (isFinished) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-8 flex items-center justify-center">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/50">
              <Trophy className="text-yellow-500 w-10 h-10" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Kết quả Phân tích từ AI</h1>
            <p className="text-gray-400">Dựa trên câu trả lời và hồ sơ của bạn, EduMap AI đề xuất các lộ trình phù hợp nhất</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
              <p className="text-yellow-500 font-bold animate-pulse">AI đang phân tích hồ sơ và câu trả lời của bạn...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {suggestions.length > 0 ? suggestions.map((item, idx) => (
                <div key={idx} className="bg-card border border-white/10 p-6 rounded-3xl hover:border-yellow-500/50 transition-all group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="bg-yellow-600/20 p-3 rounded-2xl"><BrainCircuit className="text-yellow-500" /></div>
                    <span className="text-sm font-bold text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded-full">
                      Phù hợp: {item.match_score || 90}%
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold mb-3">{item.title}</h2>
                  <p className="text-gray-400 text-sm mb-6 line-clamp-2">{item.explanation || item.description}</p>
                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-2 text-sm text-gray-300"><Target className="w-4 h-4 text-green-500" /> Nhu cầu: {item.demand_level || 'Cao'}</div>
                    <div className="flex items-center gap-2 text-sm text-gray-300"><Map className="w-4 h-4 text-green-500" /> Kỹ năng: {item.missing_skills?.slice(0, 2).join(', ') || 'Đang cập nhật'}</div>
                  </div>
                  <button 
                    onClick={() => window.location.href = `/career/roadmap?title=${encodeURIComponent(item.title)}`}
                    className="w-full py-3 bg-yellow-600 rounded-xl font-bold group-hover:bg-yellow-700 transition-all"
                  >
                    Xem lộ trình chi tiết
                  </button>
                </div>
              )) : (
                <div className="col-span-2 text-center py-10 bg-white/5 rounded-3xl border border-dashed border-white/10">
                   <p className="text-white/40 mb-6">AI chưa tìm thấy lộ trình phù hợp ngay lúc này. Hãy thử cập nhật thêm kỹ năng trong hồ sơ nhé.</p>
                   <button onClick={() => window.location.href = '/career/profile'} className="text-yellow-500 font-bold hover:underline">CẬP NHẬT HỒ SƠ</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const progress = ((currentStep + 1) / QUESTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-yellow-600/10 rounded-full blur-[120px]" />
      
      <div className="max-w-2xl w-full relative z-10">
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Câu hỏi {currentStep + 1} / {QUESTIONS.length}</span>
            <span>{Math.round(progress)}% hoàn thành</span>
          </div>
          <div className="h-2 w-full bg-card rounded-full overflow-hidden">
            <div className="h-full bg-yellow-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-card border border-white/10 rounded-3xl p-10 shadow-2xl">
          <h2 className="text-3xl font-bold mb-8 leading-tight">{QUESTIONS[currentStep].text}</h2>
          <div className="space-y-4">
            {QUESTIONS[currentStep].options.map((option) => (
              <button
                key={option}
                onClick={() => handleNext(option)}
                className="w-full p-6 text-left bg-card border border-white/10 rounded-2xl hover:bg-yellow-600/20 hover:border-yellow-600 transition-all group flex justify-between items-center"
              >
                <span className="text-lg font-medium">{option}</span>
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
          className={`mt-8 flex items-center gap-2 text-gray-500 hover:text-white transition-colors ${currentStep === 0 ? 'opacity-0 pointer-events-none' : ''}`}
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại câu trước
        </button>
      </div>
    </div>
  );
}
