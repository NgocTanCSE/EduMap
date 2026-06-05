"use client";
import React, { useEffect, useState } from 'react';
import { ShieldCheck, Clock, Check, X, Eye, FileText, User, Filter, MessageSquare, Loader2 } from 'lucide-react';
import { moderatorService } from '@/src/services/moderator.service';
import { toast } from 'sonner';

export default function ModeratorDashboard() {
  const [activeTab, setActiveTab] = useState<'posts' | 'comments' | 'activities'>('posts');
  
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'posts') {
          const data = await moderatorService.getPendingPosts();
          setPosts(data);
      } else if (activeTab === 'comments') {
          const data = await moderatorService.getPendingComments();
          setComments(data);
      } else {
          const data = await moderatorService.getPendingActivities();
          setActivities(data);
      }
    } catch (error) {
      toast.error('Không thể tải dữ liệu kiểm duyệt');
    } finally {
      setLoading(false);
    }
  };

  const handleModeratePost = async (id: string, action: 'approve' | 'reject') => {
      try {
          setProcessingId(id);
          await moderatorService.moderatePost(id, action);
          toast.success(`Đã ${action === 'approve' ? 'duyệt' : 'từ chối'} bài viết`);
          setPosts(posts.filter(p => p.id !== id));
      } catch (error) {
          toast.error('Lỗi khi xử lý bài viết');
      } finally {
          setProcessingId(null);
      }
  };

  const handleModerateComment = async (id: string, action: 'approve' | 'reject') => {
      try {
          setProcessingId(id);
          await moderatorService.moderateComment(id, action);
          toast.success(`Đã ${action === 'approve' ? 'duyệt' : 'từ chối'} bình luận`);
          setComments(comments.filter(c => c.id !== id));
      } catch (error) {
          toast.error('Lỗi khi xử lý bình luận');
      } finally {
          setProcessingId(null);
      }
  };

  const totalPending = posts.length + comments.length + activities.length;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-yellow-500" />
            Trung tâm Điều phối & Duyệt tin
          </h1>
          <div className="flex gap-4">
             <div className="px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold animate-pulse">
               CẦN XỬ LÝ NGAY
             </div>
          </div>
        </div>

        <div className="flex gap-4 border-b border-white/10 pb-4">
            <button 
                onClick={() => setActiveTab('posts')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'posts' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
            >
                Bài viết ({posts.length})
            </button>
            <button 
                onClick={() => setActiveTab('comments')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'comments' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
            >
                Bình luận ({comments.length})
            </button>
            <button 
                onClick={() => setActiveTab('activities')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'activities' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
            >
                Hoạt động Xanh ({activities.length})
            </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-yellow-500 animate-spin" /></div>
          ) : activeTab === 'posts' ? (
              posts.length > 0 ? posts.map(post => (
                <div key={post.id} className="p-6 rounded-3xl bg-card border border-white/10 flex flex-col md:flex-row items-start md:items-center gap-8 hover:border-yellow-500/30 transition-all">
                    <div className="w-16 h-16 shrink-0 rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/5">
                        <FileText className="w-6 h-6 text-white/20" />
                    </div>
                    <div className="flex-1 w-full">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-white/40" />
                            <h3 className="font-bold text-sm text-yellow-400">{post.author?.full_name || 'Người dùng ẩn danh'}</h3>
                        </div>
                        <p className="text-base font-bold mb-1">{post.title}</p>
                        <p className="text-sm text-white/60 mb-2 line-clamp-2">{post.content}</p>
                        <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest flex items-center gap-2">
                            <Clock className="w-3 h-3" /> {new Date(post.created_at).toLocaleString('vi-VN')}
                        </p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                        <button 
                            disabled={processingId === post.id}
                            onClick={() => handleModeratePost(post.id, 'reject')}
                            className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 text-xs font-bold hover:bg-red-600/30 transition-all disabled:opacity-50"
                        >
                            TỪ CHỐI
                        </button>
                        <button 
                            disabled={processingId === post.id}
                            onClick={() => handleModeratePost(post.id, 'approve')}
                            className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-500 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {processingId === post.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>} DUYỆT
                        </button>
                    </div>
                </div>
              )) : <div className="text-center py-10 text-white/40">Không có bài viết nào chờ duyệt</div>
          ) : activeTab === 'comments' ? (
              comments.length > 0 ? comments.map(comment => (
                <div key={comment.id} className="p-6 rounded-3xl bg-card border border-white/10 flex flex-col md:flex-row items-start md:items-center gap-8 hover:border-yellow-500/30 transition-all">
                    <div className="w-16 h-16 shrink-0 rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/5">
                        <MessageSquare className="w-6 h-6 text-white/20" />
                    </div>
                    <div className="flex-1 w-full">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-white/40" />
                            <h3 className="font-bold text-sm text-yellow-400">{comment.author?.full_name}</h3>
                        </div>
                        <p className="text-sm text-white/80 mb-2 p-3 bg-zinc-900 rounded-xl border border-white/5">{comment.content}</p>
                        <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest flex items-center gap-2">
                            <Clock className="w-3 h-3" /> {new Date(comment.created_at).toLocaleString('vi-VN')}
                        </p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                        <button 
                            disabled={processingId === comment.id}
                            onClick={() => handleModerateComment(comment.id, 'reject')}
                            className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 text-xs font-bold hover:bg-red-600/30 transition-all disabled:opacity-50"
                        >
                            TỪ CHỐI
                        </button>
                        <button 
                            disabled={processingId === comment.id}
                            onClick={() => handleModerateComment(comment.id, 'approve')}
                            className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-500 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {processingId === comment.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>} DUYỆT
                        </button>
                    </div>
                </div>
              )) : <div className="text-center py-10 text-white/40">Không có bình luận nào chờ duyệt</div>
          ) : (
              activities.length > 0 ? activities.map(act => (
                  <div key={act.id} className="p-6 rounded-3xl bg-card border border-white/10 flex flex-col md:flex-row items-start md:items-center gap-8 hover:border-green-500/30 transition-all">
                      <div className="w-24 h-24 shrink-0 rounded-2xl bg-zinc-900 overflow-hidden border border-white/5">
                          <img src={act.proof_url || 'https://via.placeholder.com/150'} alt="Proof" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 w-full">
                          <div className="flex items-center gap-2 mb-2">
                              <User className="w-4 h-4 text-white/40" />
                              <h3 className="font-bold text-sm text-green-400">{act.user?.full_name || 'Người dùng'}</h3>
                          </div>
                          <p className="text-base font-bold mb-1">{act.activity_type}</p>
                          <p className="text-sm text-white/60 mb-2 line-clamp-2">{act.description}</p>
                          <p className="text-[10px] text-yellow-500 font-bold mb-2">AI Confidence: {act.ai_confidence ? `${Math.round(act.ai_confidence * 100)}%` : 'N/A'}</p>
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest flex items-center gap-2">
                              <Clock className="w-3 h-3" /> {new Date(act.created_at).toLocaleString('vi-VN')}
                          </p>
                      </div>
                      <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                          <button className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 text-xs font-bold hover:bg-red-600/30 transition-all">TỪ CHỐI</button>
                          <button className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-500 transition-all">DUYỆT</button>
                      </div>
                  </div>
              )) : <div className="text-center py-10 text-white/40">Không có hoạt động xanh nào chờ duyệt</div>
          )}
        </div>

      </div>
    </div>
  );
}
