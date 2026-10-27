"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  ChevronLeft, CloudRain, MapPin, BarChart3, RefreshCw,
  AlertCircle, Info, ExternalLink, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useRequireAuth } from '@/src/lib/require-auth';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

// Dynamically import the Leaflet map (SSR-incompatible).
const ClimateGuardianMap = dynamic(() => import('@/components/climate-guardian/ClimateGuardianMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/20">
      <span className="text-muted-foreground">Đang tải bản đồ…</span>
    </div>
  ),
});

// Biên Hòa / Đồng Nai default view (real educational region).
const DEFAULT_CENTER = { lat: 10.9525, lng: 106.8778 };
const DEFAULT_BBOX = { minLat: 10.75, maxLat: 11.20, minLng: 106.60, maxLng: 107.20 };

// Category filter options for alternatives search.
const CATEGORY_OPTIONS = [
  { label: 'Tất cả', value: '' },
  { label: 'Trường Đại học', value: 'university' },
  { label: 'Trường THPT', value: 'school' },
  { label: 'Thư viện', value: 'library' },
  { label: 'Wifi miễn phí', value: 'wifi_hotspot' },
  { label: 'Lab STEM', value: 'lab' },
  { label: 'Không gian học tập', value: 'study_space' },
];

function formatPct(v: number): string {
  return `${Number(v).toFixed(1)}%`;
}

function riskLabel(score: number): string {
  if (score >= 0.75) return 'Rất cao';
  if (score >= 0.5) return 'Cao';
  if (score >= 0.3) return 'Trung bình';
  if (score >= 0.15) return 'Thấp';
  return 'Rất thấp';
}

