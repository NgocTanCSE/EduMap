"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Terminal, Code, Users, Calendar, Trophy, Search, ArrowRight, Loader2, Rocket } from 'lucide-react';
import { hackathonService, Hackathon } from '@/src/services/hackathon.service';
import { toast } from 'sonner';

export default function HackathonListPage() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchHackathons();
  }, []);

  const fetchHackathons = async () => {
    try {
      setLoading(true);
      const data = await hackathonService.getHackathons();
      setHackathons(data);
    } catch (error: any) {
      toast.error(error.message || 'Không thể tải danh sách Hackathon');
    } finally {
      setLoading(false);
    }
  };

  const filteredHackathons = hackathons.filter(h => 
    h.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
              <Terminal className="text-purple-500 w-8 h-8" />
              Sân chơi Hackathon
            </h1>
            <p className="text-white/40 text-sm">Nơi hội tụ những ý tưởng đột phá và giải pháp công nghệ.</p>
          </div>
          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input 
              type="text" 
              placeholder="Tìm kiếm cuộc thi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-purple-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Highlight Banner */}
        <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/20 border border-purple-500/30 rounded-[40px] p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row gap-8 items-center">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full -mr-20 -mt-20 pointer-events-none" />
            
            <div className="flex-1 relative z-10 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest border border-purple-500/30">
                    <Rocket className="w-3 h-3" /> Mùa giải mới
                </div>
                <h2 className="text-3xl md:text-4xl font-black">Hackathon Mùa Hè 2026: AI & Education</h2>
                <p className="text-white/60 max-w-xl leading-relaxed">
                    Sử dụng Trí tuệ nhân tạo để giải quyết các thách thức trong giáo dục tại các vùng sâu vùng xa. Tổng giải thưởng lên đến 100,000,000 VNĐ.
                </p>
                <div className="flex items-center gap-4 pt-4">
                    <button className="px-8 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 font-bold transition-all shadow-lg shadow-purple-600/20">
                        Đăng ký ngay
                    </button>
                    <button className="px-8 py-3 rounded-2xl border border-white/10 hover:bg-white/5 font-bold transition-all">
                        Thể lệ
                    </button>
                </div>
            </div>

            <div className="hidden lg:block relative z-10 w-1/3">
                {/* Decorative Elements */}
                <div className="w-full aspect-square bg-gradient-to-br from-purple-500/20 to-transparent rounded-3xl border border-purple-500/20 flex flex-col items-center justify-center p-8 backdrop-blur-sm transform rotate-3">
                    <Code className="w-16 h-16 text-purple-400 mb-4" />
                    <p className="font-mono text-xs text-purple-300 text-center">{`function buildFuture() { \n  return impact; \n}`}</p>
                </div>
            </div>
        </div>

        {/* Hackathon List */}
        <div>
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" /> Các cuộc thi đang diễn ra
            </h3>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                </div>
            ) : filteredHackathons.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredHackathons.map((hackathon) => {
                        const startDate = new Date(hackathon.start_date);
                        const endDate = new Date(hackathon.end_date);
                        const isActive = hackathon.status === 'ongoing' || hackathon.status === 'upcoming';
                        
                        return (
                            <Link href={`/hackathon/${hackathon.id}`} key={hackathon.id} className="group">
                                <div className="bg-card border border-white/10 rounded-3xl overflow-hidden hover:border-purple-500/50 transition-all flex flex-col h-full hover:shadow-xl hover:shadow-purple-500/10">
                                    <div className="h-2 w-full bg-gradient-to-r from-purple-600 to-blue-600" />
                                    <div className="p-6 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                                hackathon.status === 'ongoing' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                                hackathon.status === 'upcoming' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                'bg-zinc-800 text-white/40 border border-white/10'
                                            }`}>
                                                {hackathon.status === 'ongoing' ? 'ĐANG DIỄN RA' : 
                                                 hackathon.status === 'upcoming' ? 'SẮP MỞ ĐĂNG KÝ' : 'ĐÃ KẾT THÚC'}
                                            </span>
                                        </div>
                                        
                                        <h4 className="text-xl font-bold mb-3 group-hover:text-purple-400 transition-colors line-clamp-2">
                                            {hackathon.title}
                                        </h4>
                                        <p className="text-sm text-white/40 line-clamp-2 mb-6 flex-1">
                                            {hackathon.description || 'Chưa có thông tin chi tiết.'}
                                        </p>
                                        
                                        <div className="space-y-3 pt-4 border-t border-white/5 mb-6">
                                            <div className="flex items-center gap-3 text-xs text-white/60">
                                                <Calendar className="w-4 h-4 text-purple-400" />
                                                {startDate.toLocaleDateString('vi-VN')} - {endDate.toLocaleDateString('vi-VN')}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-white/60">
                                                <Users className="w-4 h-4 text-blue-400" />
                                                Đăng ký theo Đội (3-5 người)
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between text-xs font-bold text-purple-400 group-hover:translate-x-2 transition-transform w-fit">
                                            XEM CHI TIẾT <ArrowRight className="w-4 h-4 ml-1" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20 bg-card border border-dashed border-white/10 rounded-[40px]">
                    <Terminal className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40">Không tìm thấy cuộc thi nào.</p>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}
