"use client";
import React from 'react';
import { Heart, Users, Target, Calendar, Share2, ShieldCheck, ArrowRight, MessageCircle } from 'lucide-react';

const donors = [
  { id: 1, name: 'Lê Ngọc Tân', amount: '5,000,000 VNĐ', time: '10 phút trước' },
  { id: 2, name: 'Ẩn danh', amount: '200,000 VNĐ', time: '1 giờ trước' },
  { id: 3, name: 'Công ty TechV', amount: '15,000,000 VNĐ', time: '5 giờ trước' },
];

export default function DonationDetailPage() {
  const progress = 75;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Left: Campaign Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="rounded-[40px] overflow-hidden border border-white/10 aspect-video relative group">
            <img src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=1200" alt="Campaign" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <span className="px-4 py-2 rounded-full bg-blue-600 text-xs font-bold mb-4 inline-block">ĐANG DIỄN RA</span>
              <h1 className="text-4xl font-bold leading-tight">Gây quỹ xây dựng Phòng Lab STEM cho học sinh vùng cao</h1>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            <h2 className="text-2xl font-bold">Về chiến dịch này</h2>
            <p className="text-white/60 leading-relaxed">
              Chúng tôi đặt mục tiêu xây dựng 05 phòng Lab STEM tại các tỉnh miền núi phía Bắc. Mỗi phòng Lab sẽ được trang bị đầy đủ máy tính, bộ kit lập trình robot và các thiết bị thực hành khoa học cơ bản. 
            </p>
            <p className="text-white/60 leading-relaxed">
              Dự án không chỉ mang lại cơ sở vật chất mà còn tổ chức các buổi đào tạo trực tuyến định kỳ từ các Mentor của EduMap.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white/5 border border-white/10">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
               <Users className="w-5 h-5 text-blue-400" />
               Người đóng góp gần đây
            </h3>
            <div className="space-y-4">
               {donors.map(donor => (
                 <div key={donor.id} className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Heart className="w-5 h-5 text-blue-400" />
                       </div>
                       <div>
                          <p className="text-sm font-bold">{donor.name}</p>
                          <p className="text-[10px] text-white/40">{donor.time}</p>
                       </div>
                    </div>
                    <p className="text-sm font-mono text-blue-400">{donor.amount}</p>
                 </div>
               ))}
            </div>
            <button className="w-full mt-6 py-3 text-sm text-white/40 hover:text-white transition-colors flex items-center justify-center gap-2">
               Xem tất cả đóng góp <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Donation Card */}
        <div className="space-y-6">
          <div className="p-8 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-3xl sticky top-8">
            <div className="space-y-6">
               <div>
                  <div className="flex justify-between items-end mb-2">
                     <span className="text-3xl font-bold">150tr</span>
                     <span className="text-sm text-white/40">Mục tiêu: 200tr</span>
                  </div>
                  <div className="h-4 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
                     <div className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex justify-between mt-2">
                     <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">{progress}% hoàn thành</span>
                     <span className="text-[10px] text-white/40">124 lượt đóng góp</span>
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-2">
                  {['100k', '500k', '1M'].map(val => (
                    <button key={val} className="py-3 rounded-xl border border-white/10 hover:border-blue-500 transition-all text-xs font-bold">{val}</button>
                  ))}
               </div>

               <input type="text" placeholder="Số tiền khác..." className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm focus:border-blue-500 outline-none" />

               <button className="w-full py-5 rounded-[24px] bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-xl shadow-blue-600/20">
                  QUYÊN GÓP NGAY
               </button>

               <div className="flex items-center gap-2 justify-center text-[10px] text-white/40">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Giao dịch bảo mật bởi EduMap Secure</span>
               </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
               <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Hạn chót:</span>
                  <span className="font-medium">15/06/2026</span>
               </div>
               <div className="flex gap-2">
                  <button className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold flex items-center justify-center gap-2">
                     <Share2 className="w-4 h-4" /> Chia sẻ
                  </button>
                  <button className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                     <MessageCircle className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
