"use client";
import React from 'react';
import { MessageSquare, Heart, Share2, Users, Plus, Hash, Image as ImageIcon, Send } from 'lucide-react';

const posts = [
  {
    id: 1,
    author: 'Trần Thị B',
    role: 'Sinh viên',
    content: 'Mọi người ơi, có ai có tài liệu ôn thi môn Cấu trúc dữ liệu và giải thuật không? Mình đang cần gấp bản tóm tắt các thuật toán sắp xếp.',
    time: '2 giờ trước',
    likes: 12,
    comments: 5,
    tags: ['Learning', 'IT'],
  },
  {
    id: 2,
    author: 'Mentor Nguyễn Văn A',
    role: 'Chuyên gia AI',
    content: 'Vừa hoàn thành buổi Workshop về Prompt Engineering. Cảm ơn các bạn đã tham gia rất nhiệt tình! Dưới đây là slide bài giảng cho bạn nào cần.',
    time: '5 giờ trước',
    likes: 45,
    comments: 18,
    tags: ['AI', 'Workshop'],
  },
];

const groups = [
  { id: 1, name: 'Cộng đồng AI Việt Nam', members: '12.5k' },
  { id: 2, name: 'CLB Tình nguyện EduMap', members: '3.2k' },
  { id: 3, name: 'Nhóm ôn thi Bách Khoa', members: '8.1k' },
];

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left: Navigation & Groups */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Nhóm của bạn
            </h2>
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20">
                    <Hash className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{group.name}</p>
                    <p className="text-[10px] text-white/40">{group.members} thành viên</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2 rounded-xl bg-blue-600/20 text-blue-400 text-xs font-bold hover:bg-blue-600/30 transition-colors">
              Khám phá thêm
            </button>
          </div>
        </div>

        {/* Center: Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Create Post */}
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0" />
              <textarea 
                placeholder="Bạn đang nghĩ gì?" 
                className="w-full bg-transparent border-none focus:ring-0 text-sm resize-none h-12"
              />
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/5">
              <div className="flex gap-4">
                <button className="text-white/40 hover:text-white transition-colors"><ImageIcon className="w-5 h-5" /></button>
                <button className="text-white/40 hover:text-white transition-colors"><Hash className="w-5 h-5" /></button>
              </div>
              <button className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20">
                Đăng bài <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Posts List */}
          {posts.map((post) => (
            <div key={post.id} className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-4 hover:border-white/20 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/10" />
                  <div>
                    <h3 className="text-sm font-bold">{post.author}</h3>
                    <p className="text-[10px] text-white/40">{post.role} • {post.time}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {post.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-medium">#{tag}</span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">
                {post.content}
              </p>
              <div className="flex gap-6 pt-4 border-t border-white/5">
                <button className="flex items-center gap-2 text-xs text-white/40 hover:text-red-400 transition-colors">
                  <Heart className="w-4 h-4" /> {post.likes}
                </button>
                <button className="flex items-center gap-2 text-xs text-white/40 hover:text-blue-400 transition-colors">
                  <MessageSquare className="w-4 h-4" /> {post.comments}
                </button>
                <button className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors ml-auto">
                  <Share2 className="w-4 h-4" /> Chia sẻ
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Suggestions & Trending */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/10 backdrop-blur-xl">
            <h2 className="font-bold mb-4">Xu hướng</h2>
            <div className="space-y-4">
              {['#ThucTapSinh', '#AiHackathon', '#GreenEduMap'].map(tag => (
                <div key={tag} className="cursor-pointer group">
                  <p className="text-sm font-medium group-hover:text-blue-400 transition-colors">{tag}</p>
                  <p className="text-[10px] text-white/40">1.2k bài viết</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
