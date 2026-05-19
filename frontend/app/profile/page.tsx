"use client";
import React from 'react';
import { Trophy, Star, Target, Flame, ChevronRight, Award, Shield, Zap } from 'lucide-react';

const badges = [
  { id: 1, name: 'Người Tiên phong', icon: <Zap className="w-6 h-6 text-yellow-400" />, color: 'bg-yellow-400/10', desc: 'Tham gia EduMap từ những ngày đầu' },
  { id: 2, name: 'Đại sứ Sống Xanh', icon: <Shield className="w-6 h-6 text-green-400" />, color: 'bg-green-400/10', desc: 'Hoàn thành 10 thử thách bảo vệ môi trường' },
  { id: 3, name: 'Mạnh thường quân', icon: <Award className="w-6 h-6 text-blue-400" />, color: 'bg-blue-400/10', desc: 'Đóng góp cho 5 chiến dịch cộng đồng' },
];

const leaderboard = [
  { rank: 1, name: 'Lê Ngọc Tân', points: 12540, level: 24 },
  { rank: 2, name: 'Nguyễn Văn A', points: 10200, level: 20 },
  { rank: 3, name: 'Trần Thị B', points: 9800, level: 19 },
];

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: User Info & Level */}
        <div className="lg:col-span-2 space-y-8">
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <Trophy className="w-32 h-32 text-yellow-400" />
            </div>
            
            <div className="flex items-end gap-6 mb-8">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold border-4 border-white/10">
                NT
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1">Lê Ngọc Tân</h1>
                <p className="text-white/50 text-sm">Sinh viên - Đại học Bách Khoa</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium text-white/70">Level 24</span>
                <span className="text-xs text-white/40">12,540 / 15,000 XP</span>
              </div>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div className="h-full w-[80%] bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              </div>
            </div>
          </div>

          {/* Badge Shelf */}
          <div>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              Kệ Huy hiệu
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {badges.map((badge) => (
                <div key={badge.id} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group">
                  <div className={`w-12 h-12 rounded-xl ${badge.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    {badge.icon}
                  </div>
                  <h3 className="font-bold mb-1 text-sm">{badge.name}</h3>
                  <p className="text-xs text-white/40 leading-relaxed">{badge.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Leaderboard & Stats */}
        <div className="space-y-8">
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              Bảng xếp hạng
            </h2>
            <div className="space-y-4">
              {leaderboard.map((user) => (
                <div key={user.rank} className={`flex items-center gap-4 p-3 rounded-2xl transition-colors ${user.rank === 1 ? 'bg-yellow-400/10 border border-yellow-400/20' : 'hover:bg-white/5'}`}>
                  <span className={`text-sm font-bold w-6 ${user.rank === 1 ? 'text-yellow-400' : 'text-white/40'}`}>
                    #{user.rank}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-[10px] text-white/40">Level {user.level}</p>
                  </div>
                  <span className="text-xs font-mono text-white/60">{user.points.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 rounded-xl border border-white/10 text-xs text-white/50 hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
              Xem tất cả <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 rounded-3xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <h2 className="font-bold">Chuỗi học tập (Streak)</h2>
            </div>
            <p className="text-2xl font-bold mb-1">12 Ngày</p>
            <p className="text-xs text-white/50">Bạn đang rất chăm chỉ! Đừng bỏ cuộc nhé.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
