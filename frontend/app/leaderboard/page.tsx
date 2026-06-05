"use client";
import React, { useEffect, useState } from 'react';
import { 
  Trophy, Medal, Crown, Star, 
  TrendingUp, Users, Loader2, Target, Award
} from 'lucide-react';
import { gamificationService, LeaderboardUser, UserProgress } from '@/src/services/gamification.service';
import { authService } from '@/src/services/auth.service';
import { toast } from 'sonner';

export default function LeaderboardPage() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  
  const currentUser = authService.getUser();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [leaderboardData, myProgress] = await Promise.all([
        gamificationService.getLeaderboard(),
        authService.isLoggedIn() ? gamificationService.getMyProgress() : Promise.resolve(null)
      ]);
      
      setUsers(leaderboardData);
      setProgress(myProgress);
    } catch (error: any) {
      toast.error('Không thể tải dữ liệu bảng xếp hạng');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  const topThree = users.slice(0, 3);
  const others = users.slice(3);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs font-bold uppercase tracking-widest">
            <Trophy className="w-4 h-4" /> Bảng xếp hạng EduMap
          </div>
          <h1 className="text-5xl font-black tracking-tight">Vinh danh những nỗ lực</h1>
          <p className="text-white/40 max-w-2xl mx-auto">
            Càng học tập, quyên góp và tham gia hoạt động cộng đồng, thứ hạng của bạn càng cao.
            Hãy cùng nhau xây dựng cộng đồng học tập tích cực!
          </p>
        </div>

        {/* My Progress Card (If logged in) */}
        {progress && (
          <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-white/10 rounded-[40px] p-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl">
            <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-yellow-500/30 flex items-center justify-center bg-black/40">
                    <span className="text-3xl font-black text-yellow-500">{progress.level}</span>
                </div>
                <div className="absolute -bottom-2 -right-2 bg-yellow-600 rounded-lg px-2 py-1 text-[10px] font-black text-white">LEVEL</div>
            </div>
            
            <div className="flex-1 space-y-4 w-full text-center md:text-left">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-xl font-bold">Thứ hạng của bạn</h2>
                        <p className="text-white/40 text-xs">Bạn còn thiếu {progress.points_needed.toLocaleString()} XP để lên cấp {progress.level + 1}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-black text-white">{progress.points.toLocaleString()}</span>
                        <span className="text-xs text-white/40 font-bold ml-1">XP</span>
                    </div>
                </div>
                
                <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 p-0.5">
                    <div 
                        className="h-full bg-gradient-to-r from-yellow-600 via-purple-600 to-blue-600 rounded-full transition-all duration-1000" 
                        style={{ width: `${progress.progress_percent}%` }}
                    />
                </div>
                
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
                    <span>Cấp độ {progress.level}</span>
                    <span className="text-yellow-500">{progress.progress_percent}% hoàn thành</span>
                    <span>Cấp độ {progress.level + 1}</span>
                </div>
            </div>
          </div>
        )}

        {/* Podium (Top 3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end max-w-4xl mx-auto pt-12">
            {/* 2nd Place */}
            {topThree[1] && (
                <div className="order-2 md:order-1 space-y-4 text-center pb-8">
                    <div className="relative inline-block">
                        <div className="w-24 h-24 rounded-full border-4 border-slate-400 overflow-hidden bg-zinc-800">
                            <img src={topThree[1].avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topThree[1].full_name)}&background=random`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-400 text-white rounded-full p-2">
                            <Medal className="w-5 h-5" />
                        </div>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-400 text-black font-black px-3 py-1 rounded-lg text-sm">#2</div>
                    </div>
                    <div>
                        <p className="font-bold">{topThree[1].full_name}</p>
                        <p className="text-xs text-white/40">Level {topThree[1].level} • {topThree[1].points.toLocaleString()} XP</p>
                    </div>
                </div>
            )}

            {/* 1st Place */}
            {topThree[0] && (
                <div className="order-1 md:order-2 space-y-6 text-center">
                    <div className="relative inline-block">
                        <div className="w-32 h-32 rounded-full border-4 border-yellow-500 overflow-hidden bg-zinc-800 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
                            <img src={topThree[0].avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topThree[0].full_name)}&background=random`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-500 animate-bounce">
                            <Crown className="w-10 h-10 fill-yellow-500" />
                        </div>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-black px-4 py-1.5 rounded-lg text-base">#1</div>
                    </div>
                    <div>
                        <p className="text-xl font-black text-yellow-500">{topThree[0].full_name}</p>
                        <p className="text-sm text-white/40">Level {topThree[0].level} • {topThree[0].points.toLocaleString()} XP</p>
                    </div>
                </div>
            )}

            {/* 3rd Place */}
            {topThree[2] && (
                <div className="order-3 space-y-4 text-center pb-4">
                    <div className="relative inline-block">
                        <div className="w-20 h-20 rounded-full border-4 border-amber-700 overflow-hidden bg-zinc-800">
                            <img src={topThree[2].avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(topThree[2].full_name)}&background=random`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-700 text-white rounded-full p-2">
                            <Medal className="w-4 h-4" />
                        </div>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-700 text-white font-black px-3 py-1 rounded-lg text-xs">#3</div>
                    </div>
                    <div>
                        <p className="font-bold">{topThree[2].full_name}</p>
                        <p className="text-xs text-white/40">Level {topThree[2].level} • {topThree[2].points.toLocaleString()} XP</p>
                    </div>
                </div>
            )}
        </div>

        {/* Others List */}
        <div className="bg-card border border-white/5 rounded-[40px] overflow-hidden shadow-2xl max-w-4xl mx-auto">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <span className="text-xs font-black uppercase tracking-widest text-white/40">Bảng xếp hạng chi tiết</span>
                <span className="text-xs font-bold text-yellow-500 flex items-center gap-2"><Users className="w-4 h-4" /> {users.length} Thành viên</span>
            </div>
            <div className="divide-y divide-white/5">
                {others.map((user, index) => (
                    <div key={user.id} className={`flex items-center gap-4 p-5 transition-all hover:bg-white/5 group ${user.id === currentUser?.id ? 'bg-yellow-500/5' : ''}`}>
                        <div className="w-8 text-center font-mono font-bold text-white/20 group-hover:text-white/60">
                            {index + 4}
                        </div>
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                            <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=random`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                            <p className={`font-bold text-sm ${user.id === currentUser?.id ? 'text-yellow-500' : ''}`}>
                                {user.full_name} {user.id === currentUser?.id && '(Bạn)'}
                            </p>
                            <p className="text-[10px] text-white/40 uppercase font-black">Cấp độ {user.level}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-mono font-bold text-sm">{user.points.toLocaleString()}</p>
                            <p className="text-[10px] text-white/40 uppercase font-black">XP</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
}
