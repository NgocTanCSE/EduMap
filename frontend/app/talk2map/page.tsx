'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Search, X, MapPin, Star, Wifi, Clock, CalendarDays, ShoppingCart, GraduationCap, BookOpen, Leaf, Coffee, Compass, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';
import { DEFAULT_BBOX } from '@/src/lib/map-constants';

const InteractiveMap = dynamic(() => import('@/components/ui/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/10">
      <span className="text-muted-foreground">Đang tải bản đồ…</span>
    </div>
  ),
});

// ── Types ─────────────────────────────────────────────────────────────────
interface ParsedQuery {
  location: string | null;
  radius_km: number | null;
  facility_types: string[];
  conditions: string[];
  reference_location: string | null;
  confidence: number;
  method: string;
  suggestions: string[];
  raw_text: string;
}

interface PoiResult {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address?: string;
  description?: string;
  rating_avg?: number;
  rating_count?: number;
  status?: string;
  verified?: boolean;
}

interface NlsResponse {
  query: string;
  parsed_query: ParsedQuery;
  explanation: string;
  degraded: boolean;
  results: PoiResult[];
  total: number;
  // Voice-to-Geo (Idea #16): intent classification for voice queries.
  intent?: { intent: string; confidence: number; detail?: string };
}

// ── Category labels & icons ───────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  university: 'Đại học', school: 'Trường học', library: 'Thư viện',
  bookstore: 'Nhà sách', lab: 'Lab', wifi: 'Wifi', green: 'Khu xanh',
  cafe: 'Cà phê', restaurant: 'Nhà hàng', market: 'Chợ',
  convenience: 'Cửa hàng', park: 'Công viên', other: 'Khác',
};

const CATEGORY_ICONS: Record<string, any> = {
  university: GraduationCap, school: GraduationCap, library: BookOpen,
  bookstore: BookOpen, lab: BookOpen, wifi: Wifi, green: Leaf,
  cafe: Coffee, restaurant: Coffee, market: ShoppingCart,
  convenience: ShoppingCart, park: Leaf, other: MapPin,
};

const CONDITION_LABELS: Record<string, string> = {
  free: 'Miễn phí', wifi: 'Wifi', open_evening: 'Mở buổi tối',
  open_now: 'Mở cửa', parking: 'Đậu xe', quiet: 'Yên tĩch',
  outdoor: 'Ngoài trời', group: 'Nhóm', bench: 'Bàn ghế', aircon: 'Điều hòa',
};

const DEFAULT_QUERIES = [
  'Tìm thư viện gần trường có wifi',
  'Tìm quán cà phê mở cửa buổi tối',
  'Địa điểm học nhóm miễn phí',
  'Tìm trường học gần Biên Hòa',
  'Nơi có wifi và bàn ghế để học',
];

