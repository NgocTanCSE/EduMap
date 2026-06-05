"use client";
import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { mentorService } from '@/src/services/mentor.service';
import { authService } from '@/src/services/auth.service';
import { Star, Calendar, MessageSquare, Video, ArrowLeft, Clock, Award, Briefcase, BookOpen, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

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

        await mentorService.bookMentor(mentorId, slotStart.toISOString(), slotEnd.toISOString());
        setBookingSuccess(true);
        toast.success('Đặt lịch thành công! Vui lòng chờ Mentor xác nhận.');
    } catch (error: any) {
        toast.error(error.message || 'Lỗi khi đặt lịch. Có thể do lịch đã bị trùng.');
    } finally {
        setIsBooking(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white/50">Loading profile...</div>;
  if (!mentor) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white/50">Mentor not found.</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <Link href="/mentor" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 w-max">
            <ArrowLeft size={16} /> Quay lại danh sách
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Profile Info */}
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] -mr-10 -mt-10" />
                    <div className="flex flex-col md:flex-row gap-8 relative z-10">
                        <img 
                            src={mentor.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(mentor.user?.full_name || 'M')}&background=random&size=200`} 
                            alt={mentor.user?.full_name} 
                            className="w-32 h-32 md:w-40 md:h-40 rounded-3xl object-cover border-4 border-zinc-800 shadow-2xl" 
                        />
                        <div className="flex-1 space-y-4">
                            <div>
                                <h1 className="text-3xl font-black mb-2">{mentor.user?.full_name}</h1>
                                <div className="flex items-center gap-4 text-sm font-bold text-gray-400">
                                    <span className="flex items-center gap-1.5"><Briefcase size={16} className="text-purple-400"/> {mentor.experience_years} năm kinh nghiệm</span>
                                    <span className="flex items-center gap-1.5"><Star size={16} className="text-yellow-500 fill-current"/> {mentor.rating_avg} Rating</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {mentor.specialties?.map((skill: string) => (
                                    <span key={skill} className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-gray-300 uppercase tracking-widest">{skill}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-3xl space-y-4">
                    <h2 className="text-xl font-bold border-b border-white/10 pb-2">Giới thiệu bản thân</h2>
                    <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">{mentor.bio || "Mentor này chưa cập nhật phần giới thiệu chi tiết."}</p>
                </div>
            </div>

            {/* Right Column - Booking & Actions */}
            <div className="space-y-6">
                {!bookingSuccess ? (
                    <div className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-8 rounded-3xl space-y-6 sticky top-8">
                        <div className="text-center pb-6 border-b border-white/10">
                            <h2 className="text-2xl font-black mb-2">Đặt lịch ngay</h2>
                            <p className="text-3xl font-black text-yellow-500">{mentor.hourly_rate ? `${mentor.hourly_rate}k` : 'Miễn phí'} <span className="text-sm text-gray-500 font-normal">/ buổi</span></p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Clock size={16}/> Khung giờ trống hôm nay</h3>
                            {slots.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {slots.map((slot, idx) => (
                                        <button
                                            key={idx}
                                            disabled={slot.is_booked}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                                                slot.is_booked 
                                                    ? 'bg-zinc-900 border-transparent text-gray-600 cursor-not-allowed line-through'
                                                    : selectedSlot?.start === slot.start
                                                        ? 'bg-yellow-600 border-yellow-500 text-black shadow-lg shadow-yellow-600/20'
                                                        : 'bg-black border-white/10 text-white hover:border-yellow-500/50'
                                            }`}
                                        >
                                            {slot.start} - {slot.end}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic text-center py-4">Mentor hiện không có khung giờ rảnh nào hôm nay.</p>
                            )}
                        </div>

                        <div className="pt-6">
                            <button 
                                onClick={handleBookSession}
                                disabled={isBooking || !selectedSlot}
                                className="w-full bg-white hover:bg-gray-200 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isBooking ? 'Đang xử lý...' : <><Calendar size={18} /> Xác nhận đặt lịch</>}
                            </button>
                            <p className="text-[10px] text-gray-500 text-center mt-3">Lịch hẹn sẽ chờ Mentor xác nhận trước khi chính thức bắt đầu.</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-emerald-900/20 border border-emerald-500/30 p-8 rounded-3xl space-y-6 text-center sticky top-8">
                        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">
                            <CheckCircle2 size={40} className="text-black" />
                        </div>
                        <h2 className="text-2xl font-black text-emerald-400">Yêu cầu đã gửi!</h2>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Thông báo đã được gửi đến Mentor <strong>{mentor.user?.full_name}</strong>. 
                            Bạn sẽ nhận được phản hồi sớm nhất qua hệ thống.
                        </p>
                        <Link href="/mentor" className="block w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl transition-colors mt-6">
                            Quay lại danh sách
                        </Link>
                    </div>
                )}

                <div className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl">
                    <p className="text-xs text-gray-500 flex items-center justify-center gap-2"><Video size={14}/> Các buổi tư vấn diễn ra online qua EduMap Meet.</p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}