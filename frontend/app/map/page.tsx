"use client";
import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import dynamic from 'next/dynamic';
import { Search, MapPin, Sparkles } from 'lucide-react';

const InteractiveMap = dynamic(() => import('@/components/ui/MapComponent'), { ssr: false });

export default function MapPage() {
  const [points, setPoints] = useState<any[]>([]);
  const [filteredPoints, setFilteredPoints] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);

  // Fetch approved educational points from NestJS backend
  useEffect(() => {
    async function fetchPoints() {
      try {
        const res = await fetch('http://localhost:3000/api/map/points');
        if (res.ok) {
          const data = await res.json();
          setPoints(data.points || []);
          setFilteredPoints(data.points || []);
        }
      } catch (error) {
        console.error("Lỗi fetch map points:", error);
      }
    }
    fetchPoints();
  }, []);

  // Filter and search logic
  useEffect(() => {
    let result = points;

    if (activeFilter !== 'all') {
      result = result.filter(p => String(p.type_id) === activeFilter || String(p.type) === activeFilter);
    }

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    setFilteredPoints(result);
  }, [searchTerm, activeFilter, points]);

  return (
    <div className="flex h-screen bg-background text-white overflow-hidden p-6 gap-6">
      {/* Sidebar */}
      <div className="w-1/3 min-w-[360px] border border-white/10 rounded-3xl p-6 flex flex-col space-y-6 shadow-2xl bg-zinc-900/60 backdrop-blur-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3 h-3 text-blue-500" /> Bản đồ Giáo dục Đồng Nai
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">EduMap Biên Hòa</h2>
          <p className="opacity-60 text-xs mt-1">Tìm thấy {filteredPoints.length} địa điểm học tập và tiện ích giáo dục</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input 
            type="text" 
            placeholder="Tìm trường học, thư viện, lab..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 outline-none focus:border-blue-500 transition-colors placeholder:text-white/20 text-xs" 
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: '1', label: 'Đại Học' },
            { id: '2', label: 'THPT' },
            { id: '3', label: 'Thư Viện' },
            { id: '4', label: 'Nhà Sách' },
            { id: '5', label: 'STEM Lab' },
            { id: '6', label: 'Wifi' },
            { id: '7', label: 'Không Xanh' },
            { id: '8', label: 'Cà Phê' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveFilter(item.id)}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-all ${
                activeFilter === item.id 
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        
        {/* Points List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {filteredPoints.length > 0 ? (
            filteredPoints.map((item) => (
              <div 
                key={item.id} 
                onClick={() => setSelectedPoint(item)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedPoint?.id === item.id 
                    ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/5' 
                    : 'border-white/5 bg-[#16161a] hover:border-white/20'
                }`}
              >
                <h3 className="font-bold text-white text-sm tracking-tight group-hover:text-blue-400">{item.name}</h3>
                <div className="text-[11px] text-white/50 mt-1 flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    {item.district || 'Đồng Nai'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Hoạt động
                  </span>
                </div>
                {item.address && (
                  <p className="text-[10px] text-white/40 mt-2 line-clamp-1">{item.address}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-white/30 text-center py-8">Không tìm thấy địa điểm nào</p>
          )}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 rounded-3xl shadow-2xl border border-white/10 relative overflow-hidden z-0 bg-zinc-950">
        <InteractiveMap 
          points={filteredPoints} 
          selectedPoint={selectedPoint}
          onSelectPoint={setSelectedPoint}
        />
      </div>
    </div>
  );
}

