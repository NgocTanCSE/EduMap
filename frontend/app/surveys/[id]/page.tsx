"use client";
import React, { useEffect, useState, use } from 'react';
import { ClipboardList, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { surveyService, Survey } from '@/src/services/survey.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import Link from 'next/link';

export default function TakeSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const surveyId = resolvedParams.id;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (surveyId) {
      fetchSurvey();
    }
  }, [surveyId]);

  const fetchSurvey = async () => {
    try {
      setLoading(true);
      const data = await surveyService.getSurveyById(surveyId);
      setSurvey(data);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải chi tiết khảo sát');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionIndex: number, answer: any) => {
      setAnswers(prev => ({
          ...prev,
          [questionIndex]: answer
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!authService.isLoggedIn()) {
          toast.error('Vui lòng đăng nhập để nộp khảo sát');
          window.location.href = `/auth/login?redirect=/surveys/${surveyId}`;
          return;
      }

      try {
          setSubmitting(true);
          const result = await surveyService.submitResponse(surveyId, answers);
          toast.success(result.message);
          setIsCompleted(true);
      } catch (error: any) {
          toast.error(error.message || 'Gửi khảo sát thất bại');
      } finally {
          setSubmitting(false);
      }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-white/60 mb-8">Không tìm thấy cuộc khảo sát này.</p>
        <Link href="/surveys" className="px-8 py-3 rounded-full bg-teal-600 font-bold hover:bg-teal-500 transition-all">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const questions = survey.questions_json || [];

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <Link href="/surveys" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-bold w-fit">
          <ArrowLeft className="w-4 h-4" /> QUAY LẠI
        </Link>

        {isCompleted ? (
            <div className="bg-card border border-teal-500/30 rounded-[40px] p-12 text-center space-y-6 shadow-2xl shadow-teal-500/10">
                <div className="w-24 h-24 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-12 h-12 text-teal-500" />
                </div>
                <h2 className="text-3xl font-black text-teal-400">Khảo sát hoàn tất!</h2>
                <p className="text-white/60 leading-relaxed max-w-md mx-auto">
                    Cảm ơn bạn đã dành thời gian đóng góp ý kiến. Thông tin của bạn sẽ giúp chúng tôi cải thiện hệ thống tốt hơn.
                </p>
                <div className="pt-8">
                    <Link href="/surveys" className="px-8 py-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all inline-block">
                        QUAY LẠI DANH SÁCH
                    </Link>
                </div>
            </div>
        ) : (
            <>
                <div className="bg-gradient-to-br from-teal-900/30 to-emerald-900/10 border border-teal-500/20 rounded-[40px] p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 blur-[80px] rounded-full -mr-10 -mt-10 pointer-events-none" />
                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold uppercase tracking-widest mb-4 border border-teal-500/30">
                            Khảo sát
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black leading-tight mb-2">{survey.title}</h1>
                        <p className="text-white/60 text-sm">Vui lòng trả lời trung thực các câu hỏi dưới đây.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {questions.map((q: any, index: number) => (
                        <div key={index} className="bg-card border border-white/10 rounded-3xl p-8">
                            <h3 className="font-bold mb-4 text-lg">
                                <span className="text-teal-500 mr-2">Câu {index + 1}:</span>
                                {q.text || q.question}
                            </h3>
                            
                            {/* Render different input types based on question data */}
                            {q.type === 'text' || !q.options ? (
                                <textarea 
                                    required
                                    rows={4}
                                    value={answers[index] || ''}
                                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                                    placeholder="Nhập câu trả lời của bạn..."
                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-teal-500 outline-none resize-none"
                                />
                            ) : (
                                <div className="space-y-3">
                                    {q.options.map((opt: string, i: number) => (
                                        <label key={i} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${answers[index] === opt ? 'bg-teal-500/10 border-teal-500/50' : 'bg-zinc-900 border-white/10 hover:border-white/20'}`}>
                                            <input 
                                                type="radio" 
                                                name={`question_${index}`}
                                                value={opt}
                                                checked={answers[index] === opt}
                                                onChange={(e) => handleAnswerChange(index, e.target.value)}
                                                required
                                                className="w-4 h-4 accent-teal-500 bg-zinc-800 border-white/10"
                                            />
                                            <span className="text-sm">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    <div className="bg-card border border-white/10 rounded-3xl p-8 text-center space-y-4">
                        <p className="text-xs text-white/40 mb-4">Bằng việc nộp khảo sát, bạn đồng ý cung cấp các thông tin trên cho EduMap phục vụ mục đích phân tích.</p>
                        <button 
                            type="submit"
                            disabled={submitting}
                            className="w-full md:w-auto px-12 py-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all shadow-lg shadow-teal-600/20 disabled:opacity-50 flex justify-center items-center gap-2 mx-auto"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                            GỬI CÂU TRẢ LỜI
                        </button>
                    </div>
                </form>
            </>
        )}
      </div>
    </div>
  );
}
