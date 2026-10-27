"use client";
import React, { useEffect, useState } from 'react';
import { avatarFallback, onImageError } from '@/src/lib/illustrations';
import { Search, Star, Sparkles, UserCheck, Calendar, BrainCircuit, Loader2 } from 'lucide-react';
import { mentorService } from '@/src/services/mentor.service';
import { authService } from '@/src/services/auth.service';
import { CardSkeleton } from '../../src/components/ui/Skeleton';
import { toast } from 'sonner';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BookmarkButton } from '@/components/ui/BookmarkButton';

export default function MentorPage() {
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');

  const [isAiMatching, setIsAiMatching] = useState(false);
  const [aiMatches, setAiMatches] = useState<any[]>([]);

  useEffect(() => {
    fetchMentors(activeCategory === 'Tất cả' ? undefined : activeCategory);
  }, [activeCategory]);

  const fetchMentors = async (specialty?: string) => {
    try {
      setLoading(true);
      const data = await mentorService.getMentors(specialty);
      setMentors(data || []);
    } catch (error) {
      console.error("Lỗi fetch mentors:", error);
      toast.error('Không thể tải danh sách cố vấn');
    } finally {
      setLoading(false);
    }
  };

  const handleAiMatch = async () => {
    const user = authService.getUser();
    if (!user) {
      toast.error('Vui lòng đăng nhập để dùng tính năng ghép cặp AI');
      return;
    }

    try {
      setIsAiMatching(true);
      toast.info('AI đang phân tích hồ sơ của bạn...');
      const userRegion = (user as any)?.location || undefined;
      const response = await mentorService.getRecommendations(user.id, {
        specialty: activeCategory !== 'Tất cả' ? activeCategory : undefined,
        region: userRegion,
      });

      if (response && response.top_matches) {
        setAiMatches(response.top_matches);
        toast.success('Đã tìm thấy cố vấn phù hợp!');
      } else {
        toast.error('Chưa tìm thấy cố vấn phù hợp lúc này.');
      }
    } catch (error) {
      toast.error('Ghép cặp AI thất bại');
    } finally {
      setIsAiMatching(false);
    }
  };

  const filteredMentors = mentors.filter(m =>
    m.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.specialties?.some((s: string) => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="page-shell">
      {/* Header & AI Match */}
      <div className="bg-card p-10 rounded-xl border border-border flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
        <div className="relative z-10 space-y-4 max-w-xl">
          <h1 className="h1-page">Trung tâm Cố vấn EduMap</h1>
          <p className="text-muted-foreground/60">
            Kết nối với chuyên gia hàng đầu, nhận hướng dẫn 1-on-1 và cùng mentor phát triển sự nghiệp của bạn.
          </p>
          <div className="pt-4">
            <Button
              onClick={handleAiMatch}
              disabled={isAiMatching}
              loading={isAiMatching}
              icon={<BrainCircuit className="w-5 h-5" />}
              loadingText="AI ĐANG GHÉP CẶP..."
              className="bg-primary hover:bg-primary/90 px-8 py-4"
            >
              TÌM CỐ VẤN PHÙ HỢP BẰNG AI
            </Button>
          </div>
        </div>
        <div className="relative z-10 w-full max-w-sm">
          <Input
            type="text"
            placeholder="Tìm theo tên, vai trò, kỹ năng..."
            icon={Search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input input-with-icon"
          />
        </div>
      </div>

      {/* AI Match Results */}
      {aiMatches.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary/70 w-6 h-6" />
            <h2 className="h2-section">Cố vấn phù hợp với bạn</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {aiMatches.map((match: any, idx: number) => {
              const mentorData = mentors.find(m => m.user_id === match.mentor_id) || {};
              return (
                <div key={idx} className="bg-gradient-to-b from-primary/20 to-background border border-primary/30 p-6 rounded-xl relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-bl-xl z-10">
                    {match.match_score}% Match
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-card rounded-full border-2 border-primary/50 flex items-center justify-center font-semibold text-xl text-primary/70 overflow-hidden shrink-0">
                      <img
                        src={mentorData.user?.avatar_url || avatarFallback(match.name)}
                        alt=""
                        onError={onImageError(avatarFallback(match.name))}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="h3-card">{match.name}</h3>
                      <p className="text-xs text-primary/70 line-clamp-1">{mentorData.specialties?.[0]}</p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-6 flex-1">
                    <h4 className="label-form">Lý do phù hợp:</h4>
                    <ul className="text-xs text-muted-foreground/60 space-y-1.5">
                      {match.match_reasons?.map((r: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5 leading-snug">
                          <span className="text-primary/70 mt-0.5">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link
                    href={`/mentor/${match.mentor_id}`}
                    className="mt-auto block w-full bg-primary/20 hover:bg-primary/40 text-primary/70 border border-primary/30 py-3 rounded-xl font-bold text-center text-sm transition-all"
                  >
                    Xem Hồ Sơ & Đặt Lịch
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar border-b border-border">
        {['Tất cả', 'Software Engineer', 'Data', 'Design', 'Marketing', 'Startup'].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-2.5 rounded-xl border text-sm font-bold transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-card text-foreground border-border' : 'bg-transparent border-border text-muted-foreground/60 hover:text-foreground hover:border-border'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Mentors Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredMentors.map(mentor => (
            <div key={mentor.user_id} className="relative p-6 rounded-xl bg-card border border-border hover:border-accent/30 hover:bg-card/50 transition-all group flex flex-col">
              <BookmarkButton targetType="mentor" targetId={mentor.user_id} size="sm" className="absolute top-3 right-3 z-20" />
              <div>
                <div className="flex gap-6 mb-6">
                  <div className="relative">
                    <img src={mentor.user?.avatar_url || avatarFallback(mentor.user?.full_name)} onError={onImageError(avatarFallback(mentor.user?.full_name))} alt="" className="w-24 h-24 rounded-lg object-cover border border-border" />
                    {mentor.is_verified && (
                      <div className="absolute -bottom-2 -right-2 p-1 bg-background rounded-full">
                        <div className="w-4 h-4 bg-accent rounded-full border-2 border-background" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="h3-card group-hover:text-primary transition-colors">{mentor.user?.full_name || "Mentor EduMap"}</h3>
                      <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded border border-primary/20 text-primary">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="text-xs font-semibold">{mentor.rating_avg || 5.0}</span>
                      </div>
                    </div>
                    <p className="text-muted-foreground/60 text-sm mb-3 line-clamp-1">{mentor.bio || "Cố vấn được xác minh từ EduMap"}</p>
                    <div className="flex flex-wrap gap-2">
                      {mentor.specialties?.slice(0, 3).map((skill: string) => (
                        <span key={skill} className="px-2 py-1 rounded bg-card/40 border border-border text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{skill}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-auto">
                <Link href={`/mentor/${mentor.user_id}`} className="py-3 rounded-xl bg-card/40 border border-border text-xs font-bold hover:bg-muted/50 transition-colors flex items-center justify-center gap-2">
                  <UserCheck className="w-4 h-4" /> Xem Hồ Sơ
                </Link>
                <Link href={`/mentor/${mentor.user_id}?action=book`} className="py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]">
                  <Calendar className="w-4 h-4" /> Đặt Lịch
                </Link>
              </div>
            </div>
          ))}
          {filteredMentors.length === 0 && (
            <div className="col-span-1 md:col-span-2 text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
              Chưa có cố vấn nào phù hợp. Hồ sơ cố vấn do người dùng thật tạo —
              hãy quay lại sau hoặc đăng ký trở thành cố vấn.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
