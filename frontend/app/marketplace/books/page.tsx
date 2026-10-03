"use client";
import React, { useEffect, useState } from 'react';
import { Book, ShoppingCart, Tag, MapPin, User, Search, Filter, Plus, Heart, MessageSquare } from 'lucide-react';

export default function BookMarketplacePage() {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBooks() {
      try {
        const res = await fetch('/api/share/items?category=book');
        if (res.ok) {
          const data = await res.json();
          setBooks(data);
        }
      } catch (error) {
        console.error("Lỗi fetch books:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBooks();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
           <div>
              <h1 className="text-3xl font-bold mb-2">Chợ Sách EduMap</h1>
              <p className="text-muted-foreground/40 text-sm">Chia sẻ tri thức, bảo vệ môi trường.</p>
           </div>
           <button className="px-6 py-3 rounded-2xl bg-primary hover:bg-primary/80 text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all">
              <Plus className="w-5 h-5" /> Đăng tin mới
           </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex gap-4 p-4 rounded-3xl bg-card border border-border">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30" />
             <input type="text" placeholder="Tìm kiếm sách, tác giả..." className="w-full bg-card border border-border rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-primary transition-colors text-primary" />
           </div>
           <div className="flex gap-2">
              <button className="px-4 py-3 rounded-2xl border border-border hover:bg-card transition-colors flex items-center gap-2 text-xs font-medium">
                 <Tag className="w-4 h-4 text-muted-foreground/40" /> Thể loại
              </button>
              <button className="px-4 py-3 rounded-2xl border border-border hover:bg-card transition-colors flex items-center gap-2 text-xs font-medium">
                 <Filter className="w-4 h-4 text-muted-foreground/40" /> Lọc
              </button>
           </div>
        </div>

        {/* Books Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-80 bg-card animate-pulse rounded-xl border border-border" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {books.map(book => (
              <div key={book.id} className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all">
                  <div className="aspect-[3/4] relative overflow-hidden bg-card flex items-center justify-center">
                    <Book className="w-20 h-20 text-muted-foreground/10 group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute top-4 left-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${book.status === 'Tặng' ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-primary/20 border-primary/30 text-primary/70'}`}>
                          {book.status}
                        </span>
                    </div>
                    <button className="absolute top-4 right-4 p-2 rounded-full bg-card/40 border border-border opacity-0 group-hover:opacity-100 transition-opacity">
                        <Heart className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-sm mb-1 line-clamp-2">{book.name}</h3>
                    <p className="text-[10px] text-muted-foreground/40 mb-4">Sách từ cộng đồng</p>
                    
                    <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                          <MapPin className="w-3 h-3 text-muted-foreground/30" /> Biên Hòa, Đồng Nai
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                          <Tag className="w-3 h-3 text-muted-foreground/30" /> {book.description.substring(0, 50)}...
                        </div>
                    </div>

                    <div className="mt-auto flex justify-between items-center">
                        <p className={`font-mono text-sm font-bold ${book.status === 'Tặng' ? 'text-green-400' : 'text-primary/70'}`}>
                          {book.status === 'Tặng' ? 'MIỄN PHÍ' : 'Trao đổi'}
                        </p>
                        <button className="p-2 rounded-xl bg-primary/10 text-primary/70 hover:bg-primary hover:text-white transition-all">
                          <MessageSquare className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
