"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  ChevronLeft, BrainCircuit, MapPin, BarChart3, RefreshCw,
  AlertCircle, Info, List, BarChartHorizontal, Target, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useRequireAuth } from '@/src/lib/require-auth';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

// Dynamically import the Leaflet map (SSR-incompatible).
const DataHunterMap = dynamic(() => import('./DataHunterMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/20">
      <span className="text-muted-foreground">Đang tải bản đồ…</span>
    </div>
  ),
});

// Grid sizes in km — Vietnamese secondary-city scale.
const GRID_SIZE_OPTIONS = [
  { value: 0.5, label: '0.5 km' },
  { value: 1.0, label: '1 km' },
  { value: 2.0, label: '2 km' },
  { value: 5.0, label: '5 km' },
];

function priorityBadge(level: string) {
  if (level === 'high') return { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400' };
  if (level === 'medium') return { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400' };
  return { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-400' };
}

function formatPct(v: number): string {
  return `${Number(v).toFixed(1)}%`;
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function DataHunterPage() {
  const { user } = useRequireAuth('/auth/login');

  const [gridSizeKm, setGridSizeKm] = useState(1.0);
  const [topN, setTopN] = useState(50);
  const [categories, setCategories] = useState<string>('');
  const [bounds, setBounds] = useState<{ minLat: number; maxLat: number; minLng: number; maxLng: number } | null>(null);

  const [result, setResult] = useState<any>(null);
  const [pois, setPois] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch POIs for context (same as the main map page).
  const fetchPois = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (bounds) {
        params.set('minLat', String(bounds.minLat));
        params.set('maxLat', String(bounds.maxLat));
        params.set('minLng', String(bounds.minLng));
        params.set('maxLng', String(bounds.maxLng));
      }
      const url = `/api/map/pois${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetchWithRetry(url, { retries: 2 });
      if (res.ok) {
        const json = await res.json();
        const data = unwrapApiResponse<any[]>(json);
        const list = Array.isArray(data) ? data : [];
        setPois(list.filter((p: any) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))));
      }
    } catch (err) {
      logger.error('Error fetching POIs for context', err);
    }
  }, [bounds]);

  const fetchGaps = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('grid_size_km', String(gridSizeKm));
      params.set('top_n', String(topN));
      if (categories) params.set('categories', categories);
      if (bounds) {
        params.set('min_lat', String(bounds.minLat));
        params.set('max_lat', String(bounds.maxLat));
        params.set('min_lng', String(bounds.minLng));
        params.set('max_lng', String(bounds.maxLng));
      }
      const res = await fetchWithRetry(`/api/map/data-gaps?${params.toString()}`, { retries: 2 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      setResult(data);
      if (data?.metadata?.degraded) {
        toast.warning(data.metadata.reason || 'Dữ liệu đang trong chế độ giảm tốc.');
      }
    } catch (err: any) {
      logger.error('Data gaps error', err);
      setError(err?.message || 'Không thể tải phân tích khoảng trống dữ liệu.');
      toast.error('Tải phân tích thất bại — vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [gridSizeKm, topN, categories, bounds, user]);

  // Auto-fetch on mount + when controls change (after first manual run).
  useEffect(() => {
    fetchGaps();
    fetchPois();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSizeKm, topN, categories]);

  const gapFeatures = useMemo(() => (result?.features || []).slice(0, topN), [result, topN]);
  const topGaps = useMemo(() => gapFeatures.slice(0, 12), [gapFeatures]);
  const attributeGaps = useMemo(() => result?.attribute_gaps || {}, [result]);
  const summary = useMemo(() => result?.summary || {}, [result]);
  const meta = useMemo(() => result?.metadata || {}, [result]);

  const attrGapEntries = useMemo(() => {
    return Object.entries(attributeGaps)
      .filter(([_, v]: [string, any]) => v && typeof v === 'object' && 'pct' in v)
      .map(([k, v]: [string, any]) => ({ attr: k, ...v }))
      .sort((a: any, b: any) => b.pct - a.pct);
  }, [attributeGaps]);

  // Wait until auth is resolved.
  if (!user) return null;

  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full bg-background flex flex-col lg:flex-row overflow-hidden">
      {/* ── Left panel: controls + gap list ── */}
      <div className="w-full lg:w-96 flex flex-col gap-4 p-4 lg:p-6 overflow-y-auto custom-scrollbar border-r border-border bg-card">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => window.history.back()}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            title="Quay lại bản đồ"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Target className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Truy đuổi Dữ liệu Thiếu</h1>
        </div>

        <p className="text-xs text-muted-foreground">
          Phân tích độ bao phủ lưới (grid-based) + phát hiện thuộc tính chưa đủ trên
          các POI. Các ô chưa có dữ liệu được đánh dấu đỏ — đây là ứng cử viên
          khảo sát ưu tiên.
        </p>

        {/* Controls */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground">Kích thước ô lưới</label>
            <select
              value={gridSizeKm}
              onChange={(e) => setGridSizeKm(parseFloat(e.target.value))}
              className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {GRID_SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Số ô gap tối đa</label>
            <input
              type="range"
              min={5}
              max={200}
              step={5}
              value={topN}
              onChange={(e) => setTopN(parseInt(e.target.value, 10))}
              className="mt-1 w-full h-2 bg-muted rounded-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5</span><span>{topN}</span><span>200</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Lọc category (phân cách bằng dấu phẩy)</label>
            <input
              type="text"
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
              placeholder="VD: school, university, library"
              className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          <button
            onClick={fetchGaps}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Đang phân tích…
              </>
            ) : (
              <>
                <BrainCircuit className="w-4 h-4" /> Phân tích lại
              </>
            )}
          </button>
        </div>

        {/* Degraded banner */}
        {meta.degraded && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{meta.reason || 'Dữ liệu hiếm — kết quả chỉ mang tính tham khảo.'}</span>
          </div>
        )}

        {/* Summary stats */}
        {result && (
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-3 rounded-lg bg-muted/20 border border-border">
              <div className="text-2xl font-bold text-destructive">{summary.gap_cells || 0}</div>
              <div className="text-[10px] text-muted-foreground">Ô chưa có dữ liệu</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/20 border border-border">
              <div className="text-2xl font-bold text-primary">{summary.total_points || 0}</div>
              <div className="text-[10px] text-muted-foreground">POI đã nạp</div>
            </div>
          </div>
        )}

        {/* Attribute gap report */}
        {attrGapEntries.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <BarChartHorizontal className="w-3.5 h-3.5" />
              <span>Thuộc tính cần bổ sung</span>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {attrGapEntries.map((entry: any) => (
                <div key={entry.attr} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-muted-foreground truncate">{entry.attr}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${entry.pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-muted-foreground">{formatPct(entry.pct)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Priority gap list */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <List className="w-3.5 h-3.5" />
            <span>Danh sách ưu tiên khảo sát</span>
          </div>
          {topGaps.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/65">Chưa có dữ liệu. Nhấn "Phân tích lại".</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto custom-scrollbar">
              {topGaps.map((f: any, i: number) => {
                const props = f.properties || {};
                const b = priorityBadge(props.priority || 'low');
                return (
                  <div key={`${props.cell_id || i}`} className={`p-2 rounded border ${b.bg} ${b.border} text-xs`}>
                    <div className="flex items-start gap-2">
                      <span className={`w-2 h-2 rounded-full ${b.dot} shrink-0 mt-0.5`} />
                      <div className="flex-1">
                        <div className="font-medium text-foreground truncate">{props.area || `Ô ${props.cell_id}`}</div>
                        <div className="text-muted-foreground/70 mt-0.5">
                          Điểm: {formatPct(props.gap_score * 100)} · Ưu tiên: <b className={b.text}>{props.priority}</b>
                        </div>
                        {props.nearest_poi_distance_km != null && (
                          <div className="text-muted-foreground/60">Gần nhất: {props.nearest_poi_distance_km} km</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Methodology */}
        {result && (
          <div className="p-3 rounded-lg bg-muted/20 border border-border text-[10px] text-muted-foreground/80">
            <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
              <Info className="w-3.5 h-3.5" />
              <span>Phương pháp</span>
            </div>
            <div>• Grid-based coverage: ô {summary.grid_size_km}km²</div>
            <div>• Attribute gap: kiểm tra name, address, city, description, rating, website, hours, …</div>
            <div>• Cache: {meta.cached ? 'cache' : 'mới'} · {summary.gap_cells} ô thiếu hụt / {summary.total_cells} tổng ô</div>
          </div>
        )}

        {error && !result && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Right panel: data hunter map ── */}
      <div className="flex-1 relative">
        <DataHunterMap data={result} pois={pois} loading={loading || (!result && !error)} error={error} />
        {/* Gap legend */}
        {result && !meta.degraded && gapFeatures.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-1.5 bg-card/90 border border-border rounded-lg shadow text-[10px] text-muted-foreground">
            <MapPin className="w-3 h-3 text-destructive" />
            <span>Độ ưu tiên:</span>
            <span className="font-medium text-blue-400">thấp</span>
            <span>→</span>
            <span className="font-medium text-amber-400">trung bình</span>
            <span>→</span>
            <span className="font-medium text-red-400">cao</span>
          </div>
        )}
      </div>
    </div>
  );
}
