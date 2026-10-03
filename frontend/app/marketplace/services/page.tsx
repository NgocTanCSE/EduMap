"use client";
import React, { useEffect, useState } from 'react';
import { GraduationCap, ShoppingCart, Tag, MapPin, Search, Filter, Star, Clock, Heart } from 'lucide-react';

export default function ServiceMarketplacePage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch('/api/business');
        if (res.ok) {
          const profiles = await res.json();
          const allServices = profiles.flatMap((p: any) => p.services.map((ser: any) => ({
            ...ser,
            businessName: p.name
          })));
          setServices(allServices);
        }
      } catch (error) {
        console.error("Lỗi fetch services:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchServices();
  }, []);

  const addToCart = async (serviceId: string) => {
    try {
      const res = await fetch('/api/business/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: serviceId, itemType: 'service', quantity: 1 })
      });
      if (res.ok) {
        setCartCount(prev => prev + 1);
        alert("Dịch vụ đã được thêm vào giỏ hàng!");
      } else {
        alert("Bạn cần đăng nhập để thực hiện tính năng này.");
      }
    } catch (error) {
      console.error("Lỗi thêm vào giỏ:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
           <div>
              <h1 className="text-3xl font-bold mb-2">Khóa học & Dịch vụ</h1>
              <p className="text-muted-foreground/40 text-sm">Gia sư, tư vấn và các khóa đào tạo kỹ năng chuyên sâu.</p>
           </div>
           <div className="flex gap-4">
              <button className="relative p-3 rounded-2xl bg-card border border-border hover:bg-zinc-800 transition-all">
                <ShoppingCart className="w-6 h-6 text-primary" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {cartCount}
                  </span>
                )}
              </button>
           </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex gap-4 p-4 rounded-3xl bg-card border border-border">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/30" />
             <input type="text" placeholder="Tìm kiếm gia sư, khóa học..." className="w-full bg-card border border-border rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-primary transition-colors text-primary" />
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

        {/* Services Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-80 bg-card animate-pulse rounded-xl border border-border" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map(service => (
              <div key={service.id} className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-all">
                  <div className="aspect-video relative overflow-hidden bg-card flex items-center justify-center">
                    <GraduationCap className="w-20 h-20 text-muted-foreground/10 group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-primary/20 border-primary/30 text-blue-400">
                          {service.category || 'Dịch vụ'}
                        </span>
                    </div>
                    <button className="absolute top-4 right-4 p-2 rounded-full bg-card/40 border border-border opacity-0 group-hover:opacity-100 transition-opacity">
                        <Heart className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-sm line-clamp-2">{service.name}</h3>
                      <div className="flex items-center gap-1 text-[10px] text-primary">
                        <Star className="w-3 h-3 fill-primary" /> 5.0
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 mb-4">{service.businessName}</p>
                    
                    <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                          <Clock className="w-3 h-3 text-muted-foreground/30" /> {service.duration || 'Liên hệ'}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                          <MapPin className="w-3 h-3 text-muted-foreground/30" /> {service.location || 'Online'}
                        </div>
                    </div>

                    <div className="mt-auto flex justify-between items-center">
                        <p className="font-mono text-sm font-bold text-blue-400">
                          {Number(service.price).toLocaleString()}đ
                        </p>
                        <button 
                          onClick={() => addToCart(service.id)}
                          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary text-white text-[10px] font-bold transition-all"
                        >
                          Đăng ký ngay
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
