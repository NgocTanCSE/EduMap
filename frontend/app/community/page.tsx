"use client";
import React, { useEffect, useState } from 'react';
import { 
  MessageSquare, Heart, Share2, MoreHorizontal, 
  Search, Users, TrendingUp, Flame, ShieldAlert, FileText, X
} from 'lucide-react';
import Link from 'next/link';
import { communityService } from '../../src/services/community.service';
import { authService } from '../../src/services/auth.service';
import { toast } from 'sonner';
import { CardSkeleton } from '../../src/components/ui/Skeleton';

export default function CommunityPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Create Post State
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, [page]);

  const fetchPosts = async () => {
    try {
      if (page === 1) setLoading(true);
      const data = await communityService.getPosts(page, 10);
      
      if (page === 1) {
        setPosts(data.posts || []);
      } else {
        setPosts(prev => [...prev, ...(data.posts || [])]);
      }
      
      setHasMore((data.posts || []).length === 10);
    } catch (error) {
      console.error("Lỗi fetch posts:", error);
      toast.error('Không thể tải bài viết.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authService.isLoggedIn()) {
        toast.error('Bạn cần đăng nhập để đăng bài.');
        return;
    }
    if (!newTitle.trim() || !newContent.trim()) {
        toast.warning('Vui lòng nhập đầy đủ tiêu đề và nội dung.');
        return;
    }

    try {
        setIsSubmitting(true);
        const res = await communityService.createPost(newTitle, newContent);
        
        if (res.moderation_message) {
            toast.info(res.moderation_message, { duration: 5000 });
        } else {
            toast.success('Đăng bài thành công!');
            setPosts([res.post, ...posts]); // Optimistic update
        }
        
        setIsCreating(false);
        setNewTitle('');
        setNewContent('');
    } catch (error: any) {
        toast.error(error.message || 'Lỗi khi đăng bài.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleLike = async (postId: string) => {
      if (!authService.isLoggedIn()) {
          toast.error('Bạn cần đăng nhập để thích bài viết.');
          return;
      }
      try {
          await communityService.likePost(postId);
          // Optimistic UI update
          setPosts(posts.map(p => p.id === postId ? { ...p, like_count: Number(p.like_count) + 1 } : p));
      } catch (error) {
          toast.error('Không thể thích bài viết này.');
      }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex justify-center p-4 md:p-8">
      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-8">
        
        {/* Main Feed */}
        <div className="flex-1 space-y-6 max-w-3xl w-full">
          <header className="flex justify-between items-center bg-zinc-900/60 p-6 rounded-3xl border border-white/10 backdrop-blur-xl">
            <div>
              <h1 className="text-2xl font-black mb-1">Cộng đồng EduMap</h1>
              <p className="text-gray-400 text-sm">Hỏi đáp, chia sẻ và kết nối</p>
            </div>
            <button 
                onClick={() => setIsCreating(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-purple-500/20 active:scale-95 flex items-center gap-2"
            >
                <FileText size={18} /> Đăng bài
            </button>
          </header>

          {/* Create Post Modal */}
          {isCreating && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                  <div className="bg-zinc-900 border border-white/10 rounded-[2rem] p-6 w-full max-w-2xl shadow-2xl relative">
                      <button onClick={() => setIsCreating(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white"><X size={24}/></button>
                      <h2 className="text-2xl font-black mb-6">Tạo bài viết mới</h2>
                      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3 mb-6">
                          <ShieldAlert className="text-blue-400 shrink-0 mt-0.5" size={18} />
                          <p className="text-xs text-blue-300 leading-relaxed">Nội dung của bạn sẽ được AI kiểm duyệt tự động trước khi hiển thị. Vui lòng sử dụng ngôn từ lịch sự và tôn trọng cộng đồng.</p>
                      </div>
                      <form onSubmit={handleCreatePost} className="space-y-4">
                          <input 
                              type="text" 
                              placeholder="Tiêu đề bài viết..." 
                              maxLength={255}
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 font-bold text-lg outline-none focus:border-purple-500 transition-colors"
                              value={newTitle}
                              onChange={e => setNewTitle(e.target.value)}
                          />
                          <textarea 
                              placeholder="Nội dung chi tiết..." 
                              rows={6}
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-purple-500 transition-colors resize-none"
                              value={newContent}
                              onChange={e => setNewContent(e.target.value)}
                          />
                          <div className="flex justify-end pt-2">
                              <button 
                                  type="submit" 
                                  disabled={isSubmitting}
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-black py-3 px-8 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                  {isSubmitting ? 'Đang kiểm duyệt & Đăng...' : 'Đăng bài'}
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          )}

          {/* Posts Feed */}
          <div className="space-y-6">
            {loading && page === 1 ? (
                <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
            ) : posts.length > 0 ? (
                <>
                {posts.map(post => (
                    <article key={post.id} className="bg-zinc-900 border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <img 
                                    src={post.author?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.full_name || 'U')}&background=random`} 
                                    alt="" 
                                    className="w-10 h-10 rounded-full bg-zinc-800"
                                />
                                <div>
                                    <h4 className="font-bold text-sm text-gray-200 flex items-center gap-2">
                                        {post.author?.full_name}
                                        {post.author?.role === 'admin' && <span className="bg-red-500/20 text-red-400 text-[9px] uppercase px-1.5 py-0.5 rounded">Admin</span>}
                                        {post.group && <span className="text-xs font-normal text-gray-500">trong <strong className="text-purple-400">{post.group.name}</strong></span>}
                                    </h4>
                                    <p className="text-[11px] text-gray-500">
                                        {new Date(post.created_at).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            <button className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-white/5"><MoreHorizontal size={18}/></button>
                        </div>

                        <Link href={`/community/post/${post.id}`}>
                            <div className="space-y-2 cursor-pointer group">
                                <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">{post.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed line-clamp-3">
                                    {post.content}
                                </p>
                            </div>
                        </Link>

                        <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-6">
                            <button 
                                onClick={() => handleLike(post.id)}
                                className="flex items-center gap-2 text-gray-500 hover:text-pink-500 transition-colors text-sm font-bold group"
                            >
                                <Heart size={18} className="group-active:scale-75 transition-transform" /> 
                                {post.like_count}
                            </button>
                            <Link href={`/community/post/${post.id}`} className="flex items-center gap-2 text-gray-500 hover:text-blue-400 transition-colors text-sm font-bold">
                                <MessageSquare size={18} /> 
                                {post.comment_count}
                            </Link>
                            <button className="flex items-center gap-2 text-gray-500 hover:text-green-400 transition-colors text-sm font-bold ml-auto">
                                <Share2 size={18} />
                            </button>
                        </div>
                    </article>
                ))}
                {hasMore && (
                    <button 
                        onClick={() => setPage(p => p + 1)} 
                        disabled={loading}
                        className="w-full py-4 text-sm font-bold text-gray-500 hover:text-white hover:bg-zinc-900 rounded-2xl transition-all"
                    >
                        {loading ? 'Đang tải...' : 'Tải thêm bài viết'}
                    </button>
                )}
                </>
            ) : (
                <div className="text-center py-20 bg-zinc-900/30 border border-dashed border-white/10 rounded-3xl">
                    <p className="text-gray-500">Chưa có bài viết nào.</p>
                </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 space-y-6">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-4 sticky top-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm nội dung..." 
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-purple-500 text-sm"
                    />
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                    <h3 className="font-bold text-sm text-gray-300 flex items-center gap-2 uppercase tracking-widest"><Flame size={16} className="text-orange-500"/> Xu hướng</h3>
                    <ul className="space-y-3">
                        {['#HocReact', '#TimViecIT', '#ReviewTruong', '#HocBong2026'].map((tag, i) => (
                            <li key={i} className="text-sm text-gray-400 hover:text-purple-400 cursor-pointer transition-colors font-medium">
                                {tag}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                    <h3 className="font-bold text-sm text-gray-300 flex items-center gap-2 uppercase tracking-widest"><Users size={16} className="text-blue-500"/> Nhóm nổi bật</h3>
                    <div className="space-y-3">
                        {['Cộng đồng IT Fresher', 'Hội Săn Học Bổng', 'Luyện thi IELTS'].map((group, i) => (
                            <div key={i} className="flex items-center gap-3 group cursor-pointer">
                                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-black text-gray-500 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-all">
                                    {group.charAt(0)}
                                </div>
                                <span className="text-sm text-gray-400 group-hover:text-white font-medium transition-colors">{group}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </aside>

      </div>
    </div>
  );
}
