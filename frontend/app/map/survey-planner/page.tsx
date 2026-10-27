"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  ChevronLeft, BrainCircuit, MapPin, BarChart3, Target,
  RefreshCw, AlertCircle, Info, SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useRequireAuth } from '@/src/lib/require-auth';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

// Dynamically import the Leaflet map (SSR-incompatible).
const SurveyPlannerMap = dynamic(() => import('./SurveyPlannerMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/20">
      <span className="text-muted-foreground">Đang tải bản đồ…</span>
    </div>
  ),
});

// ── Defaults grounded in Biên Hòa / Đồng Nai (HF Spaces runtime region) ──────
const BIEN_HOA = { lat: 10.957, lng: 106.843 };

// ── Main page ───────────────────────────────────────────────────────────────

export default function SurveyPlannerPage() {
  const { user } = useRequireAuth('/auth/login');

  const [currentLat, setCurrentLat] = useState(String(BIEN_HOA.lat));
  const [currentLng, setCurrentLng] = useState(String(BIEN_HOA.lng));
  const [gridSizeKm, setGridSizeKm] = useState('1.0');
  const [topN, setTopN] = useState('15');
  const [surveyTime, setSurveyTime] = useState('1.0');
  const [speedKmh, setSpeedKmh] = useState('30');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPriorities = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('current_lat', currentLat);
      params.set('current_lng', currentLng);
      params.set('grid_size_km', gridSizeKm);
      params.set('top_n', topN);
      params.set('survey_time_hours', surveyTime);
      params.set('surveyor_speed_kmh', speedKmh);

      const res = await fetchWithRetry(`/api/map/survey/priorities?${params.toString()}`, {
        retries: 2,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      setResult(data);
      if (data?.metadata?.degraded) {
        toast.warning(data.metadata.reason || 'Kết quả đang trong chế độ giảm tốc.');
      } else {
        toast.success(`Đã lên ${data?.features?.length ?? 0} gợi ý khảo sát.`);
      }
    } catch (err: any) {
      logger.error('Survey priorities error', err);
      setError(err?.message || 'Không thể tải kế hoạch khảo sát.');
      toast.error('Tải kế hoạch khảo sát thất bại — vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [user, currentLat, currentLng, gridSizeKm, topN, surveyTime, speedKmh]);

  // Auto-fetch on mount + when key params change.
  useEffect(() => {
    fetchPriorities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLat, currentLng, gridSizeKm, topN, user]);

  const features = useMemo(() => result?.features || [], [result]);
  const nextPoint = useMemo(() => result?.next_point || null, [result]);
  const meta = useMemo(() => result?.metadata || {}, [result]);
  const summary = useMemo(() => result?.summary || {}, [result]);
  const currentLocation = useMemo(
    () => (currentLat && currentLng
      ? { lat: parseFloat(currentLat), lng: parseFloat(currentLng) }
      : BIEN_HOA),
    [currentLat, currentLng],
  );

  // Wait until auth is resolved.
  if (!user) return null;

  const handleSelect = (f: any) => {
    logger.info?.(`Selected survey candidate #${f.properties.rank}`);
  };

  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full bg-background flex flex-col lg:flex-row overflow-hidden">
      {/* ── Left panel: controls + ranked candidate list ── */}
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
          <h1 className="text-xl font-bold text-foreground">Kế hoạch khảo sát AI</h1>
        </div>

        <p className="text-xs text-muted-foreground">
          Hệ thống học máy chọn điểm xác minh tiếp theo bằng <strong>ước lượng
          không chắc (entropy)</strong> + <strong>giá trị thông tin</strong> ÷
          <strong> chi phí</strong> (khoảng cách + thời gian cố định). KHÔNG
          gọi LLM — tính toán trên server, nhanh và giảm tốc trên HF Spaces.
        </p>

        {/* Controls */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground">GPS hiện tại</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                type="number" step="0.0001"
                value={currentLat}
                onChange={(e) => setCurrentLat(e.target.value)}
                placeholder="10.957"
                className="text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <input
                type="number" step="0.0001"
                value={currentLng}
                onChange={(e) => setCurrentLng(e.target.value)}
                placeholder="106.843"
                className="text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Kích thước ô lưới (km)</label>
            <select
              value={gridSizeKm}
              onChange={(e) => setGridSizeKm(e.target.value)}
              className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="0.5">0.5 km</option>
              <option value="1.0">1.0 km</option>
              <option value="2.0">2.0 km</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Số gợi ý (top_n)</label>
            <select
              value={topN}
              onChange={(e) => setTopN(e.target.value)}
              className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {[5, 10, 15, 25, 50].map((n) => (
                <option key={n} value={String(n)}>{n} gợi ý</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground/60">Thời gian khảo sát (h)</label>
              <input
                type="number" step="0.1"
                value={surveyTime}
                onChange={(e) => setSurveyTime(e.target.value)}
                className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground/60">Tốc độ (km/h)</label>
              <input
                type="number" step="1"
                value={speedKmh}
                onChange={(e) => setSpeedKmh(e.target.value)}
                className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>
          <button
            onClick={fetchPriorities}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Đang tính toán…
              </>
            ) : (
              <>
                <BrainCircuit className="w-4 h-4" /> Cập nhật kế hoạch
              </>
            )}
          </button>
        </div>

        {/* Degraded banner */}
        {meta.degraded && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{meta.reason || 'Dữ liệu hiếm — kết quả chỉ mang tính tham khảo.'}</span>
          </div>
        )}

        {/* Methodology transparency */}
        {result && (
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
              <Info className="w-3.5 h-3.5" />
              <span>Công thức ưu tiên</span>
            </div>
            <div className="text-[10px] text-muted-foreground/80 space-y-0.5">
              <div>priority_score = info_value / cost</div>
              <div>• uncertainty: entropy nhị phân của xác suất tồn tại cơ sở</div>
              <div>• info_value: giảm thiểu entropy (+ liên kết lân cận)</div>
              <div>• cost: thời gian di chuyển + thời gian cố định khảo sát</div>
              <div>Cache: {meta.cached ? 'cache' : 'mới'} · POI: {summary.poi_count ?? 0}</div>
            </div>
          </div>
        )}

        {/* Next-best point highlight */}
        {nextPoint && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span>Điểm khảo sát tiếp theo</span>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {nextPoint.lat.toFixed(4)}, {nextPoint.lng.toFixed(4)}
              </span>
              <span className="block opacity-70 mt-0.5">
                {features[0]?.properties.reason || 'Ranh giới chuyển đổi — mức độ bỏ sót cao.'}
              </span>
            </div>
          </div>
        )}

        {/* Ranked candidate list */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Danh sách ưu tiên ({features.length})</span>
          </div>
          {features.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/50">
              {meta.degraded ? 'Chưa có gợi ý — mở rộng vùng hoặc di chuyển vị trí.' : 'Đang tải…'}
            </p>
          ) : (
            <div className="space-y-1">
              {features.slice(0, 15).map((f: any, i: number) => {
                const p = f.properties;
                const badge = p.priority_label === 'cao'
                  ? 'text-red-400'
                  : p.priority_label === 'trung bình'
                    ? 'text-amber-400'
                    : 'text-sky-400';
                return (
                  <button
                    key={`row-${p.rank}`}
                    onClick={() => handleSelect(f)}
                    className="w-full flex items-center gap-2 text-xs text-left p-2 rounded border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="w-4 text-muted-foreground/60 text-right">{p.rank}.</span>
                    <span className={`w-2 h-2 rounded-full ${badge.replace('text-', 'bg-')}`} />
                    <span className="flex-1 font-medium text-foreground truncate">
                      {p.reason || 'Ứng cử viên khảo sát'}
                    </span>
                    <span className={`font-bold ${badge}`}>{p.priority_score.toFixed(3)}</span>
                    <MapPin className="w-3 h-3 text-muted-foreground/40" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && !result && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Right panel: priority map ── */}
      <div className="flex-1 relative">
        <SurveyPlannerMap
          data={result}
          loading={loading || (!result && !error)}
          error={error}
          currentLocation={currentLocation}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
