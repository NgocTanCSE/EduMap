"use client";
import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin, Navigation, Wifi, Star, Clock, Users, Filter, Wind,
  Search, Loader2, SlidersHorizontal, Info, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import {
  learningSpaceService,
  RecommendParams,
  RecommendResponse,
  ScoredSpot,
} from '@/src/services/learning-space.service';

const InteractiveMap = dynamic(() => import('@/components/ui/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-background">
      <span className="text-muted-foreground">Đang tải bản đồ…</span>
    </div>
  ),
});

const DEFAULT_CENTER = [10.957, 106.843] as [number, number]; // Viễn Đông, TP.HCM

function QuietnessBadge({ q }: { q: number | null | undefined }) {
  const label = q ? `${q}/5` : '—';
  const color =
    q && q >= 4 ? 'text-accent'
    : q && q >= 3 ? 'text-primary'
    : 'text-destructive';
  return (
    <div className={`flex items-center gap-1 text-xs ${color}`}>
      <Wind className="w-3 h-3" />
      <span>{label}</span>
    </div>
  );
}

function RatingBadge({ r }: { r: number }) {
  return (
    <div className="flex items-center gap-1 text-xs text-primary">
      <Star className="w-3 h-3 fill-current" />
      <span>{r.toFixed(1)}</span>
    </div>
  );
}

function ExplainBadge({ spot }: { spot: ScoredSpot }) {
  if (spot.explanation) {
    return (
      <div
        className="relative group cursor-help"
        title={spot.explanation}
      >
        <Info className="w-4 h-4 text-accent/60 hover:text-accent transition-colors" />
      </div>
    );
  }
  return <Info className="w-4 h-4 text-muted-foreground/60" />;
}

