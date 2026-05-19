"use client";
import React from 'react';
import { ShieldCheck, Clock, Check, X, Eye, FileText, User, Filter } from 'lucide-react';

const pendingApprovals = [
  { id: 1, user: 'Nguyễn Văn A', activity: 'Tình nguyện Dạy học', hours: 4, date: '15/05/2026', proof: 'image_1.jpg' },
  { id: 2, user: 'Trần Thị B', activity: 'Thử thách Sống Xanh', points: 50, date: '16/05/2026', proof: 'image_2.jpg' },
];

export default function ModeratorDashboard() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
            Trung tâm Điều phối & Duyệt tin
          </h1>
          <div className="flex gap-4">
             <div className="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
               {pendingApprovals.length} YÊU CẦU ĐANG CHỜ
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {pendingApprovals.map(req => (
            <div key={req.id} className="p-6 rounded-3xl bg-white/5 border border-white/10 flex items-center gap-8 hover:border-blue-500/30 transition-all">
               <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center border border-white/5">
                  <FileText className="w-8 h-8 text-white/20" />
               </div>
               <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                     <User className="w-4 h-4 text-white/40" />
                     <h3 className="font-bold">{req.user}</h3>
                  </div>
                  <p className="text-sm font-medium mb-1">{req.activity}</p>
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">
                     {req.hours ? `${req.hours} Giờ` : `${req.points} Điểm`} • {req.date}
                  </p>
               </div>
               <div className="flex gap-3">
                  <button className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                     <Eye className="w-5 h-5 text-white/60" />
                  </button>
                  <button className="px-6 py-3 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 text-xs font-bold hover:bg-red-600/30 transition-all">
                     TỪ CHỐI
                  </button>
                  <button className="px-6 py-3 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-500 transition-all shadow-lg shadow-green-600/20">
                     DUYỆT NGAY
                  </button>
               </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
