"use client";
import React, { useState } from 'react';
import { Search, Star, Calendar, MessageSquare, Video, Filter, UserCheck, ChevronRight, Clock, Award } from 'lucide-react';

const mentors = [
  {
    id: 1,
    name: 'Nguyễn Văn A',
    title: 'Senior AI Engineer @ Google',
    specialty: 'Artificial Intelligence',
    rating: 4.9,
    reviews: 124,
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=400',
    available: true,
    skills: ['Python', 'TensorFlow', 'LLMs'],
  },
  {
    id: 2,
    name: 'Trần Thị B',
    title: 'Product Manager @ VinGroup',
    specialty: 'Product Management',
    rating: 4.8,
    reviews: 86,
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=400',
    available: false,
    skills: ['Agile', 'Scrum', 'Data Driven'],
  },
];

export default function MentorPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Kết nối Mentor</h1>
            <p className="text-white/40 text-sm">Học hỏi từ những chuyên gia hàng đầu trong ngành.</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input 
              type="text" 
              placeholder="Tìm kiếm chuyên gia, kỹ năng..." 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-blue-500 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {['Tất cả', 'AI / ML', 'Backend', 'Product Management', 'Data Science', 'Design'].map(cat => (
            <button key={cat} className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-medium hover:bg-white/10 transition-colors whitespace-nowrap">
              {cat}
            </button>
          ))}
          <button className="px-6 py-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-600/30 text-xs font-bold flex items-center gap-2 ml-auto">
            <Filter className="w-4 h-4" /> Lọc nâng cao
          </button>
        </div>

        {/* Mentors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mentors.map(mentor => (
            <div key={mentor.id} className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group">
              <div className="flex gap-6">
                <div className="relative">
                  <img src={mentor.image} alt="" className="w-24 h-24 rounded-2xl object-cover" />
                  {mentor.available && (
                    <div className="absolute -bottom-2 -right-2 p-1 bg-[#050505] rounded-full">
                      <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-[#050505] animate-pulse" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-xl font-bold">{mentor.name}</h3>
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-bold">{mentor.rating}</span>
                    </div>
                  </div>
                  <p className="text-blue-400 text-sm mb-4">{mentor.title}</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {mentor.skills.map(skill => (
                      <span key={skill} className="px-2 py-1 rounded-md bg-white/5 text-[10px] text-white/50">{skill}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <button className="py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Nhắn tin
                </button>
                <button className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                  <Calendar className="w-4 h-4" /> Đặt lịch hẹn
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] text-white/40">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1"><Award className="w-3 h-3" /> {mentor.reviews} đánh giá</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 45 phút / buổi</span>
                </div>
                <button className="text-white hover:text-blue-400 transition-colors flex items-center gap-1">
                  Xem chi tiết <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Promo Section */}
        <div className="p-12 rounded-[40px] bg-gradient-to-br from-blue-600 to-purple-700 relative overflow-hidden">
          <div className="relative z-10 max-w-lg">
            <h2 className="text-4xl font-bold mb-4 leading-tight">Trở thành Mentor của EduMap?</h2>
            <p className="text-white/80 mb-8 leading-relaxed">
              Chia sẻ kiến thức của bạn, giúp đỡ thế hệ trẻ và xây dựng thương hiệu cá nhân trong cộng đồng giáo dục lớn nhất Việt Nam.
            </p>
            <button className="px-8 py-4 rounded-2xl bg-white text-blue-600 font-bold hover:bg-blue-50 transition-colors flex items-center gap-2">
              <UserCheck className="w-5 h-5" /> Đăng ký Mentor ngay
            </button>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-20">
            <Video className="w-64 h-64" />
          </div>
        </div>

      </div>
    </div>
  );
}
