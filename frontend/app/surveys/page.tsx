"use client";
import React, { useEffect, useState } from 'react';
import { ClipboardList, ArrowRight, Loader2, Calendar, FileText } from 'lucide-react';
import { surveyService, Survey } from '@/src/services/survey.service';
import { toast } from 'sonner';
import Link from 'next/link';

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const data = await surveyService.getSurveys();
      setSurveys(data);
    } catch (error: any) {
      toast.error('Lỗi khi tải danh sách khảo sát');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-gradient-to-br from-teal-900/30 to-emerald-900/20 p-12 rounded-[40px] border border-white/5 relative overflow-hidden">
          <div className="relative z-10 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black mb-4">Ý Kiến Đóng Góp</h1>
            <p className="text-white/60 max-w-xl leading-relaxed">
              Lắng nghe tiếng nói của học sinh, sinh viên. Mọi ý kiến của bạn đều giúp EduMap cải thiện chất lượng giáo dục và các hoạt động cộng đồng.
            </p>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <ClipboardList className="w-64 h-64" />
          </div>
        </div>

        {/* Survey List */}
        <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><FileText className="text-teal-500 w-6 h-6"/> Khảo sát hiện có</h2>
            
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-teal-500 animate-spin" /></div>
            ) : surveys.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {surveys.map(survey => (
                        <Link href={`/surveys/${survey.id}`} key={survey.id} className="group">
                            <div className="bg-card border border-white/10 rounded-3xl p-6 hover:border-teal-500/50 transition-all flex flex-col h-full shadow-xl">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-teal-500/10 rounded-xl">
                                        <ClipboardList className="w-6 h-6 text-teal-500" />
                                    </div>
                                    <span className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold uppercase rounded border border-green-500/20">
                                        ĐANG MỞ
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold mb-4 group-hover:text-teal-400 transition-colors line-clamp-2 flex-1">
                                    {survey.title}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-white/40 mb-6 pt-4 border-t border-white/5">
                                    <Calendar className="w-4 h-4" /> Đăng ngày {new Date(survey.created_at).toLocaleDateString('vi-VN')}
                                </div>
                                <div className="flex items-center justify-between text-xs font-bold text-teal-500 group-hover:translate-x-2 transition-transform w-fit">
                                    THAM GIA KHẢO SÁT <ArrowRight className="w-4 h-4 ml-1" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                    <ClipboardList className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40">Hiện tại không có cuộc khảo sát nào.</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
