"use client";
import React, { useEffect, useState } from 'react';
import { HeartHandshake, Clock, ShieldCheck, Plus, Calendar, FileText, Loader2, CheckCircle2, Award } from 'lucide-react';
import { volunteerService, VolunteerActivity } from '@/src/services/volunteer.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import Link from 'next/link';

export default function VolunteerPage() {
  const [activities, setActivities] = useState<VolunteerActivity[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
      title: '',
      description: '',
      campaign_name: '',
      hours: '',
      date: new Date().toISOString().split('T')[0]
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authService.isLoggedIn()) {
        fetchActivities();
    } else {
        setLoading(false);
    }
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const data = await volunteerService.getMyActivities();
      setActivities(data.activities);
      setTotalHours(data.total_hours);
    } catch (error: any) {
      toast.error('Lỗi khi tải lịch sử tình nguyện');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title || !formData.hours || !formData.date) {
          toast.error('Vui lòng điền các trường bắt buộc');
          return;
      }

      try {
          setSubmitting(true);
          const result = await volunteerService.logActivity({
              ...formData,
              hours: Number(formData.hours)
          });
          toast.success(result.message);
          
          // Refresh list
          fetchActivities();
          
          // Reset form
          setShowForm(false);
          setFormData({
              title: '',
              description: '',
              campaign_name: '',
              hours: '',
              date: new Date().toISOString().split('T')[0]
          });
      } catch (error: any) {
          toast.error(error.message);
      } finally {
          setSubmitting(false);
      }
  };

  if (!authService.isLoggedIn()) {
      return (
          <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8 text-center space-y-6">
              <HeartHandshake className="w-20 h-20 text-orange-500 mx-auto" />
              <h1 className="text-3xl font-bold">Nhật ký Tình nguyện</h1>
              <p className="text-white/60">Vui lòng đăng nhập để xem và ghi nhận giờ tình nguyện của bạn.</p>
              <Link href="/auth/login?redirect=/volunteer" className="px-8 py-3 rounded-xl bg-orange-600 font-bold hover:bg-orange-500 transition-all">
                  Đăng nhập ngay
              </Link>
          </div>
      );
  }

  const progress = Math.min(100, (totalHours / 50) * 100);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      
      {/* Log Activity Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#121215] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                <button onClick={() => setShowForm(false)} className="absolute top-6 right-6 text-white/40 hover:text-white">X</button>
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Plus className="text-orange-500 w-6 h-6"/> Ghi nhận giờ</h3>
                <p className="text-sm text-white/40 mb-6">Thêm hoạt động tình nguyện mới của bạn vào hệ thống.</p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2">Tên hoạt động *</label>
                        <input 
                            type="text" 
                            required
                            value={formData.title}
                            onChange={e => setFormData({...formData, title: e.target.value})}
                            placeholder="VD: Dọn rác bãi biển"
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-orange-500 outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2">Chiến dịch / Tổ chức</label>
                        <input 
                            type="text" 
                            value={formData.campaign_name}
                            onChange={e => setFormData({...formData, campaign_name: e.target.value})}
                            placeholder="VD: Mùa hè xanh 2026"
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-orange-500 outline-none" 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-white/60 uppercase mb-2">Số giờ *</label>
                            <input 
                                type="number" 
                                step="0.5"
                                required
                                value={formData.hours}
                                onChange={e => setFormData({...formData, hours: e.target.value})}
                                placeholder="VD: 4.5"
                                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-orange-500 outline-none" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/60 uppercase mb-2">Ngày *</label>
                            <input 
                                type="date" 
                                required
                                value={formData.date}
                                onChange={e => setFormData({...formData, date: e.target.value})}
                                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-orange-500 outline-none" 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2">Mô tả (Tùy chọn)</label>
                        <textarea 
                            rows={3}
                            value={formData.description}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-orange-500 outline-none resize-none" 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full py-4 mt-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null} LƯU HOẠT ĐỘNG
                    </button>
                    <p className="text-[10px] text-center text-white/40"><ShieldCheck className="w-3 h-3 inline mr-1"/> Hệ thống sẽ cần phê duyệt sau khi lưu.</p>
                </form>
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-gradient-to-br from-orange-600/20 to-red-600/10 p-8 md:p-12 rounded-[40px] border border-white/5 relative overflow-hidden flex flex-col justify-center">
             <div className="relative z-10">
                <h1 className="text-4xl font-black mb-4">Sổ tay Tình nguyện</h1>
                <p className="text-white/60 max-w-md leading-relaxed mb-8">
                  Mỗi giờ bạn đóng góp đều mang lại giá trị cho cộng đồng. EduMap sẽ ghi nhận và cấp chứng nhận tự động khi bạn đạt các cột mốc.
                </p>
                <button 
                    onClick={() => setShowForm(true)}
                    className="px-8 py-3 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold flex items-center gap-2 shadow-xl shadow-orange-600/20 transition-all w-fit"
                >
                    <Plus className="w-5 h-5" /> GHI NHẬN GIỜ MỚI
                </button>
             </div>
             <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <HeartHandshake className="w-64 h-64" />
             </div>
          </div>

          <div className="bg-card border border-white/10 rounded-[40px] p-8 text-center flex flex-col justify-center items-center shadow-2xl relative overflow-hidden">
             <div className="w-24 h-24 rounded-full bg-black/40 flex items-center justify-center mb-4 border-4 border-orange-500/30">
                <span className="text-3xl font-black text-orange-400">{totalHours}</span>
             </div>
             <h3 className="font-bold text-white/80">Tổng giờ Tình nguyện</h3>
             
             <div className="w-full mt-6 space-y-2">
                 <div className="flex justify-between text-[10px] uppercase font-bold text-white/40">
                     <span>Tiến độ chứng nhận</span>
                     <span className="text-orange-500">{totalHours}/50h</span>
                 </div>
                 <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                     <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
                 </div>
                 {progress >= 100 && (
                     <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-green-400 bg-green-500/10 py-2 rounded-xl">
                         <Award className="w-4 h-4"/> ĐỦ ĐIỀU KIỆN NHẬN CHỨNG NHẬN
                     </div>
                 )}
             </div>
          </div>
        </div>

        {/* History List */}
        <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Clock className="text-orange-500 w-6 h-6"/> Lịch sử hoạt động</h2>
            
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-orange-500 animate-spin" /></div>
            ) : activities.length > 0 ? (
                <div className="space-y-4">
                    {activities.map(act => (
                        <div key={act.id} className="bg-card border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row md:items-center gap-6 hover:border-orange-500/30 transition-colors">
                            <div className="w-16 h-16 shrink-0 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center">
                                <span className="text-xl font-black text-orange-400">{act.hours}h</span>
                            </div>
                            
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-lg font-bold">{act.title}</h3>
                                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-lg border ${
                                        act.status === 'verified' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                    }`}>
                                        {act.status === 'verified' ? 'Đã xác thực' : 'Đang chờ duyệt'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-4 text-xs text-white/40 mb-2">
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(act.date).toLocaleDateString('vi-VN')}</span>
                                    {act.campaign_name && <span className="flex items-center gap-1"><HeartHandshake className="w-3 h-3"/> {act.campaign_name}</span>}
                                </div>
                                {act.description && <p className="text-sm text-white/60 line-clamp-2">{act.description}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                    <FileText className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40 mb-4">Bạn chưa ghi nhận hoạt động tình nguyện nào.</p>
                    <button onClick={() => setShowForm(true)} className="px-6 py-2 rounded-xl border border-white/20 hover:bg-white/5 text-sm font-bold transition-all">
                        Thêm hoạt động đầu tiên
                    </button>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
