"use client";
import React, { useEffect, useState } from 'react';
import { Leaf, Clock, Camera, CheckCircle, Info, ArrowRight, ShieldCheck, MapPin, Loader2, UploadCloud } from 'lucide-react';
import { greenService, GreenChallenge } from '@/src/services/green.service';
import { gamificationService, UserProgress } from '@/src/services/gamification.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';

export default function GreenPage() {
  const [challenges, setChallenges] = useState<GreenChallenge[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [activityType, setActivityType] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mockProofUrl, setMockProofUrl] = useState(''); // To simulate uploaded image

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [challengesData, progressData] = await Promise.all([
        greenService.getChallenges(),
        authService.isLoggedIn() ? gamificationService.getMyProgress() : Promise.resolve(null)
      ]);
      setChallenges(challengesData);
      setProgress(progressData);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleMockUpload = () => {
    setMockProofUrl('https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=800&auto=format&fit=crop');
    toast.success('Đã tải ảnh lên thành công (Mock)');
  };

  const handleSubmitProof = async () => {
    if (!authService.isLoggedIn()) {
      toast.error('Vui lòng đăng nhập để nộp minh chứng');
      return;
    }
    if (!activityType || !mockProofUrl) {
      toast.error('Vui lòng chọn loại hoạt động và tải ảnh minh chứng');
      return;
    }

    try {
      setSubmitting(true);
      await greenService.submitProof(activityType, description, mockProofUrl);
      toast.success('Đã gửi báo cáo cho AI kiểm duyệt!');
      setActivityType('');
      setDescription('');
      setMockProofUrl('');
    } catch (error: any) {
      toast.error(error.message || 'Nộp báo cáo thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 rounded-3xl bg-green-500/10 border border-green-500/20">
            <Leaf className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="text-3xl font-bold">{(progress?.carbon_saved || 0).toFixed(1)}kg</h3>
            <p className="text-sm text-green-500/60 font-medium uppercase tracking-wider">CO2 đã tiết kiệm</p>
          </div>
          <div className="p-8 rounded-3xl bg-yellow-500/10 border border-yellow-500/20">
            <Clock className="w-8 h-8 text-yellow-500 mb-4" />
            <h3 className="text-3xl font-bold">{progress?.volunteer_hours || 0} Giờ</h3>
            <p className="text-sm text-yellow-500/60 font-medium uppercase tracking-wider">Tình nguyện cộng đồng</p>
          </div>
          <div className="p-8 rounded-3xl bg-purple-500/10 border border-purple-500/20">
            <ShieldCheck className="w-8 h-8 text-purple-500 mb-4" />
            <h3 className="text-3xl font-bold">{progress?.points || 0}</h3>
            <p className="text-sm text-purple-500/60 font-medium uppercase tracking-wider">Điểm tích lũy xanh</p>
          </div>
        </div>

        {/* Green Challenges Grid */}
        <div>
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Thử thách Xanh</h2>
              <p className="text-white/40 text-sm">Tham gia bảo vệ môi trường và nhận điểm thưởng.</p>
            </div>
            <button className="text-green-500 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
              Xem tất cả <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          {loading ? (
             <div className="flex justify-center py-10">
                 <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
             </div>
          ) : challenges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {challenges.map(item => (
                <div key={item.id} className="group relative rounded-3xl overflow-hidden border border-white/10 bg-card hover:border-green-500/30 transition-all">
                  <div className="aspect-[21/9] relative">
                    <img src={item.image_url || 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=400'} alt="" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent" />
                  </div>
                  <div className="p-6 relative">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold">{item.title}</h3>
                      <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">+{item.points} XP</span>
                    </div>
                    <div className="flex gap-4 mb-6">
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <Leaf className="w-3 h-3 text-green-500" /> {(item.carbon_saved_kg || 0).toFixed(1)}kg CO2
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <CheckCircle className="w-3 h-3 text-blue-500" /> {item.participants_count || 0} tham gia
                      </div>
                    </div>
                    <button className="w-full py-3 rounded-2xl bg-white text-black font-bold text-sm hover:bg-green-400 transition-colors">
                      Tham gia ngay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-card border border-white/10 rounded-3xl text-white/40">
                Chưa có thử thách nào đang diễn ra.
            </div>
          )}
        </div>

        {/* Volunteer Log Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="p-8 rounded-3xl bg-card border border-white/10 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Camera className="w-5 h-5 text-green-400" />
              Nộp minh chứng Sống Xanh
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-xs text-white/40 mb-2 uppercase font-bold">Loại hoạt động</label>
                <select 
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-green-500 outline-none transition-colors"
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                >
                    <option value="">Chọn loại hoạt động...</option>
                    <option value="RECYCLE">♻️ Phân loại & Tái chế rác</option>
                    <option value="TREE_PLANTING">🌳 Trồng cây xanh</option>
                    <option value="PUBLIC_TRANSPORT">🚌 Sử dụng phương tiện công cộng</option>
                    <option value="ENERGY_SAVING">💡 Tiết kiệm năng lượng</option>
                </select>
              </div>
              
              <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase font-bold">Mô tả thêm (Tùy chọn)</label>
                  <textarea 
                    rows={2} 
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-green-500 outline-none transition-colors resize-none" 
                    placeholder="VD: Tôi đã phân loại 2kg rác nhựa hôm nay..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2 uppercase font-bold">Minh chứng (Hình ảnh)</label>
                {!mockProofUrl ? (
                    <div 
                        onClick={handleMockUpload}
                        className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center hover:border-green-500/50 hover:bg-green-500/5 cursor-pointer transition-all group"
                    >
                    <UploadCloud className="w-8 h-8 text-white/20 mx-auto mb-2 group-hover:text-green-500 transition-colors" />
                    <p className="text-xs text-white/40 group-hover:text-white/60">Nhấn để tải ảnh minh chứng lên</p>
                    </div>
                ) : (
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video">
                        <img src={mockProofUrl} alt="Proof" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setMockProofUrl('')}>
                            <p className="text-sm font-bold text-red-400">Xóa ảnh</p>
                        </div>
                    </div>
                )}
              </div>
              
              <button 
                onClick={handleSubmitProof}
                disabled={submitting || !activityType || !mockProofUrl}
                className="w-full py-4 rounded-2xl bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:shadow-none text-white font-bold text-sm transition-all shadow-lg shadow-green-600/20 flex justify-center items-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submitting ? 'ĐANG XỬ LÝ...' : 'GỬI CHO AI KIỂM DUYỆT'}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-green-500/5 border border-green-500/10">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-green-500/10 rounded-2xl">
                  <ShieldCheck className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h4 className="font-bold mb-2 text-sm">Quy trình duyệt tự động bởi AI</h4>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Hệ thống tích hợp <strong>Gemini AI Vision</strong> để phân tích hình ảnh minh chứng. Nếu hợp lệ (Confidence {'>'} 80%), bạn sẽ nhận ngay <strong>50 XP</strong>. Các trường hợp không rõ ràng sẽ được chuyển cho Moderator kiểm tra thủ công.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-blue-500/10 rounded-2xl">
                  <MapPin className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-bold mb-2 text-sm">Hoạt động gần bạn</h4>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Có 5 điểm thu gom pin cũ đang diễn ra trong bán kính 2km từ vị trí của bạn.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
