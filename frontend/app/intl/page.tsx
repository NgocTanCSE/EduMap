"use client";
import React, { useEffect, useState } from 'react';
import { Globe, PlaneTakeoff, GraduationCap, MapPin, Users, Loader2, ArrowRight, Search, Navigation } from 'lucide-react';
import { intlService, InternationalProgram, AlumniNetwork } from '@/src/services/intl.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import Pagination from '@/components/ui/Pagination';
import { avatarFallback } from '@/src/lib/illustrations';

export default function IntlPage() {
  const [activeTab, setActiveTab] = useState<'programs' | 'alumni'>('programs');
  
  // Programs State
  const [programs, setPrograms] = useState<InternationalProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programSearch, setProgramSearch] = useState('');
  const [programPage, setProgramPage] = useState(1);
  const programPageSize = 8;
  
  // Alumni State
  const [alumni, setAlumni] = useState<AlumniNetwork[]>([]);
  const [alumniLoading, setAlumniLoading] = useState(false);
  const [alumniSearch, setAlumniSearch] = useState('');
  const [alumniPage, setAlumniPage] = useState(1);
  const alumniPageSize = 8;

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
          setPrograms((data as any).data || (Array.isArray(data) ? data : []) || []);
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
          setAlumni((data as any).data || (Array.isArray(data) ? data : []) || []);
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
          fetchAlumni();
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
              () => {
                  toast.error('Không thể lấy vị trí. Vui lòng nhập thủ công.');
              }
          );
      } else {
          toast.error('Trình duyệt không hỗ trợ Geolocation');
      }
  };

  const filteredPrograms = programs.filter(p =>
      (p.title || '').toLowerCase().includes(programSearch.toLowerCase()) ||
      (p.host_country || '').toLowerCase().includes(programSearch.toLowerCase()) ||
      (p.organization || '').toLowerCase().includes(programSearch.toLowerCase())
  );
  const paginatedPrograms = filteredPrograms.slice(
      (programPage - 1) * programPageSize,
      programPage * programPageSize
  );

  const filteredAlumni = alumni.filter(a =>
      (a.full_name || '').toLowerCase().includes(alumniSearch.toLowerCase()) ||
      (a.country || '').toLowerCase().includes(alumniSearch.toLowerCase()) ||
      (a.university || '').toLowerCase().includes(alumniSearch.toLowerCase()) ||
      (a.major || '').toLowerCase().includes(alumniSearch.toLowerCase())
  );
  const paginatedAlumni = filteredAlumni.slice(
      (alumniPage - 1) * alumniPageSize,
      alumniPage * alumniPageSize
  );

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-6 sm:px-6 sm:py-8 relative">
      
      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 max-w-md w-full relative shadow-xl">
                <button onClick={() => setShowJoinModal(false)} className="absolute top-5 right-5 text-muted-foreground/60 hover:text-foreground">✕</button>
                <h3 className="text-xl font-bold mb-1">Tham gia Mạng lưới</h3>
                <p className="text-xs text-muted-foreground/80 mb-5">Kết nối với cộng đồng du học sinh EduMap trên toàn cầu.</p>
                
                <form onSubmit={handleJoinAlumni} className="space-y-3.5">
                    <div>
                        <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Trường Đại học *</label>
                        <input type="text" required value={joinForm.university} onChange={e => setJoinForm({...joinForm, university: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:border-primary outline-none" placeholder="VD: Harvard University" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Quốc gia *</label>
                        <input type="text" required value={joinForm.country} onChange={e => setJoinForm({...joinForm, country: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:border-primary outline-none" placeholder="VD: Hoa Kỳ" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Chuyên ngành *</label>
                        <input type="text" required value={joinForm.major} onChange={e => setJoinForm({...joinForm, major: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:border-primary outline-none" placeholder="VD: Computer Science" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Vĩ độ (Lat) *</label>
                            <input type="number" step="any" required value={joinForm.latitude} onChange={e => setJoinForm({...joinForm, latitude: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:border-primary outline-none" />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Kinh độ (Lng) *</label>
                            <input type="number" step="any" required value={joinForm.longitude} onChange={e => setJoinForm({...joinForm, longitude: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:border-primary outline-none" />
                        </div>
                    </div>
                    <button type="button" onClick={getUserLocation} className="w-full py-2 bg-primary/10 text-primary rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/20 transition-colors">
                        <Navigation className="w-3.5 h-3.5" /> Tự động lấy vị trí hiện tại
                    </button>
                    <div>
                        <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Email Liên hệ *</label>
                        <input type="email" required value={joinForm.contact_email} onChange={e => setJoinForm({...joinForm, contact_email: e.target.value})} className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:border-primary outline-none" placeholder="Email của bạn để kết nối" />
                    </div>
                    <button type="submit" disabled={joining} className="w-full py-3 mt-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                        {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : null} ĐĂNG KÝ VÀO BẢN ĐỒ
                    </button>
                </form>
            </div>
        </div>
      )}

      <div className="w-full mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
                <Globe className="w-4 h-4" /> EduMap International
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vươn Ra Biển Lớn</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
                Khám phá các chương trình trao đổi, học bổng quốc tế và kết nối trực tiếp với mạng lưới lưu học sinh Việt Nam trên toàn cầu.
            </p>

            <div className="flex justify-center gap-3 pt-2">
                <button 
                    onClick={() => setActiveTab('programs')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${activeTab === 'programs' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
                >
                    <PlaneTakeoff className="w-4 h-4" /> Chương trình quốc tế
                </button>
                <button 
                    onClick={() => setActiveTab('alumni')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-2 ${activeTab === 'alumni' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
                >
                    <Users className="w-4 h-4" /> Mạng lưới lưu học sinh
                </button>
            </div>
        </div>

        {/* Content based on Tab */}
        {activeTab === 'programs' && (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <GraduationCap className="text-primary w-5 h-5"/> Học bổng & Trao đổi ({filteredPrograms.length})
                    </h2>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                            type="text" 
                            placeholder="Tìm tên, quốc gia, đơn vị..." 
                            value={programSearch}
                            onChange={e => {
                                setProgramSearch(e.target.value);
                                setProgramPage(1);
                            }}
                            className="w-full bg-card border border-border rounded-xl py-2 pl-9 pr-4 text-sm focus:border-primary outline-none" 
                        />
                    </div>
                </div>

                {programsLoading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : filteredPrograms.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {paginatedPrograms.map(program => (
                                <div key={program.id} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm hover:shadow-md transition-all hover:border-primary/50 flex flex-col justify-between group relative">
                                    <div className="absolute top-3 right-3 z-10">
                                      <BookmarkButton targetType="intl_program" targetId={program.id} size="sm" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-2.5 pr-8">
                                            <span className="px-2 py-0.5 bg-primary/10 rounded-full text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/20">
                                                {program.type || 'Học bổng'}
                                            </span>
                                            {program.application_deadline && (
                                                <span className="text-[11px] text-muted-foreground truncate">
                                                    Hạn: {new Date(program.application_deadline).toLocaleDateString('vi-VN')}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-base font-bold text-foreground mb-1.5 group-hover:text-primary transition-colors line-clamp-2 min-h-[3rem]">
                                            {program.title}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 truncate">
                                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                                            <span className="truncate">{program.host_country} • {program.organization}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                                            {program.description}
                                        </p>
                                    </div>

                                    <div>
                                        <div className="flex gap-1.5 mb-4 flex-wrap">
                                            {program.benefits?.slice(0, 2).map((b, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-medium rounded border border-primary/15 truncate max-w-[140px]">
                                                    {b}
                                                </span>
                                            ))}
                                            {program.benefits && program.benefits.length > 2 && (
                                                <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded">
                                                    +{program.benefits.length - 2}
                                                </span>
                                            )}
                                        </div>
                                        {program.apply_url ? (
                                            <a 
                                                href={program.apply_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center w-full py-2 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs font-bold transition-all gap-1.5"
                                            >
                                                Ứng tuyển ngay <ArrowRight className="w-3.5 h-3.5" />
                                            </a>
                                        ) : (
                                            <div className="text-center text-xs text-muted-foreground py-2">
                                                Liên hệ qua EduMap
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {filteredPrograms.length > programPageSize && (
                            <div className="pt-6">
                                <Pagination
                                    currentPage={programPage}
                                    totalPages={Math.ceil(filteredPrograms.length / programPageSize)}
                                    onPageChange={setProgramPage}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 bg-card border border-dashed border-border rounded-2xl">
                        <PlaneTakeoff className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Không tìm thấy chương trình quốc tế phù hợp.</p>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'alumni' && (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><MapPin className="text-primary w-5 h-5"/> Mạng lưới Lưu học sinh ({filteredAlumni.length})</h2>
                        <p className="text-xs text-muted-foreground max-w-xl">Kết nối trực tiếp cùng cựu sinh viên tại quốc gia bạn hướng đến để nhận tư vấn và hướng dẫn thực tế.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-60">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input 
                                type="text" 
                                placeholder="Tìm theo tên, trường, ngành..." 
                                value={alumniSearch}
                                onChange={e => {
                                    setAlumniSearch(e.target.value);
                                    setAlumniPage(1);
                                }}
                                className="w-full bg-background border border-border rounded-xl py-2 pl-9 pr-3.5 text-xs focus:border-primary outline-none" 
                            />
                        </div>
                        <button onClick={() => setShowJoinModal(true)} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl whitespace-nowrap shadow-sm transition-all">
                            + Thêm vị trí
                        </button>
                    </div>
                </div>

                {alumniLoading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : filteredAlumni.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {paginatedAlumni.map(person => (
                                <div key={person.id} className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all hover:border-primary/50 flex flex-col justify-between relative">
                                    <div className="absolute top-3 right-3 z-10">
                                      <BookmarkButton targetType="intl_alumni" targetId={person.id} size="sm" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-3 pr-8">
                                            <img src={avatarFallback(person.full_name)} alt="" className="w-11 h-11 rounded-full border border-border object-cover" />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-bold text-sm text-foreground truncate">{person.full_name}</h3>
                                                <p className="text-xs text-primary font-medium flex items-center gap-1 truncate">
                                                    <MapPin className="w-3 h-3 shrink-0"/> {person.country}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-xs text-muted-foreground mb-4 bg-muted/40 p-2.5 rounded-xl border border-border/50">
                                            <p className="truncate"><strong className="text-foreground/80 font-medium">Trường:</strong> {person.university}</p>
                                            <p className="truncate"><strong className="text-foreground/80 font-medium">Ngành:</strong> {person.major}</p>
                                        </div>
                                    </div>
                                    <a 
                                        href={`mailto:${person.contact_email}`} 
                                        className="w-full py-2 text-center rounded-xl bg-card border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary text-xs font-bold transition-all"
                                    >
                                        Liên hệ giao lưu
                                    </a>
                                </div>
                            ))}
                        </div>
                        {filteredAlumni.length > alumniPageSize && (
                            <div className="pt-6">
                                <Pagination
                                    currentPage={alumniPage}
                                    totalPages={Math.ceil(filteredAlumni.length / alumniPageSize)}
                                    onPageChange={setAlumniPage}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 bg-card border border-dashed border-border rounded-2xl">
                        <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Bản đồ lưu học sinh đang trống hoặc không tìm thấy kết quả.</p>
                    </div>
                )}
            </div>
        )}

      </div>
    </div>
  );
}
