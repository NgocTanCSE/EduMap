"use client";
import React, { useState, useEffect } from 'react';
import { adminService } from '@/src/services/admin.service';
import { 
  Users, Activity, TrendingUp, Shield, 
  MapPin, BookOpen, Heart, Leaf, BrainCircuit
} from 'lucide-react';
import { authService } from '@/src/services/auth.service';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [aiStats, setAiStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllStats = async () => {
      try {
        const adminData = await adminService.getStats();
        setStats(adminData);
        
        // Fetch AI Analytics
        const token = authService.getAccessToken();
        if (token) {
          const aiRes = await fetch('/api/ai/analytics/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            setAiStats(aiData.data);
          }
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllStats();
  }, []);

  if (loading) return <div className="p-20 text-center text-white/40">Đang tải dữ liệu thực tế từ Database & Redis...</div>;

  const cards = [
    { title: 'Tổng người dùng', value: stats?.total_users || 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Chiến dịch hoạt động', value: stats?.active_campaigns || 0, icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10' },
    { title: 'Chờ xác minh', value: stats?.pending_verifications || 0, icon: Shield, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { title: 'Tăng trưởng', value: stats?.revenue_growth || '+0%', icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-yellow-500">Tổng quan Hệ thống</h1>
          <p className="text-white/40 text-sm mt-1">Dữ liệu thời gian thực từ hệ sinh thái EduMap (PostgreSQL & Redis).</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div key={idx} className="p-6 rounded-[32px] bg-zinc-900/50 border border-white/10 hover:border-yellow-500/30 transition-all">
                <div className={`w-12 h-12 rounded-2xl ${card.bg} ${card.color} flex items-center justify-center mb-4`}>
                   <Icon className="w-6 h-6" />
                </div>
                <p className="text-3xl font-bold">{card.value}</p>
                <p className="text-xs text-white/40 uppercase font-bold mt-1 tracking-widest">{card.title}</p>
              </div>
            );
          })}
        </div>

        {/* AI Analytics Section */}
        <div className="p-8 rounded-[40px] bg-zinc-900/40 border border-white/10 space-y-6">
           <h3 className="text-xl font-bold flex items-center gap-2 text-purple-400">
             <BrainCircuit className="w-6 h-6" />
             AI Analytics & Predictive Models
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-black/30 p-6 rounded-3xl border border-purple-500/20">
                 <p className="text-xs text-white/40 uppercase font-bold tracking-widest mb-2">Tổng lượt dự đoán</p>
                 <div className="flex items-end gap-2">
                    <p className="text-4xl font-black text-white">{aiStats?.total_predictions || 0}</p>
                    <span className="text-sm text-green-400 mb-1">+12%</span>
                 </div>
                 {/* Visual Bar representation */}
                 <div className="w-full h-2 bg-white/5 rounded-full mt-4 overflow-hidden">
                    <div className="h-full bg-purple-500 w-[75%] rounded-full"></div>
                 </div>
              </div>

              <div className="bg-black/30 p-6 rounded-3xl border border-purple-500/20">
                 <p className="text-xs text-white/40 uppercase font-bold tracking-widest mb-2">Độ chính xác (Accuracy)</p>
                 <div className="flex items-end gap-2">
                    <p className="text-4xl font-black text-white">{(aiStats?.accuracy_rate * 100) || 0}%</p>
                    <span className="text-sm text-green-400 mb-1">Tối ưu</span>
                 </div>
                 <div className="w-full h-2 bg-white/5 rounded-full mt-4 overflow-hidden">
                    <div className="h-full bg-green-500 w-[92%] rounded-full"></div>
                 </div>
              </div>

              <div className="bg-black/30 p-6 rounded-3xl border border-purple-500/20">
                 <p className="text-xs text-white/40 uppercase font-bold tracking-widest mb-2">Mô hình AI Active</p>
                 <div className="flex items-end gap-2">
                    <p className="text-4xl font-black text-white">{aiStats?.active_models || 0}</p>
                    <span className="text-sm text-blue-400 mb-1">RAG, Gemini</span>
                 </div>
                 <div className="flex gap-2 mt-4">
                    <div className="w-1/3 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <div className="w-1/3 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
                    <div className="w-1/3 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
                 </div>
              </div>
           </div>
        </div>

{/* Quick Links / Module Status */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-[40px] bg-zinc-900/30 border border-white/10 space-y-6">
               <h3 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-yellow-500" />
                  Trạng thái Module
               </h3>
               <div className="space-y-4">
                  {[
                    { name: 'Bản đồ PostGIS', status: 'Hoạt động', icon: MapPin, href: '/map' },
                    { name: 'Thư viện tài liệu', status: 'Hoạt động', icon: BookOpen, href: '/library' },
                    { name: 'Cộng đồng Xanh', status: 'Hoạt động', icon: Leaf, href: '/green' },
                    { name: 'Quỹ quyên góp', status: 'Hoạt động', icon: Heart, href: '/donate' },
                  ].map((mod, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                       <div className="flex items-center gap-3">
                          <mod.icon className="w-5 h-5 text-white/20" />
                          <span className="text-sm font-bold">{mod.name}</span>
                       </div>
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${mod.status === 'Hoạt động' ? 'text-green-500 bg-green-500/10' : 'text-yellow-500 bg-yellow-500/10'}`}>
                          {mod.status}
                       </span>
                    </div>
                  ))}
               </div>
            </div>

            <div className="p-8 rounded-[40px] bg-gradient-to-br from-yellow-600/20 to-purple-600/20 border border-white/10 flex flex-col justify-center items-center text-center space-y-4">
               <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center shadow-xl shadow-yellow-500/20">
                  <Shield className="w-8 h-8 text-black" />
               </div>
               <h3 className="text-2xl font-bold">Bảo mật Tuyệt đối</h3>
               <p className="text-sm text-white/60 leading-relaxed max-w-sm">
                  Mọi thao tác quản trị đều được mã hóa và ghi nhật ký hệ thống. Đảm bảo tuân thủ các quy tắc bảo mật dữ liệu người dùng.
               </p>
               <a href="/admin/reports">
                  <button className="px-8 py-3 rounded-2xl bg-white text-black text-sm font-bold hover:bg-yellow-500 transition-colors">
                     KIỂM TRA AUDIT LOGS
                  </button>
               </a>
            </div>
         </div>

      </div>
    </div>
  );
}
