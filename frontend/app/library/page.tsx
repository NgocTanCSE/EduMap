"use client";
import React, { useState } from 'react';
import { 
  Search, Filter, Book, Video, FileText, 
  Download, ExternalLink, Bookmark, Sparkles,
  ArrowRight, Star
} from 'lucide-react';

const CATEGORIES = ["Tất cả", "Lập trình", "Kỹ năng mềm", "Ngoại ngữ", "Kinh tế"];
const RESOURCES = [
  { id: 1, title: "Lập trình Backend với NestJS", type: "Book", author: "EduMap Team", rating: 4.8, img: "bg-blue-600/20" },
  { id: 2, title: "Tư duy thiết kế hệ thống", type: "Video", author: "Alex Nguyen", rating: 4.9, img: "bg-purple-600/20" },
  { id: 3, title: "English for IT Professionals", type: "Article", author: "British Council", rating: 4.5, img: "bg-green-600/20" },
  { id: 4, title: "Docker & Kubernetes Cơ bản", type: "Book", author: "Cloud Expert", rating: 4.7, img: "bg-yellow-600/20" },
];

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState("Tất cả");

  return (
    <div className="min-h-screen bg-background text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold mb-2">Thư viện học liệu</h1>
            <p className="text-gray-500 font-medium">Khám phá hàng ngàn tài liệu chất lượng cao từ AI</p>
          </div>
          <div className="flex gap-3">
            <button className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-white/10 transition-all">
              <Bookmark className="w-4 h-4" /> Đã lưu
            </button>
            <button className="bg-blue-600 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
              <Download className="w-4 h-4" /> Tải app desktop
            </button>
          </div>
        </div>

        {/* AI Search Bar */}
        <div className="relative mb-12 group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000"></div>
          <div className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl p-2 flex items-center gap-2 shadow-2xl">
            <div className="pl-4 pr-2"><Sparkles className="w-6 h-6 text-blue-500" /></div>
            <input 
              type="text" 
              placeholder="Bạn muốn tìm tài liệu gì? Ví dụ: 'Tài liệu học code cho người mới bắt đầu'..."
              className="flex-1 bg-transparent py-4 text-lg focus:outline-none placeholder:text-gray-600"
            />
            <button className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2">
              Tìm kiếm AI <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="bg-white/5 p-1 rounded-xl flex items-center gap-1">
            {CATEGORIES.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === cat ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button className="ml-auto bg-white/5 border border-white/10 p-2.5 rounded-xl hover:bg-white/10 transition-all">
            <Filter className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {RESOURCES.map(res => (
            <div key={res.id} className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-blue-600/50 transition-all group cursor-pointer">
              <div className={`h-48 ${res.img} flex items-center justify-center relative overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent opacity-60"></div>
                {res.type === "Book" && <Book className="w-16 h-16 text-white/20 group-hover:scale-110 transition-transform duration-500" />}
                {res.type === "Video" && <Video className="w-16 h-16 text-white/20 group-hover:scale-110 transition-transform duration-500" />}
                {res.type === "Article" && <FileText className="w-16 h-16 text-white/20 group-hover:scale-110 transition-transform duration-500" />}
                <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{res.type}</div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-1 text-amber-500 text-xs font-bold mb-3 bg-amber-500/10 px-2 py-0.5 rounded-full w-max border border-amber-500/20">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {res.rating}
                </div>
                <h3 className="font-bold text-lg mb-1 group-hover:text-blue-500 transition-colors line-clamp-2">{res.title}</h3>
                <p className="text-gray-500 text-sm mb-4">Tác giả: {res.author}</p>
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <button className="text-blue-500 text-xs font-bold hover:underline flex items-center gap-1">
                    Xem ngay <ExternalLink className="w-3 h-3" />
                  </button>
                  <button className="text-gray-500 hover:text-white transition-colors">
                    <Bookmark className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
