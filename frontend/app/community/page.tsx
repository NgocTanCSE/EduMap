"use client";
import React, { useEffect, useState } from 'react';
import { avatarFallback, onImageError } from '@/src/lib/illustrations';
import { 
  MessageSquare, Heart, Share2,
  Search, Users, TrendingUp, Flame, ShieldAlert, FileText, X, CheckCircle2, Bookmark
} from 'lucide-react';
import Link from 'next/link';
import { communityService } from '@/src/services/community.service';
import { authService } from '@/src/services/auth.service';
import { shareLink } from '@/src/lib/share';
import { toast } from 'sonner';
import { CardSkeleton } from '../../src/components/ui/Skeleton';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { Input } from '@/components/ui/input';
import { DetailPopup } from '@/components/ui/DetailPopup';

export default function CommunityPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPost, setSelectedPost] = useState<any>(null);

  // Create Post State
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchPosts(selectedGroupId || undefined, searchTerm || undefined);
  }, [page, selectedGroupId, searchTerm]);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchPosts = async (groupId?: string, search?: string) => {
    try {
      if (page === 1) setLoading(true);
      const data = await communityService.getPosts(page, 10, groupId, search);
      const payload = (data as any)?.data ?? data;
      const fetchedPosts = payload.posts || [];
      
      if (page === 1) {
        setPosts(fetchedPosts);
      } else {
        setPosts(prev => [...prev, ...fetchedPosts]);
      }
      
      setHasMore(fetchedPosts.length === 10);
    } catch (error) {
      console.error("Lỗi fetch posts:", error);
      toast.error('Không thể tải bài viết.');
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = (tag: string) => {
    const group = groups.find(g => `#${g.name?.replace(/\s+/g, '')}` === tag);
    if (group) {
      setSelectedGroupId(group.id);
      setPage(1);
    }
  };

  const handleGroupClick = (groupId: string) => {
    setSelectedGroupId(groupId);
    setPage(1);
  };

  const fetchGroups = async () => {
    try {
      const groupsData = await communityService.getGroups();
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      const tags = groupsData?.map((g: any) => `#${g.name?.replace(/\s+/g, '')}`).slice(0, 5) || [];
      setTrendingTags(tags);
    } catch (error) {
      console.error("Lỗi fetch groups:", error);
      setGroups([]);
      setTrendingTags([]);
    }
  };

  const handleSharePost = async (post: any) => {
    await shareLink({
      title: post.title,
      text: `${post.title} — Cộng đồng EduMap`,
      url: `${typeof window !== 'undefined' ? window.location.origin : ''}/community/post/${post.id}`,
    });
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
            setPosts([res.post, ...posts]);
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
          setPosts(posts.map(p => p.id === postId ? { ...p, like_count: Number(p.like_count || 0) + 1 } : p));
      } catch (error) {
          toast.error('Không thể thích bài viết này.');
      }
  };

  const formatHandle = (author: any) => {
    if (author?.username) return `@${author.username}`;
    if (author?.full_name) {
      const slug = author.full_name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
      return `@${slug || 'member'}`;
    }
    return '@edumap_member';
  };

  return (
    <div className="min-h-screen bg-background text-foreground w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
      <div className="w-full flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Main Feed */}
        <div className="flex-1 w-full space-y-6 min-w-0">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 sm:p-6 rounded-2xl border border-border/80 shadow-sm">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                <Users className="w-3.5 h-3.5" /> EduMap Community
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Cộng Đồng Giáo Dục & Học Thuật</h1>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedGroupId
                  ? `Đang lọc theo nhóm: ${groups.find(g => g.id === selectedGroupId)?.name || '...'}`
                  : 'Không gian hỏi đáp, chia sẻ học bổng, kinh nghiệm du học và tuyển dụng'
                }
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {selectedGroupId && (
                <button
                  onClick={() => {
                    setSelectedGroupId(null);
                    setPage(1);
                  }}
                  className="text-muted-foreground hover:text-foreground text-xs px-3 py-2 rounded-xl bg-muted/60 hover:bg-muted transition-colors font-medium"
                >
                  Xóa lọc
                </button>
              )}
              <button 
                  onClick={() => setIsCreating(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 text-xs"
              >
                  <FileText size={16} /> Đăng bài mới
              </button>
            </div>
          </header>

          {/* Create Post Modal */}
          {isCreating && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                  <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 w-full max-w-2xl relative shadow-xl">
                      <button onClick={() => setIsCreating(false)} className="absolute top-5 right-5 text-muted-foreground hover:text-foreground">
                        <X size={20}/>
                      </button>
                      <h2 className="text-xl font-bold mb-4">Tạo bài viết mới</h2>
                      <div className="bg-primary/10 border border-primary/20 p-3.5 rounded-xl flex items-start gap-3 mb-5">
                          <ShieldAlert className="text-primary shrink-0 mt-0.5" size={16} />
                          <p className="text-xs text-primary/90 leading-relaxed">Nội dung của bạn được AI kiểm duyệt văn minh tự động trước khi hiển thị. Vui lòng tôn trọng các tiêu chuẩn cộng đồng EduMap.</p>
                      </div>
                      <form onSubmit={handleCreatePost} className="space-y-4">
                          <input 
                              type="text" 
                              placeholder="Tiêu đề bài viết..." 
                              maxLength={255}
                              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-semibold focus:border-primary outline-none"
                              value={newTitle}
                              onChange={e => setNewTitle(e.target.value)}
                          />
                          <textarea 
                              placeholder="Nội dung chi tiết, câu hỏi hoặc kinh nghiệm chia sẻ..." 
                              rows={6}
                              className="w-full bg-background border border-border rounded-xl p-4 text-sm focus:border-primary outline-none resize-none"
                              value={newContent}
                              onChange={e => setNewContent(e.target.value)}
                          />
                          <div className="flex justify-end pt-2">
                              <button 
                                  type="submit" 
                                  disabled={isSubmitting}
                                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold py-2.5 px-6 rounded-xl transition-all disabled:opacity-50"
                              >
                                  {isSubmitting ? 'Đang kiểm duyệt...' : 'Đăng bài'}
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          )}

          {/* Posts Feed - MagicUI Tweet-Card Style */}
          <div className="space-y-4">
            {loading && page === 1 ? (
                <div className="space-y-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
            ) : posts.length > 0 ? (
                <>
                {posts.map(post => (
                    <article 
                        key={post.id} 
                        className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm hover:shadow-md transition-all hover:border-primary/40 relative group"
                    >
                        {/* Header: Author info, verified badge, handle, time */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <img 
                                    src={post.author?.avatar_url || avatarFallback(post.author?.full_name)}
                                    onError={onImageError(avatarFallback(post.author?.full_name))}
                                    alt="" 
                                    className="w-11 h-11 rounded-full border border-border object-cover shrink-0 ring-2 ring-primary/10"
                                />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="font-bold text-sm text-foreground hover:text-primary transition-colors truncate">
                                            {post.author?.full_name || 'Thành viên EduMap'}
                                        </h4>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" aria-label="Đã xác thực" />
                                        <span className="text-xs text-muted-foreground truncate">
                                            {formatHandle(post.author)}
                                        </span>
                                        <span className="text-muted-foreground text-xs">•</span>
                                        <span className="text-[11px] text-muted-foreground shrink-0">
                                            {new Date(post.created_at).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    {post.group && (
                                        <span className="inline-block mt-0.5 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                            {post.group.name}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <BookmarkButton targetType="community_post" targetId={post.id} size="sm" />
                        </div>

                        {/* Tweet Content */}
                        <div
                            onClick={() => setSelectedPost(post)}
                            className="cursor-pointer space-y-2 mb-4"
                        >
                            <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                                {post.title}
                            </h3>
                            <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 whitespace-pre-line">
                                {post.content}
                            </p>
                        </div>

                        {/* Tweet Actions Bar (Comments, Likes, Shares, Bookmark) */}
                        <div className="pt-3 border-t border-border/70 flex items-center justify-between text-muted-foreground text-xs max-w-md">
                            <button
                                type="button"
                                onClick={() => setSelectedPost(post)}
                                className="flex items-center gap-2 hover:text-primary transition-colors py-1 px-2.5 rounded-lg hover:bg-primary/10 group/btn"
                            >
                                <MessageSquare size={16} className="group-hover/btn:scale-110 transition-transform" /> 
                                <span className="font-medium">{post.comment_count || 0}</span>
                            </button>

                            <button 
                                type="button"
                                onClick={() => handleLike(post.id)}
                                className="flex items-center gap-2 hover:text-destructive transition-colors py-1 px-2.5 rounded-lg hover:bg-destructive/10 group/btn"
                            >
                                <Heart size={16} className="group-hover/btn:scale-110 group-active/btn:scale-75 transition-transform" /> 
                                <span className="font-medium">{post.like_count || 0}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSharePost(post)}
                                aria-label={`Chia sẻ bài viết ${post.title}`}
                                className="flex items-center gap-2 hover:text-accent transition-colors py-1 px-2.5 rounded-lg hover:bg-accent/10 group/btn"
                            >
                                <Share2 size={16} className="group-hover/btn:scale-110 transition-transform" />
                                <span className="font-medium">Chia sẻ</span>
                            </button>
                        </div>
                    </article>
                ))}
                {hasMore && (
                    <button 
                        onClick={() => setPage(p => p + 1)} 
                        disabled={loading}
                        className="w-full py-3.5 text-xs font-bold text-muted-foreground hover:text-foreground bg-card border border-border/80 hover:border-primary/50 rounded-xl transition-all shadow-sm"
                    >
                        {loading ? 'Đang tải thêm...' : 'Tải thêm bài viết'}
                    </button>
                )}
                </>
            ) : (
                <div className="text-center py-16 bg-card border border-dashed border-border rounded-2xl">
                    <Users size={44} className="mx-auto mb-3 text-muted-foreground/30" />
                    <h3 className="text-base font-bold mb-1">
                      {searchTerm
                        ? 'Không tìm thấy bài viết phù hợp với từ khóa.'
                        : 'Chưa có bài viết nào.'}
                    </h3>
                    {searchTerm ? (
                      <button
                        type="button"
                        onClick={() => setSearchInput('')}
                        className="mt-3 text-xs font-bold text-primary hover:underline"
                      >
                        Xóa tìm kiếm
                      </button>
                    ) : (
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-2">
                        Hãy là người đầu tiên chia sẻ câu hỏi hoặc kinh nghiệm học tập với cộng đồng!
                      </p>
                    )}
                </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 shrink-0 space-y-6">
            <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-5 shadow-sm sticky top-6">
                <div>
                    <Input
                        type="search"
                        placeholder="Tìm kiếm nội dung..." 
                        aria-label="Tìm kiếm bài viết cộng đồng"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        icon={Search}
                        className="w-full bg-background h-10 text-xs"
                    />
                </div>

                <div className="pt-4 border-t border-border/80 space-y-3">
                    <h3 className="font-bold text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                      <Flame size={14} className="text-primary"/> Chủ đề thịnh hành
                    </h3>
                    <ul className="space-y-2">
                        {trendingTags.length > 0 ? trendingTags.map((tag, i) => (
                            <li key={i}>
                                <button
                                    type="button"
                                    onClick={() => handleTagClick(tag)}
                                    className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium text-left flex items-center gap-1.5"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                                    <span>{tag}</span>
                                </button>
                            </li>
                        )) : (
                            <li className="text-xs text-muted-foreground italic">
                              Chưa có thẻ nổi bật nào.
                            </li>
                        )}
                    </ul>
                </div>

                <div className="pt-4 border-t border-border/80 space-y-3">
                    <h3 className="font-bold text-xs text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                      <Users size={14} className="text-primary"/> Nhóm học tập nổi bật
                    </h3>
                    <div className="space-y-2">
                        {groups.length > 0 ? groups.slice(0, 5).map((group, i) => (
                            <button
                                type="button"
                                key={group.id || i}
                                className={`flex w-full items-center gap-2.5 p-2 rounded-xl text-left transition-all ${
                                  selectedGroupId === group.id 
                                    ? 'bg-primary/10 text-primary font-bold' 
                                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={() => handleGroupClick(group.id)}
                            >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                  selectedGroupId === group.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                                }`}>
                                    {(group.name || 'G')[0]}
                                </div>
                                <span className="text-xs font-medium truncate flex-1">{group.name}</span>
                            </button>
                        )) : (
                            <div className="text-xs text-muted-foreground italic">
                              Chưa có nhóm nào.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </aside>

      </div>

      {/* Post Detail Popup */}
      {selectedPost && (
        <DetailPopup
          open={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          title={selectedPost.title}
          subtitle={selectedPost.author?.full_name}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <img
                src={selectedPost.author?.avatar_url || avatarFallback(selectedPost.author?.full_name)}
                onError={onImageError(avatarFallback(selectedPost.author?.full_name))}
                alt=""
                className="w-10 h-10 rounded-full bg-card border border-border"
              />
              <div>
                <p className="font-bold text-foreground text-sm flex items-center gap-1.5">
                  {selectedPost.author?.full_name}
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(selectedPost.created_at).toLocaleDateString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                  })}
                </p>
              </div>
            </div>
            <p className="text-foreground/90 leading-relaxed whitespace-pre-line text-sm">
              {selectedPost.content}
            </p>
            {selectedPost.group && (
              <p className="text-xs text-muted-foreground">
                Đăng trong nhóm: <strong className="text-primary">{selectedPost.group.name}</strong>
              </p>
            )}
          </div>
        </DetailPopup>
      )}
    </div>
  );
}
