"use client";
import React, { useEffect, useState } from 'react';
import { ShoppingBag, ShoppingCart, Tag, MapPin, Search, Filter, Plus, Heart, MessageSquare, Star } from 'lucide-react';

export default function ProductMarketplacePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch('/api/business'); // Get all business profiles
        if (res.ok) {
          const profiles = await res.json();
          const allProducts = profiles.flatMap((p: any) => p.products.map((prod: any) => ({
            ...prod,
            businessName: p.name
          })));
          setProducts(allProducts);
        }
      } catch (error) {
        console.error("Lỗi fetch products:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const addToCart = async (productId: string) => {
    try {
      const res = await fetch('/api/business/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: productId, itemType: 'product', quantity: 1 })
      });
      if (res.ok) {
        setCartCount(prev => prev + 1);
        alert("Đã thêm vào giỏ hàng!");
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
              <h1 className="text-3xl font-bold mb-2">Văn phòng phẩm & Thiết bị</h1>
              <p className="text-white/40 text-sm">Dụng cụ học tập chất lượng từ các đối tác tin cậy.</p>
           </div>
           <div className="flex gap-4">
              <button className="relative p-3 rounded-2xl bg-zinc-900 border border-white/10 hover:bg-zinc-800 transition-all">
                <ShoppingCart className="w-6 h-6 text-yellow-500" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {cartCount}
                  </span>
                )}
              </button>
           </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex gap-4 p-4 rounded-3xl bg-card border border-white/10">
           <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
             <input type="text" placeholder="Tìm kiếm dụng cụ, thiết bị..." className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-yellow-500 transition-colors text-yellow-500" />
           </div>
           <div className="flex gap-2">
              <button className="px-4 py-3 rounded-2xl border border-white/10 hover:bg-card transition-colors flex items-center gap-2 text-xs font-medium">
                 <Tag className="w-4 h-4 text-white/40" /> Thể loại
              </button>
              <button className="px-4 py-3 rounded-2xl border border-white/10 hover:bg-card transition-colors flex items-center gap-2 text-xs font-medium">
                 <Filter className="w-4 h-4 text-white/40" /> Lọc
              </button>
           </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-80 bg-card animate-pulse rounded-[32px] border border-white/10" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map(product => (
              <div key={product.id} className="group flex flex-col bg-card border border-white/10 rounded-[32px] overflow-hidden hover:border-yellow-500/30 transition-all">
                  <div className="aspect-square relative overflow-hidden bg-zinc-900 flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                      <ShoppingBag className="w-20 h-20 text-white/10 group-hover:scale-110 transition-transform duration-700" />
                    )}
                    <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-yellow-500/20 border-yellow-500/30 text-yellow-400">
                          {product.category || 'Dụng cụ'}
                        </span>
                    </div>
                    <button className="absolute top-4 right-4 p-2 rounded-full bg-black/40 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Heart className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-sm line-clamp-2">{product.name}</h3>
                      <div className="flex items-center gap-1 text-[10px] text-yellow-500">
                        <Star className="w-3 h-3 fill-yellow-500" /> 4.8
                      </div>
                    </div>
                    <p className="text-[10px] text-white/40 mb-4">{product.businessName}</p>
                    
                    <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-[10px] text-white/60">
                          <Tag className="w-3 h-3 text-white/30" /> {product.description?.substring(0, 40)}...
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-white/60">
                          <ShoppingCart className="w-3 h-3 text-white/30" /> Còn {product.stock} sản phẩm
                        </div>
                    </div>

                    <div className="mt-auto flex justify-between items-center">
                        <p className="font-mono text-sm font-bold text-yellow-400">
                          {Number(product.price).toLocaleString()}đ
                        </p>
                        <button 
                          onClick={() => addToCart(product.id)}
                          className="px-4 py-2 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-bold transition-all"
                        >
                          Thêm vào giỏ
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
