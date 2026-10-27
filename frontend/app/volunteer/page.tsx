"use client";
import React, { useEffect, useState } from 'react';
import { HeartHandshake, Clock, ShieldCheck, Plus, Calendar, FileText, Loader2, CheckCircle2, Award, X } from 'lucide-react';
import { volunteerService, VolunteerActivity } from '@/src/services/volunteer.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

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
      const payload = (data as any)?.data ?? data;
      setActivities(payload.activities || []);
      setTotalHours(payload.total_hours || 0);
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
          <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-6 p-8 text-center">
              <HeartHandshake className="w-16 h-16 text-primary mx-auto" />
              <h1 className="h1-page">Nhật ký Tình nguyện</h1>
              <p className="text-muted-foreground/60">Vui lòng đăng nhập để xem và ghi nhận giờ tình nguyện của bạn.</p>
              <Link href="/auth/login?redirect=/volunteer" className="px-8 py-3 rounded-xl bg-primary font-bold hover:bg-primary/90 transition-all text-primary-foreground">
                  Đăng nhập ngay
              </Link>
          </div>
      );
  }

  const progress = Math.min(100, (totalHours / 50) * 100);

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] w-full lg:min-h-screen">
      {/* Log Activity Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-xl p-8 max-w-md w-full relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 rounded-lg p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <h3 className="h2-section mb-2 flex items-center gap-2"><Plus className="text-primary w-6 h-6"/> Ghi nhận giờ</h3>
            <p className="text-sm text-muted-foreground/60 mb-6">Thêm hoạt động tình nguyện mới của bạn vào hệ thống.</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label-form block mb-2">Tên hoạt động *</label>
                  <Input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="VD: Dọn rác bãi biển"
                  />
                </div>
                <div>
                  <label className="label-form block mb-2">Chiến dịch / Tổ chức</label>
                  <Input
                    type="text"
                    value={formData.campaign_name}
                    onChange={e => setFormData({...formData, campaign_name: e.target.value})}
                    placeholder="VD: Mùa hè xanh 2026"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-form block mb-2">Số giờ *</label>
                    <Input
                      type="number"
                      step="0.5"
                      required
                      value={formData.hours}
                      onChange={e => setFormData({...formData, hours: e.target.value})}
                      placeholder="VD: 4.5"
                    />
                  </div>
                  <div>
                    <label className="label-form block mb-2">Ngày *</label>
                    <Input
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="label-form block mb-2">Mô tả (Tùy chọn)</label>
                  <Textarea
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Mô tả ngắn gọn về hoạt động..."
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={submitting}
                  loading={submitting}
                  icon={<Plus className="w-5 h-5" />}
                  loadingText="ĐANG LƯU..."
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  LƯU HOẠT ĐỘNG
                </Button>
                <p className="text-[10px] text-center text-muted-foreground/60 flex items-center justify-center gap-1"><ShieldCheck className="w-3 h-3"/> Hệ thống sẽ cần phê duyệt sau khi lưu.</p>
            </form>
          </div>
        </div>
      )}

      <div className="page-shell">
        {/* Header Dashboard */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 bg-card p-8 md:p-6 rounded-xl border border-border relative overflow-hidden flex flex-col justify-center">
             <div className="relative z-10">
                <h1 className="h1-page mb-4">Sổ tay Tình nguyện</h1>
                <p className="text-muted-foreground/60 max-w-md leading-relaxed mb-8">
                  Mỗi giờ bạn đóng góp đều mang lại giá trị cho cộng đồng. EduMap sẽ ghi nhận và cấp chứng chỉ tự động khi bạn đạt các cột mốc.
                </p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="w-5 h-5" /> GHI NHẬN GIỜ MỚI
                </Button>
             </div>
             <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <HeartHandshake className="w-24 h-24" />
             </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-8 text-center flex flex-col justify-center items-center relative overflow-hidden">
             <div className="w-24 h-24 rounded-full bg-card/40 flex items-center justify-center mb-4 border-4 border-primary/30">
                <span className="text-3xl font-semibold text-primary/90">{totalHours}</span>
             </div>
             <h3 className="font-bold text-foreground/80">Tổng giờ Tình nguyện</h3>
             
             <div className="w-full mt-6 space-y-2">
               <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground/60">
                 <span>Tiến độ chứng nhận</span>
                 <span className="text-primary">{totalHours}/50h</span>
               </div>
               <div className="h-2 w-full bg-card/40 rounded-full overflow-hidden border border-border">
                 <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${progress}%` }} />
               </div>
               {progress >= 100 && (
                 <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-primary bg-primary/10 py-2 rounded-lg">
                   <Award className="w-4 h-4"/> ĐỦ ĐIỀU KIỆN NHẬN CHỨNG NHẬN
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* History List */}
        <div>
          <h2 className="h2-section flex items-center gap-2"><Clock className="text-primary w-6 h-6"/> Lịch sử hoạt động</h2>
          
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>
          ) : activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map(act => (
                <div key={act.id} className="bg-card border border-border rounded-xl p-6 flex flex-col md:flex-row md:items-center gap-6 hover:border-primary/30 transition-colors">
                  <div className="w-16 h-16 shrink-0 rounded-lg bg-card border border-border flex items-center justify-center">
                    <span className="text-xl font-semibold text-primary/90">{act.hours}h</span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold">{act.title}</h3>
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-lg border ${
                        act.status === 'verified' ? 'bg-primary/10 text-primary border-accent/20' : 'bg-primary/10 text-primary/70 border-primary/20'
                      }`}>
                        {act.status === 'verified' ? 'Đã xác thực' : 'Đang chờ duyệt'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/60 mb-2">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(act.date).toLocaleDateString('vi-VN')}</span>
                      {act.campaign_name && <span className="flex items-center gap-1"><HeartHandshake className="w-3 h-3"/> {act.campaign_name}</span>}
                    </div>
                    {act.description && <p className="text-sm text-muted-foreground/60 line-clamp-2">{act.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl">
              <FileText className="w-12 h-12 text-muted-foreground/10 mx-auto mb-4" />
              <p className="text-muted-foreground/60 mb-4">Bạn chưa ghi nhận hoạt động tình nguyện nào.</p>
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                Thêm hoạt động đầu tiên
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
