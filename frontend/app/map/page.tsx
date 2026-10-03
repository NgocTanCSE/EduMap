'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, MapPin, X, List, ChevronLeft, ChevronRight, ChevronDown, BrainCircuit,
  ThermometerSun, Layers, Save, Info, Flame, LogOut,
  Maximize, Minimize, GraduationCap, Heart, BookOpen, Users, Wifi, Atom,
  Briefcase, Globe, Leaf, Coffee,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { authService } from '@/src/services/auth.service';
import { useAuth } from '@/src/contexts/AuthContext';
import { useRequireAuth } from '@/src/lib/require-auth';
import { EduMapLogo } from '@/components/ui/Logo';

const InteractiveMap = dynamic(() => import('@/components/ui/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-full flex items-center justify-center bg-slate-100">
      <span className="text-slate-500">Đang tải bản đồ…</span>
    </div>
  ),
});

// ---------- Feature tiles shown in the sidebar ----------
const FEATURE_TILES = [
  { name: 'Học bổng', desc: 'Tìm & kiểm tra điều kiện học bổng', href: '/scholarships', icon: GraduationCap, color: 'bg-amber-500' },
  { name: 'Tài trợ / Đối tác', desc: 'Chương trình tài trợ & quyên góp', href: '/donate', icon: Heart, color: 'bg-rose-500' },
  { name: 'Thư viện số', desc: 'Tài liệu, ebook, đề thi', href: '/library', icon: BookOpen, color: 'bg-primary/90' },
  { name: 'Mentor', desc: 'Đặt lịch tư vấn 1-on-1', href: '/mentor', icon: Users, color: 'bg-cyan-500' },
  { name: 'Trạm Wifi', desc: 'Wifi học tập quanh bạn', href: '/wifi', icon: Wifi, color: 'bg-emerald-500' },
  { name: 'STEM Labs', desc: 'Phòng lab & máy tính', href: '/stem', icon: Atom, color: 'bg-emerald-500' },
  { name: 'Thực tập', desc: 'Cơ hộp thực tập sinh', href: '/internships', icon: Briefcase, color: 'bg-primary' },
  { name: 'Cộng đồng', desc: 'Học nhóm, diễn đàn', href: '/community', icon: Globe, color: 'bg-cyan-500' },
];

// Icons for facility-type POIs shown in the "selected place" detail card.
const FACILITY_ICONS: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  wifi: { label: 'WiFi', color: 'text-amber-500', Icon: Wifi },
  library: { label: 'Thư viện', color: 'text-primary', Icon: BookOpen },
  bookstore: { label: 'Nhà sách', color: 'text-red-600', Icon: BookOpen },
  lab: { label: 'Lab', color: 'text-fuchsia-600', Icon: Atom },
  stem: { label: 'STEM', color: 'text-fuchsia-600', Icon: Atom },
  green: { label: 'Không gian xanh', color: 'text-emerald-600', Icon: Leaf },
  park: { label: 'Công viên', color: 'text-emerald-600', Icon: Leaf },
  cafe: { label: 'Cà phê', color: 'text-amber-800', Icon: Coffee },
  restaurant: { label: 'Nhà hàng', color: 'text-primary', Icon: Globe },
  university: { label: 'Trường', color: 'text-blue-700', Icon: GraduationCap },
  school: { label: 'Trường', color: 'text-blue-700', Icon: GraduationCap },
};
const facilityIconFor = (cat?: string) => {
  const key = String(cat || '').toLowerCase();
  return FACILITY_ICONS[key] || { label: cat || 'Địa điểm', color: 'text-slate-500', Icon: MapPin as React.ComponentType<{ className?: string }> };
};

interface Location {
  id: string;
  name: string;
  address?: string;
  description?: string;
  category: string;
  lat: number;
  lng: number;
}

// ---------- Sub-components ----------
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Tìm địa điểm (trường, thư viện, wifi ...)..."
        className={`w-full pl-10 pr-3 py-2 text-sm text-foreground bg-card border rounded-lg outline-none transition-colors placeholder:text-muted-foreground/40 ${focused ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
      />
    </div>
  );
}

function CategoryChips({ categories, active, onSelect }: { categories: string[]; active: string; onSelect: (c: string) => void }) {
  const chips = ['all', ...categories];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => {
        const on = active === c;
        return (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full capitalize transition-all ${
              on
                ? 'bg-primary text-white shadow'
                : 'bg-card text-slate-600 border border-border hover:bg-slate-50'
            }`}
          >
            {c === 'all' ? 'Tất cả' : c}
          </button>
        );
      })}
    </div>
  );
}

