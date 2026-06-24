"use client";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { moderatorService } from "@/src/services/moderator.service";

export default function ModeratorPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await moderatorService.getPendingPosts();
        setTasks(data ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-8 text-center">Đang tải…</div>;

  const handleApprove = async (id: string) => {
    try {
      await moderatorService.approvePost(id);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await moderatorService.rejectPost(id);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6 text-yellow-500" />
          Bảng điều khiển Moderator
        </h1>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Làm mới
        </button>
      </div>
      
      {tasks.length === 0 ? (
        <div className="text-center py-16 bg-card border border-white/10 rounded-2xl">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p>Không có nội dung cần duyệt.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tasks.map((t: any) => (
            <div key={t.id} className="p-4 border rounded-lg bg-card space-y-3">
              <h3 className="font-bold text-lg">{t.title}</h3>
              <p className="text-sm text-white/60 line-clamp-2">{t.content}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">
                  Bởi: {t.author?.full_name || 'N/A'} • {new Date(t.created_at).toLocaleDateString('vi-VN')}
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleApprove(t.id)}
                    className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center gap-1 text-sm"
                  >
                    <CheckCircle className="w-4 h-4" /> Duyệt
                  </button>
                  <button 
                    onClick={() => handleReject(t.id)}
                    className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-1 text-sm"
                  >
                    <XCircle className="w-4 h-4" /> Từ chối
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
