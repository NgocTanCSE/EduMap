"use client";
import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Search, MapPin, Sparkles, BrainCircuit, Target, X, Info, Flame, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { authService } from '@/src/services/auth.service';

const InteractiveMap = dynamic(() => import('@/components/ui/MapComponent'), { ssr: false });

export default function MapPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // AI Analysis states
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Pinning states
  const [pinningCoord, setPinningCoord] = useState<{lat: number, lng: number} | null>(null);
  const [pinForm, setPinForm] = useState({ name: '', category: 'school', description: '', address: '' });
  const [isSavingPin, setIsSavingPin] = useState(false);

const [categoriesLoaded, setCategoriesLoaded] = useState(false);

useEffect(() => {
     fetchLocationsOnly();
     fetchCategoriesOnce();
   }, []);

  const fetchCategoriesOnce = async () => {
    if (categoriesLoaded) return;
    try {
      const catRes = await fetch('/api/map/categories');
      const catDataRes = await catRes.json();
      const catData = catDataRes.data || catDataRes;
      setCategories(Array.isArray(catData) ? catData : []);
      setCategoriesLoaded(true);
    } catch (error) {
      logger.error("Failed to fetch categories:", error);
    }
  };

const fetchLocationsOnly = async (bounds?: { minLat: number, maxLat: number, minLng: number, maxLng: number }) => {
    try {
      setLoading(true);
      logger.info('Fetching map data');
      
      let locUrl = '/api/map/locations';
      if (bounds) {
        locUrl += `?minLat=${bounds.minLat}&maxLat=${bounds.maxLat}&minLng=${bounds.minLng}&maxLng=${bounds.maxLng}`;
      }

      const locRes = await fetch(locUrl);
      const locDataRes = await locRes.json();
      const locData = locDataRes.data || locDataRes;
      
      setLocations(Array.isArray(locData) ? locData : []);
      logger.info('Map data loaded successfully');
    } catch (error) {
      logger.error("Error fetching map data:", error);
      toast.error('Failed to load map data');
    } finally {
      setLoading(false);
    }
  };

  const boundsDebounceRef = useRef<NodeJS.Timeout | null>(null);
   
   const handleBoundsChange = (bounds: any) => {
       if (boundsDebounceRef.current) {
         clearTimeout(boundsDebounceRef.current);
       }
       boundsDebounceRef.current = setTimeout(() => {
         fetchLocationsOnly(bounds);
       }, 500);
   };

  const handleMapClick = (lat: number, lng: number) => {
    const user = authService.getUser();
    if (!user) {
        toast.error('Bạn cần đăng nhập để ghim vị trí mới.');
        return;
    }
    setPinningCoord({ lat, lng });
    logger.info(`Map clicked at: ${lat}, ${lng}`);
  };

  const handleSavePin = async () => {
    if (!pinForm.name || !pinningCoord) {
        toast.warning('Vui lòng nhập tên địa điểm.');
        return;
    }

    try {
        setIsSavingPin(true);
        const res = await fetch('/api/map/pois', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...pinForm,
                lat: pinningCoord.lat,
                lng: pinningCoord.lng
            })
        });

if (res.ok) {
             toast.success('Đã ghim vị trí thành công!');
             setPinningCoord(null);
             setPinForm({ name: '', category: 'school', description: '', address: '' });
             fetchLocationsOnly();
         } else {
            const err = await res.json();
            toast.error(err.message || 'Lỗi khi ghim vị trí.');
        }
    } catch (error) {
        toast.error('Lỗi kết nối máy chủ.');
    } finally {
        setIsSavingPin(false);
    }
  };

