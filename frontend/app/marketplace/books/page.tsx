"use client";
import React from 'react';
import { Book, ShoppingCart, Tag, MapPin, User, Search, Filter, Plus, Heart, MessageSquare } from 'lucide-react';

const books = [
  {
    id: 1,
    title: 'Giải tích 1 - ĐHBK Hà Nội',
    price: '35,000 VNĐ',
    author: 'Nguyễn Đình Trí',
    condition: 'Mới 90%',
    location: 'Quận 10, TP.HCM',
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=400',
    type: 'Mua bán',
  },
  {
    id: 2,
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    price: '0 VNĐ (Tặng)',
    author: 'Robert C. Martin',
    condition: 'Cũ - Có ghi chú',
    location: 'TP. Thủ Đức',
    image: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=400',
    type: 'Tặng',
  },
];

export default function BookMarketplacePage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
           <div>
              <h1 className="text-3xl font-bold mb-2">Chợ Sách EduMap</h1>
              <p className="text-white/40 text-sm">Chia sẻ tri thức, bảo vệ môi trường.</p>
           </div>
           <button className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all">
              <Plus className="w-5 h-5" /> Đăng tin mới
           </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex gap-4 p-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
             <input type="text" placeholder="Tìm kiếm sách, tác giả..." className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-blue-500 transition-colors" />
           </div>
           <div className="flex gap-2">
              <button className="px-4 py-3 rounded-2xl border border-white/10 hover:bg-white/5 transition-colors flex items-center gap-2 text-xs font-medium">
                 <Tag className="w-4 h-4 text-white/40" /> Thể loại
              </button>
              <button className="px-4 py-3 rounded-2xl border border-white/10 hover:bg-white/5 transition-colors flex items-center gap-2 text-xs font-medium">
                 <Filter className="w-4 h-4 text-white/40" /> Lọc
              </button>
           </div>
        </div>

        {/* Books Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           {books.map(book => (
             <div key={book.id} className="group flex flex-col bg-white/5 border border-white/10 rounded-[32px] overflow-hidden hover:border-blue-500/30 transition-all">
                <div className="aspect-[3/4] relative overflow-hidden">
                   <img src={book.image} alt={book.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                   <div className="absolute top-4 left-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border backdrop-blur-md ${book.type === 'Tặng' ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-blue-500/20 border-blue-500/30 text-blue-400'}`}>
                         {book.type}
                      </span>
                   </div>
                   <button className="absolute top-4 right-4 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Heart className="w-4 h-4 text-white" />
                   </button>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                   <h3 className="font-bold text-sm mb-1 truncate">{book.title}</h3>
                   <p className="text-[10px] text-white/40 mb-4">{book.author}</p>
                   
                   <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-[10px] text-white/60">
                         <MapPin className="w-3 h-3 text-white/30" /> {book.location}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/60">
                         <Tag className="w-3 h-3 text-white/30" /> {book.condition}
                      </div>
                   </div>

                   <div className="mt-auto flex justify-between items-center">
                      <p className={`font-mono text-sm font-bold ${book.type === 'Tặng' ? 'text-green-400' : 'text-blue-400'}`}>{book.price}</p>
                      <button className="p-2 rounded-xl bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-all">
                         <MessageSquare className="w-4 h-4" />
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
