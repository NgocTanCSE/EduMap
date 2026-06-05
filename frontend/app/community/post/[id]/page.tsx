"use client";
import React, { useEffect, useState, use } from 'react';
import { 
  MessageSquare, Heart, Share2, MoreHorizontal, ArrowLeft,
  Send, AlertTriangle, CheckCircle2, Clock, User, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { communityService, Post, Comment } from '@/src/services/community.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const postId = resolvedParams.id;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (postId) {
      fetchPostAndComments();
    }
  }, [postId]);

  const fetchPostAndComments = async () => {
    try {
      setLoading(true);
      const [postData, commentsData] = await Promise.all([
        communityService.getPostById(postId),
        communityService.getComments(postId)
      ]);
      setPost(postData);
      setComments(commentsData.comments || []);
    } catch (error: any) {
      toast.error('Không thể tải bài viết');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
      if (!authService.isLoggedIn()) {
          toast.error('Vui lòng đăng nhập để thích');
          return;
      }
      try {
          await communityService.likePost(postId);
          if (post) setPost({ ...post, like_count: Number(post.like_count) + 1 });
      } catch (error) {
          toast.error('Không thể thích bài viết');
      }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authService.isLoggedIn()) {
        toast.error('Vui lòng đăng nhập để bình luận');
        return;
    }
    if (!newComment.trim()) return;

    try {
        setSubmitting(true);
        const res = await communityService.addComment(postId, newComment);
        
        if (res.moderation_message) {
            toast.info(res.moderation_message, { duration: 5000 });
        } else {
            toast.success('Đã gửi bình luận');
            setComments([...comments, res.comment]);
            if (post) setPost({ ...post, comment_count: Number(post.comment_count) + 1 });
        }
        setNewComment('');
    } catch (error: any) {
        toast.error(error.message || 'Lỗi khi gửi bình luận');
    } finally {
        setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!post) {
      return (
          <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center">
              <h1 className="text-2xl font-bold mb-4">Không tìm thấy bài viết</h1>
              <Link href="/community" className="text-purple-500 hover:underline">Quay lại Cộng đồng</Link>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <Link href="/community" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-bold w-fit">
          <ArrowLeft className="w-4 h-4" /> QUAY LẠI
        </Link>

        {/* Original Post */}
        <article className="bg-zinc-900 border border-white/10 rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <img 
                        src={post.author?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.full_name || 'U')}&background=random`} 
                        alt="" 
                        className="w-12 h-12 rounded-full bg-zinc-800"
                    />
                    <div>
                        <h4 className="font-bold text-gray-200">{post.author?.full_name}</h4>
                        <p className="text-xs text-gray-500 flex items-center gap-2">
                            <Clock className="w-3 h-3"/> {new Date(post.created_at).toLocaleString('vi-VN')}
                            {post.group && <span className="bg-white/5 px-2 py-0.5 rounded text-purple-400 border border-white/5">{post.group.name}</span>}
                        </p>
                    </div>
                </div>
                <button className="text-gray-500 hover:text-white p-2"><MoreHorizontal size={20}/></button>
            </div>

            <div className="space-y-4">
                <h1 className="text-2xl md:text-3xl font-black text-white leading-snug">{post.title}</h1>
                <div className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap">
                    {post.content}
                </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/10 flex items-center gap-6">
                <button onClick={handleLike} className="flex items-center gap-2 text-gray-400 hover:text-pink-500 transition-colors font-bold group">
                    <Heart size={20} className="group-active:scale-75 transition-transform" /> 
                    {post.like_count}
                </button>
                <div className="flex items-center gap-2 text-gray-400 font-bold">
                    <MessageSquare size={20} /> 
                    {post.comment_count}
                </div>
                <button className="flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors font-bold ml-auto">
                    <Share2 size={20} />
                </button>
            </div>
        </article>

        {/* Comments Section */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 md:p-8 space-y-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-500"/> Bình luận ({comments.length})
            </h3>

            {/* Comment Form */}
            <form onSubmit={handleComment} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-800 shrink-0 flex items-center justify-center border border-white/10 overflow-hidden">
                    {authService.isLoggedIn() ? (
                         <img src={authService.getUser()?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(authService.getUser()?.fullName || 'U')}&background=random`} alt="" className="w-full h-full object-cover"/>
                    ) : (
                        <User className="w-5 h-5 text-gray-500" />
                    )}
                </div>
                <div className="flex-1 space-y-3">
                    <textarea 
                        rows={3}
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder={authService.isLoggedIn() ? "Viết bình luận của bạn..." : "Vui lòng đăng nhập để bình luận"}
                        disabled={!authService.isLoggedIn()}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-purple-500 transition-colors resize-none disabled:opacity-50"
                    />
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3"/> AI sẽ kiểm duyệt nội dung
                        </span>
                        <button 
                            type="submit"
                            disabled={!authService.isLoggedIn() || submitting || !newComment.trim()}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} Gửi
                        </button>
                    </div>
                </div>
            </form>

            <div className="space-y-6 pt-6">
                {comments.length > 0 ? comments.map(comment => (
                    <div key={comment.id} className="flex gap-4 group">
                        <img 
                            src={comment.author?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author?.full_name || 'U')}&background=random`} 
                            alt="" 
                            className="w-10 h-10 rounded-full bg-zinc-800 shrink-0"
                        />
                        <div className="flex-1 space-y-1">
                            <div className="flex items-baseline gap-2">
                                <span className="font-bold text-sm text-gray-200">{comment.author?.full_name}</span>
                                <span className="text-[10px] text-gray-500">{new Date(comment.created_at).toLocaleString('vi-VN')}</span>
                            </div>
                            <div className="bg-black/40 border border-white/5 rounded-2xl rounded-tl-none p-4 text-sm text-gray-300">
                                {comment.content}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-8 text-gray-500 text-sm italic">
                        Chưa có bình luận nào. Hãy là người đầu tiên!
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}