function AiPanel({ open, onClose, analysis, loading }: {
  open: boolean; onClose: () => void; analysis: any; loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-card border-l border-border shadow-xl flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-primary" /> Phân tích khu vực
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {loading ? (
          <div className="space-y-2 text-sm text-slate-500">
            <div className="h-4 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 bg-slate-100 rounded animate-pulse w-5/6" />
            <div className="h-3 bg-slate-100 rounded animate-pulse w-4/6" />
          </div>
        ) : analysis ? (
          <>
            <div className="flex items-center gap-2">
              <ThermometerSun className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-medium">Mật độ hoạt động: <b className="text-foreground">{analysis.density_score}</b></span>
            </div>
            {analysis.summary && <p className="text-sm text-slate-600 leading-relaxed">{analysis.summary}</p>}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground/40 uppercase">Gợi ý xung quanh bạn</p>
                {analysis.recommendations.map((r: any, i: number) => (
                  <div key={i} className="text-sm text-slate-700">• {r}</div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground/40">Nhấn "Phân tích AI" trên bản đồ để nhận gợi ý địa điểm học tập quanh Biên Hòa.</p>
        )}
      </div>
    </div>
  );
}

// ---------- Main ----------
export default function MapPage() {
  // Auth guard: chưa đăng nhập → quay về Google login
  const { user } = useRequireAuth('/auth/login');
  const { logout } = useAuth();

  // Map data
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [mapStats, setMapStats] = useState<any>(null);

  // UI
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [featuresOpen, setFeaturesOpen] = useState(true);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);

  // Pin form
  const [pinningCoord, setPinningCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [pinForm, setPinForm] = useState({ name: '', category: 'school', description: '', address: '' });
  const [isSavingPin, setIsSavingPin] = useState(false);

  const [fs, setFs] = useState(false);

  // Nearby facilities of the selected POI (wifi / thư viện / trung tâm …).
  // Computed client-side from the already-loaded `locations` — instant, no extra fetch.
  const NEARBY_LIMIT_M = 1000; // ~1 km radius around the selected pin
  const nearbyPois = useMemo<Location[]>(() => {
    if (!selectedLocation) return [];
    const a = Number(selectedLocation.lat);
    const b = Number(selectedLocation.lng);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000; // earth radius in m
    return locations
      .filter((p) => Number(p.id) !== Number(selectedLocation.id))
      .map((p) => {
        const pa = Number(p.lat);
        const pb = Number(p.lng);
        if (!Number.isFinite(pa) || !Number.isFinite(pb)) return { p, d: Infinity };
        const d =
          Math.acos(
            Math.sin(toRad(a)) * Math.sin(toRad(pa)) +
            Math.cos(toRad(a)) * Math.cos(toRad(pa)) * Math.cos(toRad(pb - b))
          ) * R;
        return { p, d };
      })
      .filter((x) => x.d <= NEARBY_LIMIT_M)
      .sort((x, y) => x.d - y.d)
      .slice(0, 12)
      .map((x) => x.p);
  }, [selectedLocation, locations]);

  // --- Fetch: stats ---
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/map/stats');
      const json = await res.json();
      const data = json.data || json;
      if (data.categories) {
        setCategoryCounts(data.categories);
        setMapStats(data);
      }
    } catch (err) {
      logger.error('Failed to fetch map stats', err);
    }
  }, []);

  // --- Fetch: categories (5-min cache) ---
  const fetchCategoriesOnce = useCallback(async () => {
    const CACHE_KEY = 'map_categories';
    const CACHE_TTL = 5 * 60 * 1000;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setCategories(data);
          setCategoriesLoaded(true);
          return;
        }
      }
      const catRes = await fetch('/api/map/categories');
      const catDataRes = await catRes.json();
      const catData = catDataRes.data || catDataRes;
      const categoriesList = Array.isArray(catData) ? catData : [];
      setCategories(categoriesList);
      setCategoriesLoaded(true);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: categoriesList, timestamp: Date.now() }));
    } catch (error) {
      logger.error('Error fetching categories', error);
    }
  }, []);

  // --- Fetch: POIs by bounds (GET) — UNCHANGED endpoint (/api/map/pois),
  // now backed by the BFF GET handler that proxies to backend GET /map/pois
  // (same query contract: category, minLat/maxLat/minLng/maxLng).
  const fetchMapData = useCallback(
    async (
      category?: string,
      bounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number }
    ) => {
      try {
        setLoading(true);
        logger.info('Fetching map data', { category, bounds });

        let url = '/api/map/pois';
        const params = new URLSearchParams();
        if (category && category !== 'all') params.set('category', category);
        if (bounds) {
          params.set('minLat', String(bounds.minLat));
          params.set('maxLat', String(bounds.maxLat));
          params.set('minLng', String(bounds.minLng));
          params.set('maxLng', String(bounds.maxLng));
        }
        const qs = params.toString();
        if (qs) url += '?' + qs;

        const res = await fetch(url);
        const json = await res.json();
        const data = json.data || json;
        const list = Array.isArray(data) ? data : [];
        setLocations(list);
      } catch (err) {
        logger.error('Error fetching map data', err);
        toast.error('Không tải được dữ liệu bản đồ');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // --- Fetch: AI analysis (POST) — UNCHANGED endpoint + body ---
  const runAiAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAiAnalysis(null);
    try {
      const res = await fetch('/api/map/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Biên Hòa' }),
      });
      const json = await res.json();
      const data = json.data || json;
      setAiAnalysis({
        density_score: data.density_score,
        summary: data.summary,
        recommendations: data.recommendations || [],
      });
    } catch (err) {
      logger.error('AI analysis error', err);
      toast.error('Phân tích AI thất bại');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // Initial loads
  useEffect(() => {
    fetchStats();
    fetchCategoriesOnce();
    fetchMapData('all'); // initial load for default bounds
  }, [fetchStats, fetchCategoriesOnce, fetchMapData]);

  // Category change → refetch (bounds empty like initial)
  const handleCategoryChange = (c: string) => {
    setActiveCategory(c);
    setSelectedLocation(null);
    fetchMapData(c === 'all' ? undefined : c);
  };

  const handleBoundsChange = useCallback(
    (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => {
      fetchMapData(activeCategory === 'all' ? undefined : activeCategory, bounds);
    },
    [fetchMapData, activeCategory]
  );

  const handleMapClick = (lat: number, lng: number) => {
    if (!authService.isLoggedIn()) {
      toast('Vui lòng đăng nhập để ghim vị trí mới', { description: 'Chuyển hướng đến trang đăng nhập Google' });
      return;
    }
    setPinningCoord({ lat, lng });
    setPinForm({ name: '', category: 'school', description: '', address: '' });
  };

  // client-side search filter on the loaded list (no new endpoint)
  const filteredLocations = locations.filter((loc) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      loc.name.toLowerCase().includes(term) ||
      (loc.category || '').toLowerCase().includes(term) ||
      (loc.address || '').toLowerCase().includes(term)
    );
  });

  const handleSelectLocation = (loc: Location) => {
    // `nearbyPois` is derived via useMemo from `locations`; just record the selection.
    setSelectedLocation(loc);
  };

  // --- Pin save (POST /api/map/pois) — UNCHANGED endpoint + body ---
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
          lng: pinningCoord.lng,
        }),
      });
      if (res.ok) {
        toast.success('Đã ghim vị trí thành công!');
        setPinningCoord(null);
        fetchMapData(activeCategory === 'all' ? undefined : activeCategory);
      } else {
        const err = await res.json();
        toast.error(err.message || 'Lỗi khi ghim vị trí.');
      }
    } catch (error) {
      logger.error('Save pin error', error);
      toast.error('Lỗi khi ghim vị trí.');
    } finally {
      setIsSavingPin(false);
    }
  };

  // fullscreen toggle
  const toggleFullscreen = () => {
    if (!fs && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setFs(true);
    } else {
      document.exitFullscreen?.();
      setFs(false);
    }
  };

  // Wait until the auth guard is ready so we don't flash the gate while logged out
  if (!user) return null;

  return (
    <div className="relative h-screen w-full bg-slate-100 overflow-hidden">
      {/* Slim overlay top bar (map is full-screen; no global header on /map) */}
      <div className="fixed top-0 inset-x-0 z-40 flex items-center justify-between h-14 px-4 bg-card/75 backdrop-blur border-b border-border/60 shadow-sm">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
          <EduMapLogo className="h-7 w-7 text-primary" />
          <span>Edu<span className="text-primary">Map</span></span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAiPanel(true)}
            title="Phân tích AI khu vực"
            className="p-1.5 rounded-md text-slate-500 hover:text-primary hover:bg-muted/50 transition-colors"
          >
            <BrainCircuit className="w-4 h-4" />
          </button>
          <img
            src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || 'U')}&background=eee&color=333`}
            alt={user?.fullName || 'user'}
            className="w-8 h-8 rounded-full border-2 border-white shadow object-cover"
          />
          <button
            onClick={logout}
            title="Đăng xuất"
            className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* --- Left collapsible sidebar (ẩn/hiện) --- */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 bg-card border-r border-border shadow-lg transition-transform duration-300 overflow-hidden flex flex-col py-14 ${
          sidebarOpen ? 'translate-x-0 w-80' : '-translate-x-full w-80'
        }`}
      >
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-2 pb-6">
          {/* Search */}
          <div className="mb-4">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />
            <p className="text-[11px] text-muted-foreground/40 mt-1">{filteredLocations.length} địa điểm</p>
          </div>

          {/* Category chips */}
          <div className="mb-4">
            <CategoryChips
              categories={categories}
              active={activeCategory}
              onSelect={handleCategoryChange}
            />
          </div>

          {/* Feature tiles (scholarship / sponsorship / ...) — collapsible */}
          <div className="border-t border-border pt-4">
            <button
              onClick={() => setFeaturesOpen(!featuresOpen)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3"
            >
              <span>Công cụ sinh viên</span>
              {featuresOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {featuresOpen && (
              <div className="grid grid-cols-2 gap-2">
                {FEATURE_TILES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <a
                      key={f.href}
                      href={f.href}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border hover:border-primary hover:bg-muted/50 transition-colors text-center"
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${f.color} text-white`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-[10px] font-medium text-slate-700 leading-tight">{f.name}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Logout */}
        <div className="p-3 border-t border-border">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg py-2 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Sidebar toggle button (ẩn/hiện) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-4 top-20 z-20 flex items-center justify-center w-9 h-9 rounded-lg bg-card border border-border shadow-md hover:bg-slate-50 text-slate-600"
        title={sidebarOpen ? 'Ẩn bảng điều khiển' : 'Hiện bảng điều khiển'}
      >
        {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <List className="w-5 h-5" />}
      </button>

      {/* --- Map (main surface, full-bleed) --- */}
      <main className="absolute inset-0">
        <InteractiveMap
          points={filteredLocations}
          selectedPoint={selectedLocation}
          onSelectPoint={handleSelectLocation}
          onMapClick={handleMapClick}
          showHeatmap={showHeatmap}
          onBoundsChange={handleBoundsChange}
          apiBaseUrl="/api"
          nearbyPoints={nearbyPois}
        />
      </main>

      {/* --- Floating control panel (right) — toggles hiện/ẩn tính năng --- */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-center gap-2">
        <div className="flex flex-col gap-2 rounded-xl bg-card border border-border shadow-lg p-1.5">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            title="Bật/tắt lớp nhiệt độ"
            className={`p-2 rounded-lg transition-colors ${showHeatmap ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Flame className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowAiPanel(true); runAiAnalysis(); }}
            title="Phân tích AI khu vực"
            className={`p-2 rounded-lg transition-colors ${showAiPanel ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <BrainCircuit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowHeatmap(true)}
            title="Chế độ xem lớp"
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            title={fs ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {fs ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* AI Analysis side panel */}
      <AiPanel open={showAiPanel} onClose={() => setShowAiPanel(false)} analysis={aiAnalysis} loading={analyzing} />

      {/* Pin modal */}
      {pinningCoord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-card/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Ghim vị trí mới</h3>
              <button
                onClick={() => setPinningCoord(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="text-xs font-medium text-slate-600 block mb-1">Tên địa điểm</label>
            <input
              type="text"
              value={pinForm.name}
              onChange={(e) => setPinForm({ ...pinForm, name: e.target.value })}
              placeholder="VD: Thư viện ABC"
              className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2 mb-3 outline-none focus:ring-1 focus:ring-primary"
            />

            <label className="text-xs font-medium text-slate-600 block mb-1">Danh mục</label>
            <select
              value={pinForm.category}
              onChange={(e) => setPinForm({ ...pinForm, category: e.target.value })}
              className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2 mb-3 outline-none focus:ring-1 focus:ring-primary"
            >
              {categoriesLoaded && categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <label className="text-xs font-medium text-slate-600 block mb-1">Địa chỉ</label>
            <input
              type="text"
              value={pinForm.address}
              onChange={(e) => setPinForm({ ...pinForm, address: e.target.value })}
              placeholder="Số nhà, đường, phường..."
              className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2 mb-3 outline-none focus:ring-1 focus:ring-primary"
            />

            <label className="text-xs font-medium text-slate-600 block mb-1">Mô tả</label>
            <textarea
              value={pinForm.description}
              onChange={(e) => setPinForm({ ...pinForm, description: e.target.value })}
              placeholder="Mô tả ngắn gọn (giờ mở cửa, tiện ích...)"
              className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2 mb-3 outline-none focus:ring-1 focus:ring-primary"
              rows={3}
            />

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPinningCoord(null)}
                className="flex-1 h-10 text-sm font-medium text-slate-600 hover:bg-slate-100 border border-border rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSavePin}
                disabled={isSavingPin || !pinForm.name}
                className="flex-1 h-10 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {isSavingPin ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.96 7.96 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <Save className="w-4 h-4" />}
                {isSavingPin ? 'Đang lưu...' : 'Lưu địa điểm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map stats legend (subtle) */}
      {mapStats && (
        <div className="fixed bottom-6 left-4 z-20 rounded-xl bg-card/90 border border-border px-3 py-2 shadow-lg text-xs text-slate-600">
          <div className="font-medium text-slate-700 mb-1 flex items-center gap-1">
            <Info className="w-3 h-3" /> Thống kê khu vực
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(categoryCounts).map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="capitalize">{k}</span><b>{v as number}</b></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
