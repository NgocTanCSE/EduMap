"use client";
import React, { useState, useEffect } from 'react';
import { adminService } from '@/services/admin.service';
import { 
  FileText, Calendar, User, Activity, 
  ChevronLeft, ChevronRight, Clock, Database
} from 'lucide-react';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const response = await adminService.getAuditLogs({ page, limit: 10 });
      setLogs(response.items);
      setMeta(response.meta);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(meta.page);
  }, [meta.page]);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-yellow-500">
              <Activity className="w-8 h-8" />
              Nhật ký Hoạt động
            </h1>
            <p className="text-white/40 text-sm mt-1">Theo dõi các thay đổi quan trọng trong hệ thống.</p>
          </div>
        </div>

        {/* Logs Table */}
        <div className="rounded-[32px] overflow-hidden border border-white/10 bg-zinc-900/30">
          {loading ? (
            <div className="p-20 text-center text-white/40">Đang tải dữ liệu...</div>
          ) : (
            <>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-900/50">
                    <th className="p-6 text-xs font-bold text-white/40 uppercase">Thời gian</th>
                    <th className="p-6 text-xs font-bold text-white/40 uppercase">Người thực hiện</th>
                    <th className="p-6 text-xs font-bold text-white/40 uppercase">Hành động</th>
                    <th className="p-6 text-xs font-bold text-white/40 uppercase">Tài nguyên</th>
                    <th className="p-6 text-xs font-bold text-white/40 uppercase">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors text-sm">
                      <td className="p-6">
                        <div className="flex items-center gap-2 text-white/60">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-bold">
                              {log.user?.full_name?.charAt(0) || 'U'}
                           </div>
                           <div>
                              <p className="font-bold">{log.user?.full_name || 'Hệ thống'}</p>
                              <p className="text-[10px] text-white/30">{log.user?.email || ''}</p>
                           </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                           <Database className="w-3.5 h-3.5 text-white/20" />
                           <span className="text-white/60 uppercase text-[10px] font-bold">{log.resource}</span>
                        </div>
                      </td>
                      <td className="p-6 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap text-white/40 italic">
                        {JSON.stringify(log.new_data)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="p-6 border-t border-white/5 flex justify-between items-center">
                <p className="text-xs text-white/40">
                  Hiển thị {logs.length} trên {meta.total} bản ghi
                </p>
                <div className="flex gap-2">
                  <button 
                    disabled={meta.page <= 1}
                    onClick={() => setMeta({...meta, page: meta.page - 1})}
                    className="p-2 rounded-xl bg-zinc-900 border border-white/10 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setMeta({...meta, page: meta.page + 1})}
                    className="p-2 rounded-xl bg-zinc-900 border border-white/10 disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
