"use client";
import React from 'react';
import { Leaf, Clock, Camera, CheckCircle, Info, ArrowRight, ShieldCheck, MapPin } from 'lucide-react';

const challenges = [
  {
    id: 1,
    title: 'Một ngày không rác thải nhựa',
    points: 50,
    carbon: '0.5kg',
    participants: 124,
    image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 2,
    title: 'Đi bộ tới trường',
    points: 30,
    carbon: '1.2kg',
    participants: 450,
    image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=400',
  },
];

export default function GreenPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 rounded-3xl bg-green-500/10 border border-green-500/20 backdrop-blur-xl">
            <Leaf className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="text-3xl font-bold">12.5kg</h3>
            <p className="text-sm text-green-500/60 font-medium uppercase tracking-wider">CO2 đã tiết kiệm</p>
          </div>
          <div className="p-8 rounded-3xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-xl">
            <Clock className="w-8 h-8 text-blue-500 mb-4" />
            <h3 className="text-3xl font-bold">48 Giờ</h3>
            <p className="text-sm text-blue-500/60 font-medium uppercase tracking-wider">Tình nguyện cộng đồng</p>
          </div>
          <div className="p-8 rounded-3xl bg-purple-500/10 border border-purple-500/20 backdrop-blur-xl">
            <ShieldCheck className="w-8 h-8 text-purple-500 mb-4" />
            <h3 className="text-3xl font-bold">1500</h3>
            <p className="text-sm text-purple-500/60 font-medium uppercase tracking-wider">Điểm tích lũy</p>
          </div>
        </div>

        {/* Green Challenges Grid */}
        <div>
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Thử thách Xanh</h2>
              <p className="text-white/40 text-sm">Tham gia bảo vệ môi trường và nhận điểm thưởng.</p>
            </div>
            <button className="text-green-500 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
              Xem tất cả <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {challenges.map(item => (
              <div key={item.id} className="group relative rounded-3xl overflow-hidden border border-white/10 bg-white/5 hover:border-green-500/30 transition-all">
                <div className="aspect-[21/9] relative">
                  <img src={item.image} alt="" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
                </div>
                <div className="p-6 relative">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">+{item.points} XP</span>
                  </div>
                  <div className="flex gap-4 mb-6">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <Leaf className="w-3 h-3" /> {item.carbon} CO2
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <CheckCircle className="w-3 h-3" /> {item.participants} tham gia
                    </div>
                  </div>
                  <button className="w-full py-3 rounded-2xl bg-white text-black font-bold text-sm hover:bg-green-400 transition-colors">
                    Tham gia ngay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Volunteer Log Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Báo cáo giờ Tình nguyện
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-2 uppercase font-bold">Tên hoạt động</label>
                <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors" placeholder="Ví dụ: Dạy học cho trẻ em nghèo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase font-bold">Số giờ</label>
                  <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors" placeholder="0.0" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase font-bold">Ngày thực hiện</label>
                  <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-2 uppercase font-bold">Minh chứng (Hình ảnh)</label>
                <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center hover:border-blue-500/50 cursor-pointer transition-all">
                  <Camera className="w-8 h-8 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/40">Kéo thả hoặc nhấn để tải ảnh lên</p>
                </div>
              </div>
              <button className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/20">
                Gửi báo cáo cho AI duyệt
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-blue-500/10 rounded-2xl">
                  <Info className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-bold mb-2 text-sm">Quy trình duyệt tự động</h4>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Hệ thống sẽ sử dụng AI để phân tích ảnh minh chứng và vị trí địa lý của bạn. Nếu hợp lệ, điểm thưởng sẽ được cộng sau 5-10 phút.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 rounded-3xl bg-green-500/5 border border-green-500/10">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-green-500/10 rounded-2xl">
                  <MapPin className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h4 className="font-bold mb-2 text-sm">Hoạt động gần bạn</h4>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Có 5 hoạt động tình nguyện mới đang diễn ra trong bán kính 2km từ vị trí của bạn.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
