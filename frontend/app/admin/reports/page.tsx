"use client";
import React from 'react';
import { FileDown, Filter, Calendar, BarChart, Download, FileText, Table as TableIcon, CheckCircle2 } from 'lucide-react';

const reportTemplates = [
  { id: 1, name: 'Hiệu quả học tập quý 2', type: 'PDF', status: 'Sẵn sàng', date: '16/05/2026' },
  { id: 2, name: 'Báo cáo Quyên góp & Tài chính', type: 'Excel', status: 'Đang tạo...', date: '16/05/2026' },
  { id: 3, name: 'Thống kê Mentor & Học viên', type: 'CSV', status: 'Sẵn sàng', date: '15/05/2026' },
];

export default function AdminReportsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FileDown className="w-8 h-8 text-blue-500" />
              Trung tâm Báo cáo
            </h1>
            <p className="text-white/40 text-sm mt-1">Trích xuất và tổng hợp dữ liệu từ 40 bảng hệ thống.</p>
          </div>
          <button className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-sm font-bold shadow-lg shadow-blue-600/20 transition-all">
             TẠO BÁO CÁO MỚI
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="space-y-2">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest px-1">Thời gian</label>
              <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl px-4 py-2.5">
                 <Calendar className="w-4 h-4 text-blue-500" />
                 <span className="text-xs font-bold">30 Ngày qua</span>
              </div>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest px-1">Module</label>
              <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl px-4 py-2.5">
                 <BarChart className="w-4 h-4 text-purple-500" />
                 <span className="text-xs font-bold">Tất cả Module</span>
              </div>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest px-1">Định dạng</label>
              <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl px-4 py-2.5">
                 <TableIcon className="w-4 h-4 text-green-500" />
                 <span className="text-xs font-bold">Excel (.xlsx)</span>
              </div>
           </div>
           <div className="flex items-end">
              <button className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold border border-white/10 transition-all flex items-center justify-center gap-2">
                 <Filter className="w-4 h-4" /> Áp dụng lọc
              </button>
           </div>
        </div>

        {/* Report List */}
        <div className="space-y-4">
           <h2 className="text-xl font-bold px-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Lịch sử trích xuất
           </h2>
           <div className="grid grid-cols-1 gap-4">
              {reportTemplates.map(report => (
                <div key={report.id} className="p-6 rounded-[32px] bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all flex items-center justify-between group">
                   <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:bg-blue-600/10 transition-colors">
                         <FileText className="w-6 h-6 text-white/40 group-hover:text-blue-400" />
                      </div>
                      <div>
                         <h3 className="font-bold">{report.name}</h3>
                         <div className="flex gap-3 mt-1">
                            <span className="text-[10px] text-white/40 uppercase font-bold">{report.type}</span>
                            <span className="text-[10px] text-white/40 uppercase font-bold">•</span>
                            <span className="text-[10px] text-white/40 uppercase font-bold">{report.date}</span>
                         </div>
                      </div>
                   </div>
                   <div className="flex items-center gap-6">
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${report.status === 'Sẵn sàng' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 animate-pulse'}`}>
                         {report.status}
                      </span>
                      <button className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white text-black transition-all">
                         <Download className="w-5 h-5" />
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Empty State / Tips */}
        <div className="p-8 rounded-[40px] bg-blue-600/5 border border-blue-500/10 text-center">
           <p className="text-sm text-white/40">
              Mẹo: Bạn có thể đặt lịch tự động gửi báo cáo hiệu quả hệ thống vào Email mỗi sáng thứ Hai.
              <span className="text-blue-500 ml-2 cursor-pointer hover:underline">Thiết lập ngay</span>
           </p>
        </div>

      </div>
    </div>
  );
}
