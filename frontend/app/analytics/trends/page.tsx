"use client";
import React, { useEffect, useState } from 'react';
import { TrendingUp, BarChart3, PieChart, Zap, ArrowUpRight, Globe, Target, Cpu } from 'lucide-react';
import { analyticsService } from '@/src/services/analytics.service';

const trendingSkillsDefault = [
  { name: 'Prompt Engineering', growth: '+150%', color: 'bg-yellow-500' },
  { name: 'Rust Programming', growth: '+85%', color: 'bg-orange-500' },
  { name: 'Green Tech', growth: '+60%', color: 'bg-green-500' },
  { name: 'Cybersecurity', growth: '+45%', color: 'bg-purple-500' },
];

export default function AITrendsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const trends = await analyticsService.getAiTrends();
        setData(trends);
        analyticsService.trackEvent('view_ai_trends', { timestamp: new Date().toISOString() });
      } catch (error) {
        console.error('Failed to fetch AI trends:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-400" />
              AI Market Insights
            </h1>
            <p className="text-white/40 text-sm">Phân tích xu hướng thị trường lao động toàn cầu bằng AI.</p>
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-3 rounded-2xl bg-card border border-white/10 text-xs font-bold hover:bg-card transition-all flex items-center gap-2">
               <Globe className="w-4 h-4" /> Global View
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-2xl bg-yellow-600 hover:bg-yellow-500 text-xs font-bold transition-all shadow-lg shadow-yellow-600/20">
               Cập nhật dữ liệu
            </button>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 rounded-[40px] bg-card border border-white/10 relative overflow-hidden group">
            <BarChart3 className="w-12 h-12 text-yellow-500 mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-3xl font-bold mb-1">{data?.insights?.prediction_2025_it_students || '2.4M'}</h3>
            <p className="text-xs text-white/40 uppercase font-bold tracking-widest">Dự báo SV IT 2025</p>
            <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp className="w-24 h-24" /></div>
          </div>
          <div className="p-8 rounded-[40px] bg-card border border-white/10 relative overflow-hidden group">
            <Cpu className="w-12 h-12 text-purple-500 mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-3xl font-bold mb-1">{data?.insights?.average_annual_growth_pct ? `${data.insights.average_annual_growth_pct}%` : '125%'}</h3>
            <p className="text-xs text-white/40 uppercase font-bold tracking-widest">Tăng trưởng hàng năm</p>
          </div>
          <div className="p-8 rounded-[40px] bg-card border border-white/10 relative overflow-hidden group">
            <Target className="w-12 h-12 text-green-500 mb-6 group-hover:scale-110 transition-transform" />
            <h3 className="text-3xl font-bold mb-1">18.5k</h3>
            <p className="text-xs text-white/40 uppercase font-bold tracking-widest">Kỹ năng được săn đón</p>
          </div>
        </div>

        {/* Main Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 p-8 rounded-[40px] bg-card border border-white/10">
              <h2 className="text-xl font-bold mb-8">Lịch sử tăng trưởng sinh viên IT</h2>
              <div className="h-64 flex items-end justify-between gap-4 px-4">
                 {(data?.historical_data || [40, 70, 45, 90, 65]).map((item: any, i: number) => {
                   const value = typeof item === 'object' ? item.it_enrollment / 40 : item;
                   return (
                     <div key={i} className="flex-1 flex flex-col items-center gap-4">
                        <div className="w-full bg-gradient-to-t from-yellow-600/20 to-yellow-500 rounded-2xl transition-all hover:scale-105 cursor-pointer" style={{ height: `${value}%` }} />
                        <span className="text-[10px] text-white/20 font-bold">{item.year || `Năm ${i+1}`}</span>
                     </div>
                   );
                 })}
              </div>
           </div>

           <div className="p-8 rounded-[40px] bg-card border border-white/10 space-y-6">
              <h2 className="text-xl font-bold mb-2">Kỹ năng "Hot"</h2>
              <div className="space-y-4">
                 {trendingSkillsDefault.map(skill => (
                   <div key={skill.name} className="p-4 rounded-2xl bg-card border border-white/5 flex justify-between items-center group cursor-pointer hover:bg-card transition-all">
                      <div>
                         <p className="text-sm font-bold">{skill.name}</p>
                         <div className="w-24 h-1 bg-card rounded-full mt-2 overflow-hidden">
                            <div className={`h-full ${skill.color}`} style={{ width: '70%' }} />
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-green-400 text-xs font-bold">{skill.growth}</p>
                         <ArrowUpRight className="w-4 h-4 text-white/20 ml-auto group-hover:text-white transition-colors" />
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* AI Prediction Footer */}
        <div className="p-10 rounded-[40px] bg-gradient-to-br from-yellow-600/20 to-purple-600/20 border border-white/10 flex flex-col md:flex-row items-center gap-8">
           <div className="p-6 bg-card rounded-3xl border border-white/10 shadow-2xl">
              <PieChart className="w-12 h-12 text-yellow-400" />
           </div>
           <div className="flex-1">
              <h4 className="text-xl font-bold mb-2">Lời khuyên từ EduMap AI</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                 {data?.insights?.conclusion || "Dựa trên xu hướng hiện tại, chúng tôi nhận thấy các kỹ năng liên quan đến **Phát triển bền vững** và **AI Ethic** đang có tốc độ tăng trưởng phi mã."}
              </p>
           </div>
           <button className="px-8 py-4 rounded-2xl bg-white text-black font-bold text-sm hover:bg-yellow-400 transition-colors whitespace-nowrap">
              Xem lộ trình gợi ý
           </button>
        </div>

      </div>
    </div>
  );
}
