"use client";
import React, { useState, useEffect } from 'react';
import { adminService } from '@/services/admin.service';
import { 
  Users, Activity, TrendingUp, Shield, 
  MapPin, BookOpen, Heart, Leaf
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await adminService.getStats();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-20 text-center text-white/40">Đang tải thống kê...</div>;

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
          <p className="text-white/40 text-sm mt-1">Dữ liệu thời gian thực từ hệ sinh thái EduMap.</p>
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

        {/* Quick Links / Module Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="p-8 rounded-[40px] bg-zinc-900/30 border border-white/10 space-y-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                 <Activity className="w-5 h-5 text-yellow-500" />
                 Trạng thái Module
              </h3>
              <div className="space-y-4">
                 {[
                   { name: 'Bản đồ PostGIS', status: 'Hoạt động', icon: MapPin },
                   { name: 'Thư viện tài liệu', status: 'Hoạt động', icon: BookOpen },
                   { name: 'Cộng đồng Xanh', status: 'Hoạt động', icon: Leaf },
                   { name: 'Quỹ quyên góp', status: 'Bảo trì', icon: Heart },
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
              <button className="px-8 py-3 rounded-2xl bg-white text-black text-sm font-bold hover:bg-yellow-500 transition-colors">
                 KIỂM TRA AUDIT LOGS
              </button>
           </div>
        </div>

      </div>
    </div>
  );
}