// ── Main page ─────────────────────────────────────────────────────────────
export default function Talk2MapPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<NlsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({ q: q.trim() });
      const res = await fetchWithRetry(`/api/map/nl-search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<NlsResponse>(json);
      setResult(data);
      if (data.degraded) {
        toast.warning('AI đang ngoại tuyến — kết quả tìm kiếm bằng từ khóa regex');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Lỗi kết nối');
      toast.error('Không thể tìm kiếm. Vui lòng thử lại.');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      handleSearch(query.trim());
    }
  };

  const handleExampleClick = (q: string) => {
    setQuery(q);
    handleSearch(q);
  };

  const clearResults = () => {
    setResult(null);
    setError(null);
    setQuery('');
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:flex-row">
      {/* ── Left panel: search + results ────────────────────────────────── */}
      <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 lg:w-[420px] lg:max-w-[480px] lg:border-r lg:border-border">
        {/* Search bar */}
        <div className="sticky top-0 z-10 bg-background/95 pb-4 backdrop-blur">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ví dụ: Tìm thư viện gần trường có wifi, mở cửa buổi tối..."
              className="w-full rounded-lg border border-border bg-card px-4 py-2.5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              maxLength={500}
            />
            {query && (
              <button
                onClick={clearResults}
                className="absolute right-12 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => handleSearch(query)}
              disabled={isSearching || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-accent p-2 text-accent-foreground transition-opacity hover:bg-accent/90 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          {/* Quick-example chips */}
          {!result && !isSearching && (
            <div className="mt-3 flex flex-wrap gap-2">
              {DEFAULT_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleExampleClick(q)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {isSearching && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-muted-foreground">Đang phân tích câu hỏi của bạn…</p>
          </div>
        )}

        {/* Error */}
        {error && !isSearching && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Results section */}
        {result && !isSearching && (
          <>
            {/* Explanation */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0 rounded-full bg-accent/10 p-1.5">
                  <Search className="h-4 w-4 text-accent" />
                </div>
                <p className="text-sm leading-relaxed text-foreground">{result.explanation}</p>
              </div>
              {result.degraded && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <Clock className="h-3 w-3" />
                  <span>Kết quả dựa trên từ khóa (chế độ ngoại tuyến) — bật kết nối mạng để nhận kết quả chính xác hơn.</span>
                </div>
              )}
            </div>

            {/* Structured query display */}
            <div className="rounded-lg border border-border bg-card/50 p-3 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Truy vấn đã phân tích</h3>
              <div className="space-y-2 text-sm">
                {/* Facility types */}
                {result.parsed_query.facility_types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {result.parsed_query.facility_types.map((f) => {
                      const Icon = CATEGORY_ICONS[f] || MapPin;
                      return (
                        <span key={f} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                          <Icon className="h-3 w-3" />
                          {CATEGORY_LABELS[f] || f}
                        </span>
                      );
                    })}
                  </div>
                )}
                {/* Conditions */}
                {result.parsed_query.conditions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {result.parsed_query.conditions.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 rounded-full bg-secondary/20 px-2.5 py-1 text-xs text-secondary-foreground">
                        {CONDITION_LABELS[c] || c}
                      </span>
                    ))}
                  </div>
                )}
                {/* Location + radius */}
                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {result.parsed_query.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> {result.parsed_query.location}
                    </span>
                  )}
                  {result.parsed_query.reference_location && (
                    <span className="inline-flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5 shrink-0" /> Gần: {result.parsed_query.reference_location}
                    </span>
                  )}
                  {result.parsed_query.radius_km && (
                    <span className="inline-flex items-center gap-1.5">
                      <Ruler className="h-3.5 w-3.5 shrink-0" /> Bán kính: {result.parsed_query.radius_km} km
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Kết quả ({result.total})</h3>
              {result.parsed_query.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-end">
                  {result.parsed_query.suggestions.map((s, i) => (
                    <span key={i} className="text-xs text-muted-foreground bg-muted/20 rounded px-2 py-0.5">
                      Gợi ý: {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Results list */}
            {result.results.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Không tìm thấy địa điểm phù hợp.
                <br />
                <span
                  className="mt-2 cursor-pointer underline"
                  onClick={() => handleSearch('Tìm địa điểm học tập gần đây')}
                >
                  Thử tìm kiếm rộng hơn
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {result.results.map((poi) => (
                  <PoiCard key={poi.id} poi={poi} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Right panel: map ─────────────────────────────────────────────── */}
      <div className="relative hidden h-full w-1/2 lg:block">
        {result && result.results.length > 0 ? (
          <InteractiveMap
            points={result.results}
            selectedPoint={null}
            onSelectPoint={() => {}}
            showHeatmap={false}
          />
        ) : (
          <div className="h-full w-full bg-muted/5 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MapPin className="mx-auto h-12 w-12 opacity-20" />
              <p className="mt-2 text-sm">Nhập câu hỏi để xem kết quả trên bản đồ</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── POI Card component ─────────────────────────────────────────────────────
function PoiCard({ poi }: { poi: PoiResult }) {
  const Icon = CATEGORY_ICONS[poi.category] || MapPin;
  const categoryLabel = CATEGORY_LABELS[poi.category] || poi.category;

  return (
    <div className="group cursor-pointer rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/5">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-foreground">{poi.name}</h4>
            {poi.rating_avg && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span>{poi.rating_avg.toFixed(1)}</span>
              </div>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{categoryLabel}</p>
          {poi.address && (
            <p className="mt-1 inline-flex items-start gap-1 text-xs text-muted-foreground line-clamp-2">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2">{poi.address}</span>
            </p>
          )}
          {poi.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {poi.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