function SpotCard({ spot, onExplain }: { spot: ScoredSpot; onExplain: (spot: ScoredSpot) => void }) {
  const { spot: s, score, distance_km, open_now, matching_criteria } = spot;
  const latLng = learningSpaceService.extractLatLng(s.location);

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:bg-card/80 transition-colors">
      <div className="absolute top-2 right-2 z-20">
        <BookmarkButton targetType="learning_space" targetId={s.id} size="sm" />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground">{s.name}</h3>
            <RatingBadge r={s.rating_avg || 0} />
            <QuietnessBadge q={s.quietness} />
          </div>
          {s.address && <p className="text-xs text-muted-foreground/60 mt-1">{s.address}</p>}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground/65">
            <span className="flex items-center gap-1">
              <Navigation className="w-3 h-3" /> {distance_km.toFixed(2)} km
            </span>
            {s.has_wifi && (
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3" /> WiFi
              </span>
            )}
            {s.total_capacity && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {s.total_capacity} chỗ
              </span>
            )}
          </div>
          {s.amenities?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {s.amenities.map((a: string) => (
                <span
                  key={a}
                  className="text-[10px] bg-muted/30 text-muted-foreground/70 px-2 py-0.5 rounded-full"
                >
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="text-right">
            <div className="text-xl font-bold text-accent">{Math.round(score)}</div>
            <div className="text-[10px] text-muted-foreground/65">điểm</div>
          </div>
          <button
            onClick={() => onExplain(spot)}
            className="p-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-xs"
            title="Giải thích lý do đề xuất"
          >
            <Info className="w-3 h-3" />
          </button>
          {!open_now && (
            <span className="text-[9px] text-destructive font-medium">Đóng cửa</span>
          )}
        </div>
      </div>

      {/* Matching criteria mini-bars */}
      <div className="grid grid-cols-5 gap-2 mt-3">
        {Object.entries(matching_criteria).map(([k, v]: [string, number]) => (
          <div key={k} className="flex flex-col items-center">
            <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${Math.round(v * 100)}%` }}
              />
            </div>
            <span className="text-[8px] text-muted-foreground/65 capitalize mt-0.5">{k.slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LearningSpacesPage() {
  const [spots, setSpots] = useState<ScoredSpot[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [filters, setFilters] = useState<RecommendParams>({
    lat: DEFAULT_CENTER[0],
    lng: DEFAULT_CENTER[1],
    radius: 5000,
    has_wifi: true,
    min_rating: 0,
    quietness_min: 1,
    open_now: false,
    limit: 20,
  });

  const fetchSpots = async () => {
    setLoading(true);
    try {
      const data = await learningSpaceService.recommendSpots(filters);
      setSpots(data.spots || []);
      setTotal(data.total || 0);
      setDegraded(!!data.degraded);
    } catch (error: any) {
      toast.error('Không thể tải danh sách địa điểm học tập');
      setDegraded(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGetMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt không hỗ trợ định vị');
      return;
    }
    toast.loading('Đang lấy vị trí...', { id: 'gps' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setFilters((f) => ({ ...f, lat: latitude, lng: longitude }));
        toast.success('Đã lấy vị trí', { id: 'gps' });
      },
      () => {
        toast.error('Không thể lấy vị trí', { id: 'gps' });
      },
    );
  };

  const handleExplain = async (spot: ScoredSpot) => {
    const explanation = spot.explanation;
    if (explanation && explanation.length > 0) {
      toast.info(explanation, { duration: 8000 });
      return;
    }
    try {
      const res = await learningSpaceService.explainSpot(spot, filters);
      if (res.explanation) {
        toast.info(res.explanation, { duration: 8000 });
      }
    } catch {
      toast.error('Không thể lấy giải thích');
    }
  };

  // Convert scored spots into map point objects
  const mapPoints = useMemo(() => {
    return spots.map((entry) => {
      const p = entry.spot;
      const latLng = learningSpaceService.extractLatLng(p.location);
      return {
        id: p.id,
        name: p.name,
        category: p.type || 'library',
        lat: latLng?.[0] ?? filters.lat,
        lng: latLng?.[1] ?? filters.lng,
        address: p.address,
        description: `${p.description || ''} (Điểm: ${Math.round(entry.score)})`,
        rating: p.rating_avg,
        amenities: p.amenities?.map((a) => ({ icon: a, label: a })) || [],
        score: entry.score,
        distance_km: entry.distance_km,
      };
    });
  }, [spots, filters]);

  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [filters.lat, filters.lng];

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MapPin className="w-7 h-7 text-accent" />
              AI Gợi đề xuất nơi học
            </h1>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Tìm không gian học tập phù hợp theo khoảng cách, giờ mở cửa,
              Wi-Fi và độ yên tĩnh — được giải thích bởi AI.
            </p>
          </div>
          <button
            onClick={handleGetMyLocation}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-xl font-bold flex items-center gap-2 hover:bg-accent/80 transition-colors shadow-lg shadow-accent/20"
          >
            <Navigation className="w-4 h-4" />
            Vị trí của tôi
          </button>
        </div>

        {/* Degraded banner */}
        {degraded && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-xl text-xs text-primary flex items-center gap-2">
            <Info className="w-4 h-4" />
            Một số giải thích từ AI không khả dụng — hiển thị dữ liệu gốc.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filter Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground/60 mb-4 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" /> Bộ lọc
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Bán kính (m)
                  </label>
                  <input
                    type="range"
                    min={500}
                    max={20000}
                    step={500}
                    value={filters.radius}
                    onChange={(e) => setFilters({ ...filters, radius: Number(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/65">
                    <span>500m</span>
                    <span>{filters.radius! / 1000}km</span>
                    <span>20km</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="wifi"
                    checked={!!filters.has_wifi}
                    onChange={(e) => setFilters({ ...filters, has_wifi: e.target.checked })}
                  />
                  <label htmlFor="wifi" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Wifi className="w-4 h-4" /> WiFi
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Điểm tối thiểu
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.5}
                    value={filters.min_rating}
                    onChange={(e) => setFilters({ ...filters, min_rating: Number(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground/65 mt-0.5">
                    ≥ {filters.min_rating}/5
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Độ yên tĩnh tối thiểu
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={filters.quietness_min}
                    onChange={(e) => setFilters({ ...filters, quietness_min: Number(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground/65 mt-0.5">
                    ≥ {filters.quietness_min}/5
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="open_now"
                    checked={!!filters.open_now}
                    onChange={(e) => setFilters({ ...filters, open_now: e.target.checked })}
                  />
                  <label htmlFor="open_now" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Clock className="w-4 h-4" /> Đang mở cửa
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Số kết quả
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={filters.limit}
                    onChange={(e) => setFilters({ ...filters, limit: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <button
                onClick={fetchSpots}
                disabled={loading}
                className="w-full mt-4 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Tìm kiếm
              </button>
            </div>

            <div className="text-xs text-muted-foreground/65 bg-card border border-border rounded-xl p-3">
              <Info className="w-3 h-3 inline mb-1" />
              Kết quả được sắp xếp theo điểm số tổng hợp (0–100) từ AI.
              Giải thích từng đề xuất được cache trong 24h.
            </div>
          </div>

          {/* Results List */}
          <div className="lg:col-span-1 space-y-3 max-h-[calc(100vh-180px)] overflow-y-auto">
            {loading && spots.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground/65">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Đang tìm kiếm địa điểm...
              </div>
            ) : spots.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground/65">
                <MapPin className="w-6 h-6 mx-auto mb-2 opacity-30" />
                Không tìm thấy địa điểm nào. Điều chỉnh bộ lọc và thử lại.
              </div>
            ) : (
              spots.map((spot) => (
                <SpotCard
                  key={spot.spot.id}
                  spot={spot}
                  onExplain={handleExplain}
                />
              ))
            )}
          </div>

          {/* Map */}
          <div className="lg:col-span-2 h-[calc(100vh-180px)] rounded-xl overflow-hidden border border-border bg-muted/10">
            <InteractiveMap
              points={mapPoints}
              selectedPoint={null}
              onSelectPoint={() => {}}
              nearbyPoints={[]}
              geoJsonData={null}
              featuredPins={[]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