function riskColor(score: number): string {
  if (score >= 0.75) return 'bg-red-400';
  if (score >= 0.5) return 'bg-amber-400';
  if (score >= 0.3) return 'bg-orange-400';
  if (score >= 0.15) return 'bg-cyan-400';
  return 'bg-green-400';
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ClimateGuardianPage() {
  const { user } = useRequireAuth('/auth/login');

  const [bbox, setBbox] = useState(DEFAULT_BBOX);
  const [dateStr, setDateStr] = useState('');
  const [riskResult, setRiskResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Alternatives state
  const [altCenter, setAltCenter] = useState(DEFAULT_CENTER);
  const [altRadius, setAltRadius] = useState(10);
  const [altCategory, setAltCategory] = useState('');
  const [altResult, setAltResult] = useState<any>(null);
  const [altLoading, setAltLoading] = useState(false);

  const fetchRisk = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('minLat', String(bbox.minLat));
      params.set('maxLat', String(bbox.maxLat));
      params.set('minLng', String(bbox.minLng));
      params.set('maxLng', String(bbox.maxLng));
      if (dateStr) params.set('date', dateStr);

      const res = await fetchWithRetry(`/api/map/climate-risk?${params.toString()}`, { retries: 2 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      setRiskResult(data);
      if (data?.metadata?.degraded) {
        toast.warning(data.metadata.reason || 'Dữ liệu khí hậu đang trong chế độ giảm tốc.');
      }
    } catch (err: any) {
      logger.error('Climate risk error', err);
      setError(err?.message || 'Không thể tải bản đồ rủi ro khí hậu.');
      toast.error('Tải bản đồ rủi ro thất bại — vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [bbox, dateStr, user]);

  const fetchAlternatives = useCallback(async () => {
    if (!user) return;
    setAltLoading(true);
    try {
      const res = await fetchWithRetry('/api/map/climate/alternatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: altCenter.lat,
          lng: altCenter.lng,
          radiusKm: altRadius,
          category: altCategory || null,
        }),
        retries: 2,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      setAltResult(data);
      if (data?.metadata?.degraded) {
        toast.warning(data.metadata.reason || 'Chế độ giảm tốc cho phương án thay thế.');
      }
    } catch (err: any) {
      logger.error('Climate alternatives error', err);
      toast.error('Tải phương án thay thế thất bại.');
    } finally {
      setAltLoading(false);
    }
  }, [altCenter, altRadius, altCategory, user]);

  // Auto-fetch on mount + when bbox/date changes.
  useEffect(() => {
    fetchRisk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox, dateStr]);

  useEffect(() => {
    fetchAlternatives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [altCenter, altRadius, altCategory]);

  const meta = useMemo(() => riskResult?.metadata || {}, [riskResult]);
  const heatPoints = useMemo(() => riskResult?.heat_points || [], [riskResult]);
  const riskRanking = useMemo(() => riskResult?.risk_ranking || [], [riskResult]);
  const safeAlts = useMemo(() => (altResult?.features || []), [altResult]);

  // Wait until auth is resolved.
  if (!user) return null;

  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full bg-background flex flex-col lg:flex-row overflow-hidden">
      {/* ── Left panel: controls + risk ranking + alternatives ── */}
      <div className="w-full lg:w-96 flex flex-col gap-4 p-4 lg:p-6 overflow-y-auto custom-scrollbar border-r border-border bg-card">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => window.history.back()}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            title="Quay lại bản đồ"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <CloudRain className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">AI Bảo Vệ Khí Hậu</h1>
        </div>

        <p className="text-xs text-muted-foreground">
          Kết hợp bản đồ ngập lũ tĩnh (dựa trên dữ liệu lịch sử sông Đồng Nai,
          Cửu Long, miền Trung) + dữ liệu thời tiết (OpenWeatherMap) + độ cao
          địa hình để đưa ra bản đồ rủi ro và đề xuất nơi học tập an toàn.
        </p>

        {/* ── BBox controls ── */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground">Vùng (bounding box)</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                type="number" step="0.001"
                value={bbox.minLat}
                onChange={(e) => setBbox({ ...bbox, minLat: parseFloat(e.target.value) || 0 })}
                className="text-xs px-2 py-1.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder="minLat"
              />
              <input
                type="number" step="0.001"
                value={bbox.maxLat}
                onChange={(e) => setBbox({ ...bbox, maxLat: parseFloat(e.target.value) || 0 })}
                className="text-xs px-2 py-1.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder="maxLat"
              />
              <input
                type="number" step="0.001"
                value={bbox.minLng}
                onChange={(e) => setBbox({ ...bbox, minLng: parseFloat(e.target.value) || 0 })}
                className="text-xs px-2 py-1.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder="minLng"
              />
              <input
                type="number" step="0.001"
                value={bbox.maxLng}
                onChange={(e) => setBbox({ ...bbox, maxLng: parseFloat(e.target.value) || 0 })}
                className="text-xs px-2 py-1.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder="maxLng"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Ngày (tùy chọn)</label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          <button
            onClick={fetchRisk}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium transition-colors hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Đang tính toán…
              </>
            ) : (
              <>
                <CloudRain className="w-4 h-4" /> Cập nhật bản đồ rủi ro
              </>
            )}
          </button>
        </div>

        {/* Degraded banner */}
        {meta.degraded && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{meta.reason || 'Dữ liệu khí hậu đang trong chế độ giảm tốc — kết quả chỉ mang tính tham khảo.'}</span>
          </div>
        )}

        {/* Methodology transparency */}
        {riskResult && (
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
              <Info className="w-3.5 h-3.5" />
              <span>Công thức rủi ro</span>
            </div>
            <div className="text-[10px] text-muted-foreground/80 space-y-0.5">
              <div>risk_score = 0.35·flood_risk + 0.35·weather_risk + 0.30·access_risk</div>
              <div>• flood_risk: khoảng cách đến vùng ngập + tháng trong mùa lũ</div>
              <div>• weather_risk: cường độ mưa/gió (OpenWeatherMap, nếu có key)</div>
              <div>• access_risk: khoảng cách đến cơ sở giáo dục gần nhất</div>
              <div className="pt-1">
                Cache: {meta.cached ? 'cache' : 'mới'} · Nguồn: {meta.data_source || 'static'} ·
                Tháng: {meta.month} ({meta.season}) · Các vùng ngập: {meta.flood_zones_loaded || 0}
              </div>
              {meta.has_weather && (
                <div className="flex items-center gap-1 pt-1 text-accent">
                  <CheckCircle2 className="h-3 w-3" /> Weather API (OpenWeatherMap) đang hoạt động
                </div>
              )}
              {!meta.has_weather && (
                <div className="flex items-center gap-1 pt-1 text-primary">
                  <AlertCircle className="h-3 w-3" /> Dùng bản đồ ngập tĩnh (thiếu OWM_API_KEY)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Risk ranking */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <CloudRain className="w-3.5 h-3.5" />
            <span>Bảng xếp hạng khu vực nguy cơ</span>
          </div>
          {riskRanking.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/65">Chưa có dữ liệu.</p>
          ) : (
            <div className="space-y-1">
              {riskRanking.slice(0, 10).map((r: any, i: number) => (
                <div key={`${r.lat}:${r.lng}:${i}`} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-muted-foreground/60 text-right">{i + 1}.</span>
                  <span className={`w-2 h-2 rounded-full ${riskColor(r.risk_score)}`} />
                  <div className="flex-1">
                    <span className="font-medium text-foreground truncate">{r.area || r.nearest_facility || 'Vùng nguy cơ'}</span>
                  </div>
                  <span className="font-bold">{formatPct(r.risk_score * 100)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Alternatives section ── */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="w-4 h-4 text-green-400" />
            <span>Địi chỗ học an toàn</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <input
              type="number" step="0.001"
              value={altCenter.lat}
              onChange={(e) => setAltCenter({ ...altCenter, lat: parseFloat(e.target.value) || 0 })}
              className="px-2 py-1.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="lat"
            />
            <input
              type="number" step="0.001"
              value={altCenter.lng}
              onChange={(e) => setAltCenter({ ...altCenter, lng: parseFloat(e.target.value) || 0 })}
              className="px-2 py-1.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="lng"
            />
            <input
              type="number" step="1"
              value={altRadius}
              onChange={(e) => setAltRadius(Math.max(1, parseInt(e.target.value) || 10))}
              className="px-2 py-1.5 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="km"
            />
            <select
              value={altCategory}
              onChange={(e) => setAltCategory(e.target.value)}
              className="px-2 py-1.5 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchAlternatives}
            disabled={altLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-accent-foreground font-medium transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            {altLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Đang tìm…
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" /> Tìm nơi học an toàn
              </>
            )}
          </button>

          {meta.degraded && meta.has_weather !== undefined && !meta.has_weather && (
            <div className="text-[10px] text-muted-foreground/60 italic">
              * Bản đồ rủi ro dựa trên dữ liệu ngập lũ lịch sử + mùa.
              Để nhận dự báo thời tiết thời gian thực, cài OWM_API_KEY.
            </div>
          )}

          {/* Safe alternatives list */}
          {safeAlts.length > 0 ? (
            <div className="space-y-1">
              {safeAlts.slice(0, 8).map((f: any) => {
                const props = f.properties || {};
                return (
                  <div key={props.id || `${props.lat}:${props.lng}`} className="p-2 rounded border border-green-500/20 bg-green-500/5">
                    <div className="font-medium text-foreground text-xs">{props.name}</div>
                    <div className="text-[10px] text-muted-foreground/70">
                      {props.category} · An toàn: {formatPct(props.safety_score * 100)} ·
                      Cách: {props.distance_km} km ({props.walk_time_min} phút)
                      {props.elevation_m && ` · ${props.elevation_m} m`}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/65">
              {altResult ? 'Không tìm thấy nơi nào an toàn trong bán kính.' : 'Nhấn "Tìm nơi học an toàn" để bắt đầu.'}
            </p>
          )}
        </div>

        {error && !riskResult && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Right panel: risk heatmap map ── */}
      <div className="flex-1 relative">
        <ClimateGuardianMap
          data={riskResult}
          alternatives={altResult}
          loading={loading}
          error={error}
          onSelectAlternative={(alt: any) => {
            const coords = alt.geometry?.coordinates;
            if (coords) {
              toast.info(`Đã chọn: ${alt.properties?.name || 'Nơi học an toàn'}`);
            }
          }}
        />
        {/* Heat intensity legend */}
        {riskResult && heatPoints.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2.5 py-1.5 bg-card/90 border border-border rounded-lg shadow text-[10px] text-muted-foreground">
            <CloudRain className="w-3 h-3 text-red-400" />
            <span>Mực độ rủi ro:</span>
            <span className="font-medium text-green-400">thấp</span>
            <span>→</span>
            <span className="font-medium text-cyan-400">trung bình</span>
            <span>→</span>
            <span className="font-medium text-red-400">cao</span>
          </div>
        )}
      </div>
    </div>
  );
}
