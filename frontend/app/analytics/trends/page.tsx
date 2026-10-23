"use client";
import React, { useEffect, useState } from 'react';
import { TrendingUp, BarChart3, PieChart, Zap, ArrowUpRight, Globe, Target, Cpu, Loader2 } from 'lucide-react';
import { analyticsService } from '@/reporting/services/analytics.service';
import { toast } from 'sonner';

export default function AITrendsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const r = await analyticsService.getAiTrends();
        if (r.success === true || r.status === 'success' || r.status === 'online') {
          setData(r);
        } else {
          console.warn('AI trends response:', r);
        }
      } catch (error: any) {
        console.error('Failed to fetch AI trends:', error);
        toast.error('Không thể tải xu hướng AI');
      } finally {
        setLoading(false);
      }
    };
    analyticsService.trackEvent('view_ai_trends', { timestamp: new Date().toISOString() });
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="ml-2">Đang tải dữ liệu xu hướng...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="w-full mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
              <Zap className="w-8 h-8 text-primary/70" />
              AI Market Insights
            </h1>
            <p className="text-muted-foreground/40 text-sm">Phân tích xu hướng thị trường lao động toàn cầu bằng AI.</p>
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-3 rounded-lg bg-card border border-border text-xs font-bold hover:bg-card transition-all flex items-center gap-2">
               <Globe className="w-4 h-4" /> Global View
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-lg bg-primary hover:bg-primary/80 text-xs font-bold transition-all shadow-lg">
               Cập nhật dữ liệu
            </button>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 rounded-lg bg-card border border-border relative overflow-hidden group">
            <BarChart3 className="w-12 h-12 text-primary mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-3xl font-bold mb-1">{data?.insights?.prediction_2025_it_students || '2.4M'}</h3>
            <p className="text-xs text-muted-foreground/40 uppercase font-bold tracking-widest">Dự báo SV IT 2025</p>
            <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp className="w-24 h-24" /></div>
          </div>
          <div className="p-8 rounded-lg bg-card border border-border relative overflow-hidden group">
            <Cpu className="w-12 h-12 text-primary/80 mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-3xl font-bold mb-1">{data?.insights?.average_annual_growth_pct ? `${data.insights.average_annual_growth_pct}%` : '125%'}</h3>
            <p className="text-xs text-muted-foreground/40 uppercase font-bold tracking-widest">Tăng trưởng hàng năm</p>
          </div>
          <div className="p-8 rounded-lg bg-card border border-border relative overflow-hidden group">
            <Target className="w-12 h-12 text-primary mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-3xl font-bold mb-1">18.5k</h3>
            <p className="text-xs text-muted-foreground/40 uppercase font-bold tracking-widest">Kỹ năng được săn đón</p>
          </div>
        </div>

        {/* Main Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 p-8 rounded-lg bg-card border border-border">
              <h2 className="text-xl font-bold mb-8">Lịch sử tăng trưởng theo ngành</h2>
              <div className="space-y-6">
                 {(data?.sectors || []).map((sector: any) => {
                   const hist = sector.historical || [];
                   const maxVal = Math.max(...hist.map((i: any) => Number(i.metric_value || i.value || 0)), 1);
                   return (
                     <div key={sector.name} className="border border-border rounded-xl p-5 bg-background/30">
                       <div className="flex items-center justify-between mb-3">
                         <h3 className="font-semibold">{sector.name}</h3>
                         <span className="text-xs font-bold text-primary">{sector.growth_pct}%/năm</span>
                       </div>
                       <div className="h-32 flex items-end justify-between gap-2 px-2">
                         {hist.map((item: any, i: number) => {
                           const value = Number(item.metric_value || item.value || 0);
                           const h = maxVal > 0 ? (value / maxVal) * 100 : 0;
                           return (
                             <div key={i} className="flex-1 flex flex-col items-center gap-2">
                               <div className="w-full bg-primary/30 rounded-lg transition-all hover:scale-105 cursor-pointer" style={{ height: `${h}%` }} />
                               <span className="text-[10px] text-muted-foreground/20 font-bold">{item.year || `Năm ${i+1}`}</span>
                             </div>
                           );
                         })}
                       </div>
                       <p className="text-xs text-muted-foreground/50 mt-2">
                         Dự báo 2025: {sector.prediction_2025}
                       </p>
                     </div>
                   );
                 })}
                 {(data?.sectors || []).length === 0 && (
                   <p className="text-sm text-muted-foreground/40">Chưa có dữ liệu ngành nào.</p>
                 )}
              </div>
           </div>

           <div className="p-8 rounded-lg bg-card border border-border space-y-6">
              <h2 className="text-xl font-bold mb-2">Kỹ năng "Hot"</h2>
              <div className="space-y-4">
                 {(data?.trending_skills || []).map((skill: any, idx: number) => (
                   <div key={skill.name || idx} className="p-4 rounded-lg bg-card border border-border flex justify-between items-center group cursor-pointer hover:bg-card transition-all">
                      <div>
                         <p className="text-sm font-bold">{skill.name || 'N/A'}</p>
                         <div className="w-24 h-1 bg-card rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-primary/80" style={{ width: '70%' }} />
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-primary text-xs font-bold">{skill.growth || '+0%'}</p>
                         <ArrowUpRight className="w-4 h-4 text-muted-foreground/20 ml-auto group-hover:text-white transition-colors" />
                      </div>
                   </div>
                 ))}
                 {(!data?.trending_skills || data.trending_skills.length === 0) && (
                   <p className="text-sm text-muted-foreground/40">Chưa có dữ liệu kỹ năng xu hướng.</p>
                 )}
              </div>
           </div>
        </div>

        {/* AI Prediction Footer */}
        <div className="p-10 rounded-lg bg-card border border-border flex flex-col md:flex-row items-center gap-8">
           <div className="p-6 bg-card rounded-xl border border-border">
              <PieChart className="w-12 h-12 text-primary/70" />
           </div>
           <div className="flex-1">
              <h4 className="text-xl font-bold mb-2">Lời khuyên từ EduMap AI</h4>
              <p className="text-sm text-muted-foreground/60 leading-relaxed">
                 {data?.insights?.conclusion || "Dựa trên xu hướng hiện tại, chúng tôi nhận thấy các kỹ năng liên quan đến **Phát triển bền vững** và **AI Ethic** đang có tốc độ tăng trưởng phi mã."}
              </p>
           </div>
           <button className="px-8 py-4 rounded-lg bg-card text-foreground font-bold text-sm hover:bg-primary/80 transition-colors whitespace-nowrap">
              Xem lộ trình gợi ý
           </button>
        </div>

      </div>
    </div>
  );
}
