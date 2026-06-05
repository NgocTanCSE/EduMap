"use client";
import React, { useEffect, useState } from 'react';
import { Globe, PlaneTakeoff, GraduationCap, MapPin, Users, Loader2, ArrowRight, Search, Navigation } from 'lucide-react';
import { intlService, InternationalProgram, AlumniNetwork } from '@/src/services/intl.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';

export default function IntlPage() {
  const [activeTab, setActiveTab] = useState<'programs' | 'alumni'>('programs');
  
  // Programs State
  const [programs, setPrograms] = useState<InternationalProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  
  // Alumni State
  const [alumni, setAlumni] = useState<AlumniNetwork[]>([]);
  const [alumniLoading, setAlumniLoading] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinForm, setJoinForm] = useState({
      university: '',
      country: '',
      major: '',
      latitude: '',
      longitude: '',
      contact_email: '',
  });
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (activeTab === 'programs') {
        fetchPrograms();
    } else {
        fetchAlumni();
    }
  }, [activeTab]);

  const fetchPrograms = async () => {
      try {
          setProgramsLoading(true);
          const data = await intlService.getPrograms();
          setPrograms(data);
      } catch (error: any) {
          toast.error(error.message || 'Không thể tải danh sách chương trình');
      } finally {
          setProgramsLoading(false);
      }
  };

  const fetchAlumni = async () => {
      try {
          setAlumniLoading(true);
          const data = await intlService.getAlumni();
          setAlumni(data);
      } catch (error: any) {
          toast.error(error.message || 'Không thể tải mạng lưới cựu sinh viên');
      } finally {
          setAlumniLoading(false);
      }
  };

  const handleJoinAlumni = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!authService.isLoggedIn()) {
          toast.error('Vui lòng đăng nhập để tham gia mạng lưới');
          return;
      }
      
      const user = authService.getUser();
      if (!user) return;

      if (!joinForm.latitude || !joinForm.longitude) {
          toast.error('Vui lòng chọn hoặc nhập tọa độ vị trí của bạn');
          return;
      }

      try {
          setJoining(true);
          await intlService.registerAlumni({
              full_name: user.fullName,
              ...joinForm
          });
          toast.success('Đã tham gia mạng lưới lưu học sinh thành công!');
          setShowJoinModal(false);
          fetchAlumni(); // Refresh list
      } catch (error: any) {
          toast.error(error.message);
      } finally {
          setJoining(false);
      }
  };

  const getUserLocation = () => {
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
              (position) => {
                  setJoinForm({
                      ...joinForm,
                      latitude: position.coords.latitude.toString(),
                      longitude: position.coords.longitude.toString()
                  });
                  toast.success('Đã lấy tọa độ vị trí hiện tại');
              },
              (error) => {
                  toast.error('Không thể lấy vị trí. Vui lòng nhập thủ công.');
              }
          );
      } else {
          toast.error('Trình duyệt không hỗ trợ Geolocation');
      }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 relative">
      
      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
                <button onClick={() => setShowJoinModal(false)} className="absolute top-6 right-6 text-white/40 hover:text-white">X</button>
                <h3 className="text-2xl font-bold mb-2">Tham gia Mạng lưới</h3>
                <p className="text-sm text-white/40 mb-6">Kết nối với cộng đồng du học sinh EduMap trên toàn cầu.</p>
                
                <form onSubmit={handleJoinAlumni} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2">Trường Đại học *</label>
                        <input type="text" required value={joinForm.university} onChange={e => setJoinForm({...joinForm, university: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" placeholder="VD: Harvard University" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2">Quốc gia *</label>
                        <input type="text" required value={joinForm.country} onChange={e => setJoinForm({...joinForm, country: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" placeholder="VD: Hoa Kỳ" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2">Chuyên ngành *</label>
                        <input type="text" required value={joinForm.major} onChange={e => setJoinForm({...joinForm, major: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" placeholder="VD: Computer Science" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-white/60 uppercase mb-2">Vĩ độ (Lat) *</label>
                            <input type="number" step="any" required value={joinForm.latitude} onChange={e => setJoinForm({...joinForm, latitude: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/60 uppercase mb-2">Kinh độ (Lng) *</label>
                            <input type="number" step="any" required value={joinForm.longitude} onChange={e => setJoinForm({...joinForm, longitude: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" />
                        </div>
                    </div>
                    <button type="button" onClick={getUserLocation} className="w-full py-2 bg-blue-500/10 text-blue-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-500/20">
                        <Navigation className="w-3 h-3" /> Tự động lấy vị trí hiện tại
                    </button>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase mb-2 mt-4">Email Liên hệ *</label>
                        <input type="email" required value={joinForm.contact_email} onChange={e => setJoinForm({...joinForm, contact_email: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" placeholder="Để các bạn khác có thể liên hệ" />
                    </div>
                    <button type="submit" disabled={joining} className="w-full py-4 mt-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                        {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : null} ĐĂNG KÝ VÀO BẢN ĐỒ
                    </button>
                </form>
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest">
                <Globe className="w-4 h-4" /> EduMap International
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">Vươn Ra Biển Lớn</h1>
            <p className="text-white/60 leading-relaxed">
                Khám phá các chương trình trao đổi, học bổng quốc tế và kết nối trực tiếp với mạng lưới lưu học sinh Việt Nam trên toàn cầu.
            </p>

            <div className="flex justify-center gap-4 pt-4">
                <button 
                    onClick={() => setActiveTab('programs')}
                    className={`px-8 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 ${activeTab === 'programs' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'bg-card border border-white/10 text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                    <PlaneTakeoff className="w-4 h-4" /> CHƯƠNG TRÌNH QUỐC TẾ
                </button>
                <button 
                    onClick={() => setActiveTab('alumni')}
                    className={`px-8 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 ${activeTab === 'alumni' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'bg-card border border-white/10 text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                    <Users className="w-4 h-4" /> MẠNG LƯỚI LƯU HỌC SINH
                </button>
            </div>
        </div>

        {/* Content based on Tab */}
        {activeTab === 'programs' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="text-blue-400 w-6 h-6"/> Học bổng & Trao đổi</h2>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input type="text" placeholder="Tìm chương trình..." className="w-full bg-card border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm focus:border-blue-500 outline-none" />
                    </div>
                </div>

                {programsLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
                ) : programs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {programs.map(program => (
                            <div key={program.id} className="bg-card border border-white/10 rounded-3xl p-6 hover:border-blue-500/50 transition-colors group">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest text-blue-400 border border-white/5">
                                        {program.type || 'Chương trình'}
                                    </span>
                                    <span className="text-xs text-white/40">Hạn chót: {new Date(program.application_deadline).toLocaleDateString('vi-VN')}</span>
                                </div>
                                <h3 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">{program.title}</h3>
                                <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                                    <MapPin className="w-4 h-4" /> {program.host_country} • {program.organization}
                                </div>
                                <p className="text-sm text-white/40 line-clamp-2 mb-6">
                                    {program.description}
                                </p>
                                <div className="flex gap-2 mb-6 flex-wrap">
                                    {program.benefits?.slice(0, 3).map((b, i) => (
                                        <span key={i} className="px-2 py-1 bg-green-500/10 text-green-400 text-[10px] rounded border border-green-500/20">{b}</span>
                                    ))}
                                    {program.benefits?.length > 3 && <span className="px-2 py-1 bg-white/5 text-white/40 text-[10px] rounded border border-white/10">+{program.benefits.length - 3}</span>}
                                </div>
                                {program.apply_url && (
                                    <a href={program.apply_url} target="_blank" className="inline-flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300">
                                        XEM CHI TIẾT <ArrowRight className="w-4 h-4" />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                        <PlaneTakeoff className="w-12 h-12 text-white/10 mx-auto mb-4" />
                        <p className="text-white/40">Chưa có chương trình quốc tế nào được công bố.</p>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'alumni' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-[40px] p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><MapPin className="text-blue-400 w-6 h-6"/> Bản đồ Lưu học sinh</h2>
                        <p className="text-white/60 max-w-xl text-sm">Tìm kiếm những người đi trước tại quốc gia bạn muốn đến. Họ sẽ là những Mentor tuyệt vời cho hành trình của bạn.</p>
                    </div>
                    <button onClick={() => setShowJoinModal(true)} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold whitespace-nowrap shadow-lg shadow-blue-600/20">
                        Thêm vị trí của bạn
                    </button>
                </div>

                {alumniLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
                ) : alumni.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {alumni.map(person => (
                            <div key={person.id} className="bg-card border border-white/10 rounded-3xl p-6 hover:border-blue-500/50 transition-colors relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] rounded-full" />
                                <div className="flex items-center gap-4 mb-4">
                                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(person.full_name)}&background=random`} alt="" className="w-12 h-12 rounded-full border border-white/10" />
                                    <div>
                                        <h3 className="font-bold">{person.full_name}</h3>
                                        <p className="text-xs text-blue-400 flex items-center gap-1"><MapPin className="w-3 h-3"/> {person.country}</p>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm text-white/60 mb-6">
                                    <p><strong className="text-white/80">Trường:</strong> {person.university}</p>
                                    <p><strong className="text-white/80">Ngành:</strong> {person.major}</p>
                                </div>
                                <a href={`mailto:${person.contact_email}`} className="w-full py-3 block text-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold transition-colors">
                                    LIÊN HỆ GIAO LƯU
                                </a>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                        <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
                        <p className="text-white/40">Bản đồ lưu học sinh đang trống. Hãy là người tiên phong!</p>
                    </div>
                )}
            </div>
        )}

      </div>
    </div>
  );
}