// Filter logic
  useEffect(() => {
    let result = locations;

    if (activeCategory !== 'all') {
       const catLower = activeCategory.toLowerCase();
       result = result.filter(loc => {
         const locCat = (loc.category || '').toLowerCase();
         if (locCat === catLower) return true;
         if (activeCategory === 'wifi' && (locCat.includes('wifi') || locCat.includes('education'))) return true;
         if (activeCategory === 'green' && (locCat.includes('green') || locCat.includes('park'))) return true;
         return locCat.includes(catLower);
       });
    }

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      result = result.filter(loc => 
        loc.name.toLowerCase().includes(q) || 
        (loc.address && loc.address.toLowerCase().includes(q)) ||
        (loc.description && loc.description.toLowerCase().includes(q))
      );
    }

    setFilteredLocations(result);
  }, [searchTerm, activeCategory, locations]);

  const handleAIAnalysis = async () => {
    try {
        setAnalyzing(true);
        setShowAiPanel(true);
        const res = await fetch('/api/map/ai-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'Biên Hòa' })
        });
        if (!res.ok) throw new Error('Analysis failed');
        const data = await res.json();
        setAiAnalysis(data);
        toast.success('AI Geo-Analysis complete');
    } catch (err) {
        toast.error('AI Analysis failed');
    } finally {
        setAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden p-6 gap-6 relative">
      
      {/* Sidebar */}
      <div className="w-1/3 min-w-[380px] border border-white/10 rounded-[2.5rem] p-8 flex flex-col space-y-6 shadow-2xl bg-zinc-900/60 backdrop-blur-xl z-10">
        <header>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest mb-4">
            <Sparkles className="w-3.5 h-3.5" /> PostGIS + AI Power
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">Geo Education</h2>
          <p className="opacity-50 text-sm mt-1">Discovering {filteredLocations.length} educational assets</p>
        </header>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input 
            type="text" 
            placeholder="Search schools, labs, libraries..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-1 focus:ring-yellow-500 transition-all placeholder:text-white/10 text-sm text-yellow-500" 
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
                setShowHeatmap(!showHeatmap);
                logger.action(`Heatmap toggled: ${!showHeatmap}`);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${showHeatmap ? 'bg-orange-600 border-orange-500 shadow-lg shadow-orange-600/20' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
          >
            <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'animate-pulse' : ''}`} />
            {showHeatmap ? 'Disable Heatmap' : 'Enable Heatmap'}
          </button>
          <div className="w-full h-px bg-white/5 my-2" />
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${activeCategory === 'all' ? 'bg-yellow-600 border-yellow-500 shadow-lg shadow-yellow-600/20' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                  logger.action(`Category filter clicked: ${cat}`);
                  setActiveCategory(cat);
              }}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${activeCategory === cat ? 'bg-yellow-600 border-yellow-500 shadow-lg shadow-yellow-600/20' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
            >
              {cat}
            </button>
          ))}
        </div>
        
        {/* Locations List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-10 text-gray-500 italic">Synchronizing PostGIS data...</div>
          ) : filteredLocations.length > 0 ? (
            filteredLocations.map((item) => (
              <div 
                key={item.id} 
                onClick={() => setSelectedLocation(item)}
                className={`p-5 rounded-[2rem] border transition-all cursor-pointer group ${
                  selectedLocation?.id === item.id 
                    ? 'border-yellow-500/50 bg-yellow-500/10 shadow-lg shadow-yellow-500/5' 
                    : 'border-white/5 bg-black/20 hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-start mb-2 text-yellow-500">
                    <h3 className="font-black text-gray-100 text-base group-hover:text-yellow-400 transition-colors">{item.name}</h3>
                    <span className="text-[9px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                        {item.category}
                    </span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white/40">
                  <MapPin className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />
                  <span className="line-clamp-2 leading-relaxed">{item.address}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 border border-dashed border-white/5 rounded-3xl">
                <p className="text-sm text-white/20">No matching assets found.</p>
            </div>
          )}
        </div>

        <button 
            onClick={handleAIAnalysis}
            disabled={analyzing}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 py-4 rounded-[1.5rem] font-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-purple-500/20 active:scale-[0.98] disabled:opacity-50"
        >
            <BrainCircuit className={analyzing ? "animate-spin" : ""} />
            {analyzing ? "AI Analysis in progress..." : "Gemini Geo-Analysis"}
        </button>
      </div>

      {/* Map Area */}
      <div className="flex-1 rounded-[3rem] shadow-2xl border border-white/10 relative overflow-hidden z-0 bg-zinc-950">
        <InteractiveMap 
          points={filteredLocations} 
          selectedPoint={selectedLocation}
          onSelectPoint={setSelectedLocation}
          onMapClick={handleMapClick}
          showHeatmap={showHeatmap}
          onBoundsChange={handleBoundsChange}
        />
        
        {/* Pinning Modal */}
        {pinningCoord && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                    <div className="p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black text-yellow-500 flex items-center gap-2">
                                <Plus size={24} /> Ghim Vị Trí Mới
                            </h3>
                            <button onClick={() => setPinningCoord(null)} className="text-gray-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tên địa điểm</label>
                                <input 
                                    type="text" 
                                    value={pinForm.name}
                                    onChange={e => setPinForm({...pinForm, name: e.target.value})}
                                    placeholder="VD: Thư viện X, Quán Cafe Y..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-yellow-500 transition-all text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Thể loại</label>
                                <select 
                                    value={pinForm.category}
                                    onChange={e => setPinForm({...pinForm, category: e.target.value})}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-yellow-500 transition-all text-sm"
                                >
                                    {categories.map(cat => <option key={cat} value={cat} className="bg-zinc-900">{cat.toUpperCase()}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Địa chỉ (Tùy chọn)</label>
                                <input 
                                    type="text" 
                                    value={pinForm.address}
                                    onChange={e => setPinForm({...pinForm, address: e.target.value})}
                                    placeholder="Số nhà, Tên đường..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-yellow-500 transition-all text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Mô tả thêm</label>
                                <textarea 
                                    value={pinForm.description}
                                    onChange={e => setPinForm({...pinForm, description: e.target.value})}
                                    placeholder="Nhận xét của bạn về địa điểm này..."
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-yellow-500 transition-all text-sm h-24"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={() => setPinningCoord(null)}
                                className="flex-1 py-4 rounded-2xl border border-white/10 font-bold hover:bg-white/5 transition-all"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={handleSavePin}
                                disabled={isSavingPin}
                                className="flex-1 bg-yellow-600 hover:bg-yellow-700 py-4 rounded-2xl font-black text-white shadow-xl shadow-yellow-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Save size={18} />
                                {isSavingPin ? 'Đang lưu...' : 'Lưu Vị Trí'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* AI Results Overlay Panel */}
        {showAiPanel && (
            <div className="absolute top-8 right-8 w-80 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl z-20 overflow-hidden animate-in slide-in-from-right duration-500">
                <div className="p-6 space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-purple-400 font-black text-sm uppercase">
                            <Target size={18} /> Density Report
                        </div>
                        <button onClick={() => setShowAiPanel(false)} className="text-gray-500 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    {analyzing ? (
                        <div className="space-y-4 py-8">
                            <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto" />
                            <p className="text-center text-xs text-gray-500 font-bold animate-pulse uppercase">AI Processing Layers...</p>
                        </div>
                    ) : aiAnalysis ? (
                        <div className="space-y-6">
                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                                <p className="text-xs text-gray-500 font-black uppercase mb-1">AI Density Score</p>
                                <p className="text-4xl font-black text-green-400">{aiAnalysis.density_score}/10</p>
                            </div>
                            
                            <div className="space-y-2">
                                <h4 className="text-xs font-black text-gray-500 uppercase flex items-center gap-1"><Info size={14}/> Summary</h4>
                                <p className="text-xs text-gray-300 leading-relaxed italic">"{aiAnalysis.summary}"</p>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Recommended Actions</h4>
                                {aiAnalysis.recommendations?.map((rec: any, idx: number) => (
                                    <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-black text-blue-400 uppercase">{rec.area}</p>
                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${rec.priority === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                {rec.priority}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 leading-tight">{rec.reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
