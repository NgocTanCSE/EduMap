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
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <span className="text-muted-foreground">Đang tải bản đồ…</span>
    </div>
  ),
});


// Icons for facility-type POIs shown in the "selected place" detail card.
const FACILITY_ICONS: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  wifi: { label: 'WiFi', color: 'text-primary', Icon: Wifi },
  library: { label: 'Thư viện', color: 'text-primary', Icon: BookOpen },
  bookstore: { label: 'Nhà sách', color: 'text-destructive', Icon: BookOpen },
  lab: { label: 'Lab', color: 'text-primary', Icon: Atom },
  stem: { label: 'STEM', color: 'text-primary', Icon: Atom },
  green: { label: 'Không gian xanh', color: 'text-accent', Icon: Leaf },
  park: { label: 'Công viên', color: 'text-accent', Icon: Leaf },
  cafe: { label: 'Cà phê', color: 'text-primary', Icon: Coffee },
  restaurant: { label: 'Nhà hàng', color: 'text-primary', Icon: Globe },
  university: { label: 'Trường', color: 'text-accent', Icon: GraduationCap },
  school: { label: 'Trường', color: 'text-accent', Icon: GraduationCap },
};
const facilityIconFor = (cat?: string) => {
  const key = String(cat || '').toLowerCase();
  return FACILITY_ICONS[key] || { label: cat || 'Địa điểm', color: 'text-muted-foreground', Icon: MapPin as React.ComponentType<{ className?: string }> };
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

/** Dropdown of matching locations shown when the user types a search term. */
function SearchResults({
  results,
  onSelect,
}: {
  results: Location[];
  onSelect: (loc: Location) => void;
}) {
  if (results.length === 0) return null;
  return (
    <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg custom-scrollbar">
      {results.map((loc) => (
        <button
          key={loc.id}
          onClick={() => onSelect(loc)}
          className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors first:rounded-t-lg last:rounded-b-lg"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {facilityIconFor(loc.category).Icon && (
              React.createElement(facilityIconFor(loc.category).Icon, { className: "w-4 h-4 text-primary" })
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-foreground truncate">{loc.name}</div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-1">
              {loc.category} · {loc.address || 'Chưa có địa chỉ'}
            </div>
          </div>
        </button>
      ))}
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
                ? 'bg-primary text-foreground shadow'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted border-border'
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
    <div className="fixed inset-y-0 right-0 z-40 w-96 bg-card border-l border-border flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-primary" /> Phân tích khu vực
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {loading ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-3 bg-muted rounded animate-pulse w-5/6" />
            <div className="h-3 bg-muted rounded animate-pulse w-4/6" />
          </div>
        ) : analysis ? (
          <>
            <div className="flex items-center gap-2">
              <ThermometerSun className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Mật độ hoạt động: <b className="text-foreground">{analysis.density_score}</b></span>
            </div>
            {analysis.summary && <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Gợi ý xung quanh bạn</p>
                {analysis.recommendations.map((r: any, i: number) => (
                  <div key={i} className="text-sm text-muted-foreground/70">• {r}</div>
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
  // Current viewport, fed back by MapEvents so the initial load + category
  // switches fetch REAL bounds (not the whole-province DEFAULT_BBOX).
  const [viewport, setViewport] =
    useState<{ minLat: number; maxLat: number; minLng: number; maxLng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
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
      .filter((p) => p.id !== selectedLocation.id)
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
      const accessToken = authService.getAccessToken();
      const res = await fetch('/api/map/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
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
    // Initial viewport fetch is now driven by MapEvents.onReady (real bounds),
    // NOT fetchMapData('all') over DEFAULT_BBOX (whole province) which was slow.
  }, [fetchStats, fetchCategoriesOnce, fetchMapData]);

  // Category change → refetch (bounds empty like initial)
  const handleCategoryChange = (c: string) => {
    setActiveCategory(c);
    setSelectedLocation(null);
    fetchMapData(c === 'all' ? undefined : c, viewport || undefined);
  };

  const handleBoundsChange = useCallback(
    (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => {
      setViewport(bounds); // keep for category switches
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
      const accessToken = authService.getAccessToken();
      const res = await fetch('/api/map/pois', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
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
    <div className="relative h-screen w-full bg-background overflow-hidden">
      {/* Top toolbar — map-specific controls (search + category chips) kept clear of the global w-60 sidebar. The nav rail + account block now come from the global <Sidebar/> (via AppLayout), so /map shares the exact same left chrome as /dashboard. */}
      <div className="absolute top-4 left-0 z-50 flex items-center gap-3 bg-card/95 border border-border rounded-xl px-3 py-2 shadow-lg backdrop-blur-sm">
        <div className="relative">
          <SearchBar value={searchTerm} onChange={setSearchTerm} />
          {searchTerm.trim() && (
            <SearchResults
              results={filteredLocations.slice(0, 8)}
              onSelect={(loc) => { setSelectedLocation(loc); setSearchTerm(''); }}
            />
          )}
        </div>
        <span className="text-[11px] text-muted-foreground/40">{filteredLocations.length} địa điểm</span>
        <div className="w-px h-7 bg-border" />
        <CategoryChips categories={categories} active={activeCategory} onSelect={handleCategoryChange} />
      </div>

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
            className={`p-2 rounded-lg transition-colors ${showHeatmap ? 'bg-primary text-foreground' : 'text-muted-foreground/60 hover:bg-muted/50'}`}
          >
            <Flame className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowAiPanel(true); runAiAnalysis(); }}
            title="Phân tích AI khu vực"
            className={`p-2 rounded-lg transition-colors ${showAiPanel ? 'bg-primary text-foreground' : 'text-muted-foreground/60 hover:bg-muted/50'}`}
          >
            <BrainCircuit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowHeatmap(true)}
            title="Chế độ xem lớp"
            className="p-2 rounded-lg text-muted-foreground/60 hover:bg-muted/50 transition-colors"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            title={fs ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            className="p-2 rounded-lg text-muted-foreground/60 hover:bg-muted/50 transition-colors"
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
          <div className="bg-card border border-border rounded-lg w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Ghim vị trí mới</h3>
              <button
                onClick={() => setPinningCoord(null)}
                className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="text-xs font-medium text-muted-foreground/60 block mb-1">Tên địa điểm</label>
            <input
              type="text"
              value={pinForm.name}
              onChange={(e) => setPinForm({ ...pinForm, name: e.target.value })}
              placeholder="VD: Thư viện ABC"
              className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2 mb-3 outline-none focus:ring-1 focus:ring-primary"
            />

            <label className="text-xs font-medium text-muted-foreground/60 block mb-1">Danh mục</label>
            <select
              value={pinForm.category}
              onChange={(e) => setPinForm({ ...pinForm, category: e.target.value })}
              className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2 mb-3 outline-none focus:ring-1 focus:ring-primary"
            >
              {categoriesLoaded && categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <label className="text-xs font-medium text-muted-foreground/60 block mb-1">Địa chỉ</label>
            <input
              type="text"
              value={pinForm.address}
              onChange={(e) => setPinForm({ ...pinForm, address: e.target.value })}
              placeholder="Số nhà, đường, phường..."
              className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2 mb-3 outline-none focus:ring-1 focus:ring-primary"
            />

            <label className="text-xs font-medium text-muted-foreground/60 block mb-1">Mô tả</label>
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
                className="flex-1 h-10 text-sm font-medium text-muted-foreground/60 hover:bg-muted/50 border border-border rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSavePin}
                disabled={isSavingPin || !pinForm.name}
                className="flex-1 h-10 text-sm font-semibold text-foreground bg-primary rounded-lg hover:bg-primary/80 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
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
        <div className="fixed bottom-6 left-64 z-20 rounded-xl bg-card/90 border border-border px-3 py-2 shadow-lg text-xs text-muted-foreground/60">
          <div className="font-medium text-foreground/60 mb-1 flex items-center gap-1">
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
