"use client";
import React, { useState } from 'react';
import { Sparkles, BrainCircuit, Target, ArrowRight, ArrowLeft, Trophy, Map } from 'lucide-react';

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

  const handleNext = (option: string) => {
    const newAnswers = [...answers, option];
    setAnswers(newAnswers);
    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsFinished(true);
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
            <p className="text-gray-400">Dựa trên câu trả lời của bạn, EduMap AI đề xuất 2 lộ trình phù hợp nhất</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Career Card 1 */}
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl hover:border-blue-500/50 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className="bg-blue-600/20 p-3 rounded-2xl"><BrainCircuit className="text-blue-500" /></div>
                <span className="text-sm font-bold text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full">Độ phù hợp: 95%</span>
              </div>
              <h2 className="text-2xl font-bold mb-3">Backend Developer</h2>
              <p className="text-gray-400 text-sm mb-6">Phù hợp với tư duy logic và sở thích làm việc với máy móc của bạn.</p>
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm text-gray-300"><Target className="w-4 h-4 text-green-500" /> Kỹ năng cần thêm: NestJS, Docker</div>
                <div className="flex items-center gap-2 text-sm text-gray-300"><Map className="w-4 h-4 text-green-500" /> Lộ trình: 6 - 8 tháng</div>
              </div>
              <button className="w-full py-3 bg-blue-600 rounded-xl font-bold group-hover:bg-blue-700 transition-all">Xem lộ trình chi tiết</button>
            </div>

            {/* Career Card 2 */}
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl hover:border-purple-500/50 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className="bg-purple-600/20 p-3 rounded-2xl"><Sparkles className="text-purple-500" /></div>
                <span className="text-sm font-bold text-purple-500 bg-purple-500/10 px-3 py-1 rounded-full">Độ phù hợp: 82%</span>
              </div>
              <h2 className="text-2xl font-bold mb-3">DevOps Engineer</h2>
              <p className="text-gray-400 text-sm mb-6">Phù hợp với mong muốn môi trường làm việc linh hoạt và thu nhập cao.</p>
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm text-gray-300"><Target className="w-4 h-4 text-green-500" /> Kỹ năng cần thêm: AWS, Kubernetes</div>
                <div className="flex items-center gap-2 text-sm text-gray-300"><Map className="w-4 h-4 text-green-500" /> Lộ trình: 12 tháng</div>
              </div>
              <button className="w-full py-3 bg-purple-600 rounded-xl font-bold group-hover:bg-purple-700 transition-all">Xem lộ trình chi tiết</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progress = ((currentStep + 1) / QUESTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
      
      <div className="max-w-2xl w-full relative z-10">
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Câu hỏi {currentStep + 1} / {QUESTIONS.length}</span>
            <span>{Math.round(progress)}% hoàn thành</span>
          </div>
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl">
          <h2 className="text-3xl font-bold mb-8 leading-tight">{QUESTIONS[currentStep].text}</h2>
          <div className="space-y-4">
            {QUESTIONS[currentStep].options.map((option) => (
              <button
                key={option}
                onClick={() => handleNext(option)}
                className="w-full p-6 text-left bg-white/5 border border-white/10 rounded-2xl hover:bg-blue-600/20 hover:border-blue-600 transition-all group flex justify-between items-center"
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
