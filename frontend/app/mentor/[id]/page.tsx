"use client";
import React, { useEffect, useState } from 'react';
import { avatarFallback, onImageError } from '@/src/lib/illustrations';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { mentorService } from '@/src/services/mentor.service';
import { authService } from '@/src/services/auth.service';
import { Star, Calendar, Clock, Award, Briefcase, ArrowLeft, CheckCircle2, X, Video } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { Button } from '@/components/ui/button';

export default function MentorDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mentorId = params.id as string;
  const isBookingMode = searchParams.get('action') === 'book';

  const [mentor, setMentor] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Booking state
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    if (mentorId) {
      fetchMentorData();
    }
  }, [mentorId]);

  const fetchMentorData = async () => {
    try {
      setLoading(true);
      const [mentorData, slotsData] = await Promise.all([
        mentorService.getMentorById(mentorId),
        mentorService.getMentorSlots(mentorId)
      ]);
      setMentor(mentorData);
      setSlots(slotsData || []);
    } catch (error) {
      console.error("Lỗi fetch mentor details:", error);
      toast.error('Could not load mentor details.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookSession = async () => {
    if (!selectedSlot) {
        toast.warning('Vui lòng chọn một khung giờ.');
        return;
    }
    const user = authService.getUser();
    if (!user) {
        toast.error('Bạn cần đăng nhập để đặt lịch.');
        router.push('/auth/login');
        return;
    }

    try {
        setIsBooking(true);
        // Convert 'HH:mm' string to full Date objects for today
        const today = new Date();
        const startParts = selectedSlot.start.split(':');
        const endParts = selectedSlot.end.split(':');
        
        const slotStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(startParts[0]), parseInt(startParts[1]));
        const slotEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(endParts[0]), parseInt(endParts[1]));

        await mentorService.bookMentor(mentorId, { start: slotStart.toISOString(), end: slotEnd.toISOString() });
        setBookingSuccess(true);
        toast.success('Đặt lịch thành công! Vui lòng chờ Mentor xác nhận.');
    } catch (error: any) {
        toast.error(error.message || 'Lỗi khi đặt lịch. Có thể do lịch đã bị trùng.');
    } finally {
        setIsBooking(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground/65">Loading profile...</div>;
  if (!mentor) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground/65">Mentor not found.</div>;

  return (
    <div className="page-shell">
      <Link href="/mentor" className="flex w-fit items-center gap-2 text-sm font-bold text-muted-foreground/60 transition-colors hover:text-foreground">
        <ArrowLeft size={16} /> Quay lại danh sách
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column - Profile Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 relative overflow-hidden">
            <BookmarkButton targetType="mentor" targetId={mentor.user_id} size="sm" className="absolute top-4 right-4 z-20" />
            <div className="flex flex-col md:flex-row gap-6 sm:gap-8 relative z-10">
              <img
                src={mentor.user?.avatar_url || avatarFallback(mentor.user?.full_name)}
                onError={onImageError(avatarFallback(mentor.user?.full_name))}
                alt={mentor.user?.full_name}
                className="h-32 w-32 shrink-0 rounded-xl object-cover border-4 border-card-foreground/20 sm:h-40 sm:w-40"
              />
              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="h1-page mb-2">{mentor.user?.full_name}</h1>
                  <div className="flex items-center gap-4 text-sm font-bold text-muted-foreground/60">
                    <span className="flex items-center gap-1.5"><Briefcase size={16} className="text-primary/70"/> {mentor.experience_years} năm kinh nghiệm</span>
                    <span className="flex items-center gap-1.5"><Star size={16} className="text-primary fill-current"/> {mentor.rating_avg} Rating</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mentor.specialties?.map((skill: string) => (
                    <span key={skill} className="label-pill px-3 py-1 rounded-lg bg-card/20 border border-border text-muted-foreground/60">{skill}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card/50 border border-border p-6 sm:p-8 rounded-xl space-y-4">
            <h2 className="h2-section border-b border-border pb-2">Giới thiệu bản thân</h2>
            <p className="text-muted-foreground/60 leading-relaxed whitespace-pre-wrap">{mentor.bio || "Mentor này chưa cập nhật phần giới thiệu chi tiết."}</p>
          </div>
        </div>

        {/* Right Column - Booking & Actions */}
        <div className="space-y-6">
          {!bookingSuccess ? (
            <div className="bg-card border border-border p-6 sm:p-8 rounded-xl space-y-6 sticky top-8">
              <div className="text-center pb-6 border-b border-border">
                <h2 className="h2-section mb-2">Đặt lịch ngay</h2>
                <p className="text-3xl font-semibold text-primary">{mentor.hourly_rate ? `${mentor.hourly_rate}k` : 'Miễn phí'} <span className="text-sm text-muted-foreground/60 font-normal">/ buổi</span></p>
              </div>

              <div className="space-y-4">
                <h3 className="label-form flex items-center gap-2"><Clock size={16}/> Khung giờ trống hôm nay</h3>
                {slots.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {slots.map((slot, idx) => (
                      <button
                        key={idx}
                        disabled={slot.is_booked}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-3 px-4 rounded-lg border text-sm font-bold transition-all ${
                          slot.is_booked 
                            ? 'bg-card/40 border-border text-foreground/40 cursor-not-allowed line-through'
                            : selectedSlot?.start === slot.start
                              ? 'bg-primary border-primary text-primary-foreground shadow-lg'
                              : 'bg-card border-border text-foreground hover:border-primary hover:bg-muted/30'
                        }`}
                      >
                        {slot.start} - {slot.end}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic text-center py-4">Mentor hiện không có khung giờ rảnh nào hôm nay.</p>
                )}
              </div>

              <div className="pt-6">
                <Button
                  onClick={handleBookSession}
                  disabled={isBooking || !selectedSlot}
                  loading={isBooking}
                  icon={<Calendar size={18} />}
                  loadingText="ĐANG ĐẶT..."
                  className="w-full"
                >
                  Xác nhận đặt lịch
                </Button>
                <p className="text-[10px] text-muted-foreground text-center mt-3">Lịch hẹn sẽ chờ Mentor xác nhận trước khi chính thức bắt đầu.</p>
              </div>
            </div>
          ) : (
            <div className="bg-accent/10 border border-accent/30 p-6 sm:p-8 rounded-xl space-y-6 text-center sticky top-8">
              <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 size={40} className="text-foreground" />
              </div>
              <h2 className="h2-section text-accent">Yêu cầu đã gửi!</h2>
              <p className="text-muted-foreground/60 text-sm leading-relaxed">
                Thông báo đã được gửi đến Mentor <strong>{mentor.user?.full_name}</strong>. 
                Bạn sẽ nhận được phản hồi sớm nhất qua hệ thống.
              </p>
              <Link href="/mentor" className="block w-full bg-card hover:bg-card/50 text-foreground font-bold py-4 rounded-lg transition-colors mt-6">
                Quay lại danh sách
              </Link>
            </div>
          )}

          <div className="bg-card/30 border border-border p-4 rounded-lg">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-2"><Video size={14}/> Các buổi tư vấn diễn ra online qua EduMap Meet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
