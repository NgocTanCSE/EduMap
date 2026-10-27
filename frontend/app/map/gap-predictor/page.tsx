"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  ChevronLeft, BrainCircuit, MapPin, BarChart3, Flame,
  RefreshCw, AlertCircle, Info, ExternalLink, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useRequireAuth } from '@/src/lib/require-auth';
import { fetchWithRetry } from '@/src/lib/fetch-with-retry';
import { unwrapApiResponse } from '@/src/lib/api-utils';

// Dynamically import the Leaflet map (SSR-incompatible).
const GapPredictorMap = dynamic(() => import('./GapPredictorMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/20">
      <span className="text-muted-foreground">Đang tải bản đồ…</span>
    </div>
  ),
});

// Regions backed by education_stats in the shared SQLite DB.
const REGIONS = [
  { label: 'Đồng Nai', value: 'Đồng Nai' },
  { label: 'TP. Hồ Chí Minh', value: 'TP. Hồ Chí Minh' },
  { label: 'Hà Nội', value: 'Hà Nội' },
  { label: 'Đà Nẵng', value: 'Đà Nẵng' },
  { label: 'Cần Thơ', value: 'Cần Thơ' },
];

const STEPS_OPTIONS = [3, 5, 10];

function riskBadge(level: string) {
  if (level === 'high') return { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', Icon: AlertCircle };
  if (level === 'medium') return { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', Icon: AlertCircle };
  return { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400', Icon: CheckCircle2 };
}

function formatPct(v: number): string {
  return `${Number(v).toFixed(1)}%`;
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function GapPredictorPage() {
  const { user } = useRequireAuth('/auth/login');

  const [region, setRegion] = useState('Đồng Nai');
  const [stepsAhead, setStepsAhead] = useState(3);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/map/gap-forecast?region=${encodeURIComponent(region)}&steps=${stepsAhead}`;
      const res = await fetchWithRetry(url, { retries: 2 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      setResult(data);
      if (data?.metadata?.degraded) {
        toast.warning(data.metadata.reason || 'Dữ liệu đang trong chế độ giảm tốc.');
      }
    } catch (err: any) {
      logger.error('Gap forecast error', err);
      setError(err?.message || 'Không thể tải dự báo khoảng trống.');
      toast.error('Tải dự báo thất bại — vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [region, stepsAhead, user]);

  // Auto-fetch on mount + when region/steps change (after first manual run).
  useEffect(() => {
    fetchForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, stepsAhead]);

  const riskRanking = useMemo(() => (result?.risk_ranking || []).slice(0, 12), [result]);
  const trends = useMemo(() => result?.trends || [], [result]);
  const meta = useMemo(() => result?.metadata || {}, [result]);
  const heatPoints = useMemo(() => result?.heat_points || [], [result]);
  const geoFeatures = useMemo(() => result?.features || [], [result]);

  // Wait until auth is resolved.
  if (!user) return null;

  return (
    <div className="h-[calc(100dvh-3.5rem)] w-full bg-background flex flex-col lg:flex-row overflow-hidden">
      {/* ── Left panel: controls + risk ranking + trends ── */}
      <div className="w-full lg:w-96 flex flex-col gap-4 p-4 lg:p-6 overflow-y-auto custom-scrollbar border-r border-border bg-card">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => window.history.back()}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            title="Quay lại bản đồ"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Flame className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Dự báo Khoảng trống Giáo dục</h1>
        </div>

        <p className="text-xs text-muted-foreground">
          Kết hợp dự báo Holt's Linear (chuỗi thời gian education_stats) +
          DBSCAN (mật độ trường/học viện) để đưa ra bản đồ rủi ro và khu vực
          cần khảo sát sớm.
        </p>

        {/* Controls */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground">Khu vực</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Số năm dự báo</label>
            <select
              value={stepsAhead}
              onChange={(e) => setStepsAhead(parseInt(e.target.value, 10))}
              className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {STEPS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s} năm</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchForecast}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Đang dự báo…
              </>
            ) : (
              <>
                <BrainCircuit className="w-4 h-4" /> Làm mới dự báo
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

        {/* Methodology transparency (feature importance + formula) */}
        {result && (
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
              <Info className="w-3.5 h-3.5" />
              <span>Công thức rủi ro</span>
            </div>
            <div className="text-[10px] text-muted-foreground/80 space-y-0.5">
              <div>risk_score = 0.4·growth_risk + 0.3·density_gap + 0.3·access_risk</div>
              <div>• growth_risk: giảm trưởng dương tính (Holt's Linear, α=0.3, β=0.1)</div>
              <div>• density_gap: nghịch đảo mật độ cơ sở giáo dục trong vùng</div>
              <div>• access_risk: khoảng cách đến cơ sở giáo dục gần nhất</div>
              <div>
                Cache: {meta.cached ? 'cache' : 'mới'} · DBSCAN ≤{2000} pts ·
                dự báo {meta.steps_ahead} năm
              </div>
            </div>
          </div>
        )}

        {/* Trend summary */}
        {trends.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Trend chỉ số giáo dục</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {trends.map((t: any) => {
                const b = riskBadge(t.risk_level || 'low');
                return (
                  <div key={t.metric_type} className={`p-2 rounded border ${b.bg} ${b.border}`}>
                    <div className="font-medium text-foreground">{t.metric_type}</div>
                    <div className="text-muted-foreground/70">
                      {t.growth_pct >= 0 ? '+' : ''}{t.growth_pct}%/năm
                    </div>
                    <div className={b.text}>rủi ro {formatPct(t.risk_score * 100)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Risk ranking */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Flame className="w-3.5 h-3.5" />
            <span>Bảng xếp hạng khu vực nguy cơ</span>
          </div>
          {riskRanking.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/65">Chưa có dữ liệu.</p>
          ) : (
            <div className="space-y-1">
              {riskRanking.map((r: any, i: number) => {
                const b = riskBadge(r.risk_level || 'low');
                return (
                  <div key={`${r.area}:${i}`} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-muted-foreground/60 text-right">{i + 1}.</span>
                    <span className={`w-2 h-2 rounded-full ${r.risk_level === 'high' ? 'bg-red-400' : r.risk_level === 'medium' ? 'bg-amber-400' : 'bg-green-400'}`} />
                    <span className="flex-1 font-medium text-foreground truncate">{r.area}</span>
                    <span className={`font-bold ${b.text}`}>{formatPct(r.risk_score * 100)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Needs-survey zones */}
        {result && geoFeatures.filter((f: any) => f.properties?.needs_survey).length > 0 && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <ExternalLink className="w-4 h-4 text-primary" />
              <span>Khu vực đề xuất khảo sát</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {geoFeatures
                .filter((f: any) => f.properties?.needs_survey)
                .slice(0, 6)
                .map((f: any, i: number) => (
                  <li key={`survey-${i}`} className="flex items-start gap-2">
                    <MapPin className="w-3 h-3 text-destructive mt-0.5" />
                    <span>
                      {f.properties.area} — rủi ro{' '}
                      {formatPct((f.properties.risk_score_pct) || (f.properties.risk_score * 100))}
                      {' '}
                      <span className="opacity-70">
                        ({f.properties.trend})
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {error && !result && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Right panel: risk heatmap map ── */}
      <div className="flex-1 relative">
        <GapPredictorMap data={result} loading={loading || (!result && !error)} error={error} />
        {/* Heat intensity legend */}
        {result && heatPoints.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2.5 py-1.5 bg-card/90 border border-border rounded-lg shadow text-[10px] text-muted-foreground">
            <Flame className="w-3 h-3 text-red-400" />
            <span>Mực độ rủi ro:</span>
            <span className="font-medium text-green-400">thấp</span>
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
