"use client";
import React from 'react';
import { Award, CheckCircle, Download, ExternalLink, QrCode, Search, Share2, ShieldCheck } from 'lucide-react';

const certificates = [
  {
    id: 1,
    title: 'Hoàn thành Khóa học Python cơ bản',
    issuedBy: 'EduMap Academy',
    date: '12/05/2026',
    code: 'EDUMAP-PY-9921',
    image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=400',
  },
  {
    id: 2,
    title: 'Đại sứ Sống Xanh 2026',
    issuedBy: 'Green Campus Program',
    date: '01/04/2026',
    code: 'GREEN-2026-X01',
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=400',
  },
];

export default function CertificateWalletPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white/5 border border-white/10 p-8 rounded-[32px] backdrop-blur-xl">
           <div className="flex items-center gap-6">
              <div className="p-4 bg-yellow-400/20 rounded-2xl">
                 <Award className="w-10 h-10 text-yellow-400" />
              </div>
              <div>
                 <h1 className="text-2xl font-bold">Ví Chứng chỉ số</h1>
                 <p className="text-sm text-white/40">Tất cả thành tích của bạn đã được xác thực qua Blockchain.</p>
              </div>
           </div>
           <div className="flex gap-4">
              <button className="px-6 py-3 rounded-xl bg-blue-600 text-sm font-bold hover:bg-blue-500 transition-all">Xuất tất cả (PDF)</button>
           </div>
        </div>

        {/* Search */}
        <div className="relative">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
           <input type="text" placeholder="Tìm kiếm chứng chỉ..." className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {certificates.map(cert => (
             <div key={cert.id} className="group rounded-[32px] overflow-hidden border border-white/10 bg-white/5 hover:border-yellow-400/30 transition-all">
                <div className="aspect-[4/3] relative">
                   <img src={cert.image} alt="" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500" />
                   <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
                   <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                      <div className="p-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
                         <QrCode className="w-10 h-10 text-white" />
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-[10px] text-green-400 font-bold uppercase tracking-widest">
                         <ShieldCheck className="w-3 h-3" /> VERIFIED
                      </div>
                   </div>
                </div>
                <div className="p-6 space-y-4">
                   <div>
                      <h3 className="font-bold text-sm mb-1 leading-snug">{cert.title}</h3>
                      <p className="text-[10px] text-white/40">{cert.issuedBy} • {cert.date}</p>
                   </div>
                   <div className="flex gap-2">
                      <button className="flex-1 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
                         <Download className="w-3 h-3" /> TẢI VỀ
                      </button>
                      <button className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10">
                         <Share2 className="w-4 h-4" />
                      </button>
                   </div>
                </div>
             </div>
           ))}
        </div>

      </div>
    </div>
  );
}
