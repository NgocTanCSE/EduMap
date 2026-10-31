"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3, RefreshCw, Download, CheckCircle2, TrendingUp,
  MapPin, Users, Clock, Award,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useRequireAuth } from "@/src/lib/require-auth";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { impactMeasurementService, type ImpactReport, type RegionParams } from "@/reporting/services/impact-measurement.service";

/*
 * AI Impact Measurement — Idea #19 (MEDIUM-HIGH)
 *
 * Measures whether a deployment (wifi spots, libraries, STEM labs…) actually
 * improved educational *access*. Renders dependency-free SVG charts (chart.js
 * is NOT installed on the HF free plan; d3 is, but plain SVG keeps the bundle
 * tiny and avoids runtime regressions).
 *
 * Data policy (AGENTS.md §6): only real Vietnamese facilities from the verified
 * `map_points` table — no fabricated organisations. When "before" data is
 * missing, the backend/ai-service uses a transparent synthetic baseline
 * (population × 0.70) and flags it with `degraded: true`.
 */

// Biên Hòa city core — the real EduMap facility cluster.
const DEFAULT_BBOX = { minLat: 10.9, maxLat: 11.0, minLng: 106.8, maxLng: 107.0 };

function fmt(n: number | undefined | null, digits = 1): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("vi-VN", { maximumFractionDigits: digits });
}
function fmtPct(v: number | undefined | null, digits = 1): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return `${Number(v).toFixed(digits)}%`;
}
function fmtNumber(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("vi-VN");
}

export default function ImpactMeasurementPage() {
  const { user } = useRequireAuth("/auth/login");

  const [params, setParams] = useState<RegionParams>({ ...DEFAULT_BBOX, deploymentDate: "2025-01-01", region: "Biên Hòa, Đồng Nai" });
  const [report, setReport] = useState<ImpactReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Check if current params target the default Đồng Nai region that the
  // auto-scheduler pre-computes (so we can serve cached results instantly).
  const isDefaultRegion = params.region === "Biên Hòa, Đồng Nai";

  const fetchReport = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // ── Try auto-scheduler cached result first (instant, no LLM wait) ──
      // The auto-scheduler pre-computes impact reports for key regions every
      // 24h. If the current region matches one of the cached regions, return
      // the cached report immediately.
      if (isDefaultRegion) {
        try {
          const cached = await impactMeasurementService.getCachedMeasure("dong_nai");
          if (cached && !cached.degraded && cached.data !== undefined) {
            setReport(cached.data || cached);
            setFromCache(true);
            if (cached.degraded) {
              toast.info(cached.reason || "Dữ liệu đang được cập nhật.");
            }
            return;
          }
          // If cache exists but degraded/empty → fall through to on-demand
        } catch {
          // Non-fatal — fall through to on-demand computation
        }
      }

      // ── Fallback: on-demand computation (T1 backend diff + T2 ai-service) ──
      setFromCache(false);
      const data = await impactMeasurementService.getMeasure(params);
      setReport(data);
      if (data?.degraded) {
        toast.info(data.reason || "Dữ liệu đang được cập nhật.");
      }
    } catch (err: any) {
      logger.error("Impact measure fetch error", err);
      setError(err?.message || "Không thể tải báo cáo đo lường tác động.");
      toast.error("Tải báo cáo thất bại — vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [params, user, isDefaultRegion]);

  // Auto-fetch on mount + when region/date changes.
  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.deploymentDate, params.region, params.minLat, params.maxLat, params.minLng, params.maxLng, params.lat, params.lng, params.radiusKm, user]);

  // ── Derived display values ───────────────────────────────────────────────
  const b = report?.before;
  const a = report?.after;
  const score = report?.impact_score ?? 0;
  const ci = report?.confidence_interval;
  const ciHalf = ci ? (ci.upper - ci.lower) / 2 : 0;
  const ciCenter = ci ? (ci.lower + ci.upper) / 2 : 0;
  const trendPoints = report?.trend?.monthly ?? [];
  const maxCumulative = Math.max(...trendPoints.map(p => Number((p as any).cumulative) || 0), 1);
  const maxBar = Math.max(b?.access_rate ?? 0, a?.access_rate ?? 0, 0.0001);

  // ── SVG helpers ───────────────────────────────────────────────────────────
  const ScoreGaugeSvg = () => {
    const r = 80;
    const cx = 100;
    const cy = 100;
    const pct = Math.max(0, Math.min(100, score)) / 100;
    const dash = 2 * Math.PI * r;
    const offset = dash * (1 - pct);
    // CI band as a translucent arc (±half around the score centre).
    const ciLoPct = Math.max(0, Math.min(100, ciCenter - ciHalf)) / 100;
    const ciHiPct = Math.max(0, Math.min(100, ciCenter + ciHalf)) / 100;
    const ciOffsetLo = dash * (1 - ciHiPct); // arc drawn from hi to lo (reverse) for the band
    const bandLen = dash * (ciHiPct - ciLoPct);
    return (
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e71f3" strokeWidth="16" />
        {/* CI band (faint) */}
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#93c5fd" strokeWidth="16"
          strokeDasharray={`${bandLen} ${dash}`}
          strokeDashoffset={dash * (1 - ciHiPct)}
          transform={`rotate(180 ${cx} ${cy})`}
          opacity={ci ? 0.35 : 0}
        />
        {/* Score arc */}
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#2563eb" strokeWidth="16"
          strokeDasharray={`${dash} ${dash}`}
          strokeDashoffset={offset}
          transform={`rotate(180 ${cx} ${cy})`}
          strokeLinecap="round"
        />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
          className="fill-foreground font-bold text-3xl">{Math.round(score)}</text>
        <text x={cx} y={cy + 20} textAnchor="middle" dominantBaseline="middle"
          className="fill-muted-foreground text-xs">/100</text>
        <text x={cx} y={cy + 42} textAnchor="middle" dominantBaseline="middle"
          className="fill-muted-foreground text-[10px]">
          {ci ? `CI ${fmtPct(ci.lower, 0)}–${fmtPct(ci.upper, 0)}%` : ""}
        </text>
      </svg>
    );
  };

  const BarChartSvg = () => {
    const baseW = 220;
    const baseH = 150;
    const pad = 24;
    const innerW = baseW - pad * 2;
    const innerH = baseH - pad - 12;
    const barW = innerW / 2.4;
    const gap = innerW / 2.4;
    const beforeH = (b?.access_rate ?? 0) / maxBar * innerH;
    const afterH = (a?.access_rate ?? 0) / maxBar * innerH;
    const yMax = maxBar;
    const ticks = [0, 0.25, 0.5, 0.75, 1.0];
    return (
      <svg width={baseW} height={baseH} viewBox={`0 0 ${baseW} ${baseH}`} className="w-full h-auto">
        {/* y-axis grid + ticks */}
        {ticks.map(t => {
          const y = pad + innerH - t * innerH;
          return (
            <g key={t}>
              <line x1={pad} y1={y} x2={pad + innerW} y2={y} stroke="#e5e71f2" strokeWidth={1} />
              <text x={pad - 4} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{fmtPct(t)}</text>
            </g>
          );
        })}
        {/* axes */}
        <line x1={pad} y1={pad + innerH} x2={pad + innerW} y2={pad + innerH} stroke="#9ca3af" strokeWidth={1} />
        <line x1={pad} y1={pad} x2={pad} y2={pad + innerH} stroke="#9ca3af" strokeWidth={1} />
        {/* before bar */}
        <rect x={pad} y={pad + innerH - beforeH} width={barW} height={beforeH} rx={3}
          className="fill-amber-400/80" />
        <text x={pad + barW / 2} y={pad + innerH - beforeH - 4} textAnchor="middle" className="fill-foreground text-[9px] font-medium">{fmtPct(b?.access_rate)}</text>
        <text x={pad + barW / 2} y={pad + innerH + 14} textAnchor="middle" className="fill-muted-foreground text-[9px]">Trước</text>
        {/* after bar */}
        <rect x={pad + gap} y={pad + innerH - afterH} width={barW} height={afterH} rx={3}
          className="fill-sky-400/90" />
        <text x={pad + gap + barW / 2} y={pad + innerH - afterH - 4} textAnchor="middle" className="fill-foreground text-[9px] font-medium">{fmtPct(a?.access_rate)}</text>
        <text x={pad + gap + barW / 2} y={pad + innerH + 14} textAnchor="middle" className="fill-muted-foreground text-[9px]">Sau</text>
        {/* y-axis label */}
        <text x={pad - 8} y={pad - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]" transform={`rotate(-90 ${pad - 8} ${pad - 6})`}>Tỉ lệ tiếp cận</text>
      </svg>
    );
  };

  const TrendSvg = () => {
    if (!trendPoints.length) {
      return <p className="text-sm text-muted-foreground">Chưa có dữ liệu thời gian triển khai.</p>;
    }
    const baseW = 360;
    const baseH = 130;
    const pad = 24;
    const innerW = baseW - pad * 2;
    const innerH = baseH - pad - 16;
    const n = trendPoints.length;
    const x = (i: number) => pad + (innerW * i) / Math.max(n - 1, 1);
    const y = (v: number) => pad + innerH - (v / maxCumulative) * innerH;
    const pts = trendPoints.map((p, i) => `${x(i)},${y(Number((p as any).cumulative) || 0)}`).join(" ");
    const areaPts = `${pts} ${x(n - 1)},${pad + innerH} ${x(0)},${pad + innerH}`;
    return (
      <svg width={baseW} height={baseH} viewBox={`0 0 ${baseW} ${baseH}`} className="w-full h-auto">
        <polygon points={areaPts} className="fill-sky-200/50" />
        <polyline points={pts} fill="none" stroke="#0ea5e9" strokeWidth={2} />
        {trendPoints.map((p, i) => {
          const cx = x(i);
          const cy = y(Number((p as any).cumulative) || 0);
          return <circle key={(p as any).month} cx={cx} cy={cy} r={4} className="fill-sky-500" />;
        })}
        <line x1={pad} y1={pad + innerH} x2={pad + innerW} y2={pad + innerH} stroke="#9ca3af" strokeWidth={1} />
        <line x1={pad} y1={pad} x2={pad} y2={pad + innerH} stroke="#9ca3af" strokeWidth={1} />
        <text x={pad} y={pad - 6} className="fill-muted-foreground text-[9px]">Tích lũy cơ sở giáo dục</text>
        {trendPoints.map((p, i) => (
          <text key={(p as any).month} x={x(i)} y={pad + innerH + 12} textAnchor="middle" className="fill-muted-foreground text-[8px]">
            {(p as any).month}
          </text>
        ))}
        <text x={pad + innerW} y={pad - 6} textAnchor="end" className="fill-muted-foreground text-[9px]">
          Tăng trưởng {fmtPct(report?.trend?.growth_rate_pct, 1)}
        </text>
      </svg>
    );
  };

  const CoverageArcSvg = () => {
    // Circular arc showing coverage_improvement_pct (can be negative → red).
    const val = report?.diff?.coverage_improvement_pct ?? 0;
    const pct = Math.max(-100, Math.min(100, val));
    const color = pct >= 0 ? "#2563eb" : "#ef4444";
    const track = "#e5e71f3";
    const r = 54;
    const cx = 70;
    const cy = 70;
    const len = 2 * Math.PI * r;
    const off = len * (1 - Math.abs(pct) / 100);
    const sign = pct >= 0 ? "+" : "";
    return (
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth="12" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={`${len} ${len}`}
          strokeDashoffset={off}
          transform={`rotate(180 ${cx} ${cy})`}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
          className="fill-foreground font-bold text-2xl">{sign}{Math.round(pct)}%</text>
        <text x={cx} y={cy + 18} textAnchor="middle" dominantBaseline="middle"
          className="fill-muted-foreground text-[9px]">Cải thiện phủ sóng</text>
      </svg>
    );
  };

  // ── Region selector ───────────────────────────────────────────────────────
  const applyBbox = () => {
    setParams(p => ({ ...p, minLat: undefined, maxLat: undefined, minLng: undefined, maxLng: undefined, lat: 10.9525, lng: 106.8778, radiusKm: 15 }));
  };

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-6 rounded-2xl border border-border/80 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-2">
            <BarChart3 className="w-3.5 h-3.5" /> Impact Analytics AI
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Đo Lường Tác Động Triển Khai
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
            Đánh giá việc triển khai cơ sở giáo dục (wifi, thư viện, phòng lab STEM…) có cải thiện
            tiếp cận thực tế không — so sánh trước/sau, phân tích xu hướng và khoảng tin cậy thống kê.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={fetchReport}
            disabled={loading || !user}
            className="inline-flex items-center justify-center rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 text-xs font-bold shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới báo cáo
            {fromCache && !loading && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[9px] font-bold uppercase">
                Tự động
              </span>
            )}
          </button>
          <BookmarkButton
            targetType="impact_report"
            targetId={report?.region || "bien-hoa"}
            size="sm"
            showLabel
          />
        </div>
      </div>

      {/* Region / deployment controls card */}
      <div className="bg-card/70 p-4 sm:p-5 rounded-2xl border border-border/80 shadow-sm">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Tùy biến tọa độ & thời gian khảo sát</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Vĩ độ min</label>
            <input type="number" step="0.001" placeholder="10.850"
              className="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs focus:border-primary outline-none"
              value={params.minLat ?? ""} onChange={e => setParams({ ...params, minLat: e.target.value ? +e.target.value : undefined })} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Vĩ độ max</label>
            <input type="number" step="0.001" placeholder="11.050"
              className="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs focus:border-primary outline-none"
              value={params.maxLat ?? ""} onChange={e => setParams({ ...params, maxLat: e.target.value ? +e.target.value : undefined })} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Kinh độ min</label>
            <input type="number" step="0.001" placeholder="106.750"
              className="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs focus:border-primary outline-none"
              value={params.minLng ?? ""} onChange={e => setParams({ ...params, minLng: e.target.value ? +e.target.value : undefined })} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Kinh độ max</label>
            <input type="number" step="0.001" placeholder="106.950"
              className="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs focus:border-primary outline-none"
              value={params.maxLng ?? ""} onChange={e => setParams({ ...params, maxLng: e.target.value ? +e.target.value : undefined })} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Ngày triển khai</label>
            <input type="date"
              className="w-full h-9 px-3 bg-background border border-border rounded-xl text-xs focus:border-primary outline-none"
              value={params.deploymentDate ?? ""} onChange={e => setParams({ ...params, deploymentDate: e.target.value })} />
          </div>
          <div className="flex items-end">
            <button onClick={applyBbox} type="button"
              className="w-full h-9 px-3 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-xs transition-all flex items-center justify-center gap-1.5 border border-primary/20">
              <MapPin className="h-3.5 w-3.5" /> Biên Hòa mặc định
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive">
          {error}
        </div>
      )}

      {loading && !report && (
        <div className="py-20 text-center text-muted-foreground bg-card rounded-2xl border border-border">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-sm font-semibold text-foreground">Đang tính toán mô hình đo lường tác động AI…</p>
          <p className="text-xs text-muted-foreground mt-1">Đang đối chiếu dữ liệu tọa độ bán kính 5 km</p>
        </div>
      )}

      {!report && !loading && (
        <div className="py-16 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
          <p className="text-sm">Chọn khu vực / ngày triển khai và nhấn "Làm mới báo cáo" để khởi tạo phân tích.</p>
        </div>
      )}

      {/* Top 3 Charts Grid */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Score gauge */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm hover:shadow-md transition-all text-center flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-3">Điểm tác động AI</span>
              <div className="flex justify-center my-2">
                <ScoreGaugeSvg />
              </div>
            </div>
            <p className={`text-xs font-semibold mt-2 ${report.degraded ? "text-primary" : "text-accent"}`}>
              {report.degraded ? "Mô hình suy diễn dự phòng" : "Mô hình tính toán AI nâng cao"}
            </p>
          </div>

          {/* Before/after access-rate bars */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-3 text-center">Tỉ lệ tiếp cận (Bán kính 5 km)</span>
              <div className="flex justify-center my-2">{BarChartSvg()}</div>
            </div>
            <div className="flex gap-4 justify-center mt-3 text-xs text-muted-foreground pt-3 border-t border-border/60">
              <span className="inline-flex items-center gap-1.5 font-medium"><span className="block h-2.5 w-2.5 rounded-full bg-amber-400" /> Trước: <strong>{fmtPct(b?.access_rate)}</strong></span>
              <span className="inline-flex items-center gap-1.5 font-medium"><span className="block h-2.5 w-2.5 rounded-full bg-sky-400" /> Sau: <strong>{fmtPct(a?.access_rate)}</strong></span>
            </div>
          </div>

          {/* Coverage improvement arc */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm hover:shadow-md transition-all text-center flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-3">Mức độ cải thiện độ phủ</span>
              <div className="flex justify-center my-2">{CoverageArcSvg()}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {b?.synthetic_baseline ? "Trước: số liệu baseline tham chiếu" : "Tính toán trên dữ liệu thực tế"}
            </p>
          </div>
        </div>
      )}

      {/* Trend + People diff */}
      {report && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Trend card */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-accent/15 text-accent">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground">Xu hướng triển khai</h3>
                  <p className="text-[11px] text-muted-foreground">Tốc độ gia tăng cơ sở qua các mốc thời gian</p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                report.trend.trend === "tăng"
                  ? "bg-accent/15 text-accent border-accent/25"
                  : report.trend.trend === "giảm"
                  ? "bg-destructive/15 text-destructive border-destructive/25"
                  : "bg-muted text-muted-foreground border-border"
              }`}>
                {report.trend.trend === "tăng" ? "Tăng trưởng" : report.trend.trend} ({fmtPct(report.trend.growth_rate_pct)})
              </span>
            </div>

            <div className="my-2">
              <TrendSvg />
            </div>

            <p className="mt-3 text-xs text-muted-foreground text-center">
              Tốc độ tăng trưởng hàng kỳ đạt <strong className="text-foreground">{fmtPct(report.trend.growth_rate_pct)}</strong>
            </p>
          </div>

          {/* People in radius card - Premium redesign */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground">Người được tiếp cận</h3>
                  <p className="text-[11px] text-muted-foreground">Ước tính trong bán kính 5 km</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Bán kính 5 km
              </span>
            </div>

            {/* 3 Metric tiles */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Trước</span>
                <span className="text-lg sm:text-2xl font-bold text-foreground">{fmtNumber(report.people_in_radius?.before)}</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">người</span>
              </div>
              <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 text-center">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Sau</span>
                <span className="text-lg sm:text-2xl font-bold text-foreground">{fmtNumber(report.people_in_radius?.after)}</span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">người</span>
              </div>
              <div className={`p-3.5 rounded-xl border text-center ${
                report.people_in_radius?.delta >= 0 
                  ? 'bg-accent/10 border-accent/30 text-accent' 
                  : 'bg-destructive/10 border-destructive/30 text-destructive'
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Chênh lệch</span>
                <span className="text-lg sm:text-2xl font-bold">
                  {(report.people_in_radius?.delta >= 0 ? "+" : "") + fmtNumber(report.people_in_radius?.delta)}
                </span>
                <span className="text-[10px] block mt-0.5">người tiếp cận</span>
              </div>
            </div>

            {/* Context details chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border/70">
                <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground">Cơ sở:</span>
                <strong className="text-foreground ml-auto">{a?.facility_count} (trước {b?.facility_count})</strong>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border/70">
                <Clock className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="text-muted-foreground">Giai đoạn:</span>
                <strong className="text-foreground ml-auto">{b?.period} → {a?.period}</strong>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border/70">
                <Award className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground">Khoảng tin cậy:</span>
                <strong className="text-foreground ml-auto">[{fmtPct(ci?.lower, 0)}, {fmtPct(ci?.upper, 0)}]</strong>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border/70">
                <TrendingUp className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="text-muted-foreground">Dân số ước tính:</span>
                <strong className="text-foreground ml-auto">{fmtNumber(report.population_estimate)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Narrative + causal notes */}
      {report && (
        <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              Nhận định AI
            </span>
            <h3 className="font-bold text-sm sm:text-base text-foreground">Diễn giải tác động giáo dục</h3>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-foreground/90 p-4 bg-primary/5 border border-primary/15 rounded-xl">
            {report.narrative}
          </p>
          {report.causal_notes && report.causal_notes.length > 0 && (
            <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
              {report.causal_notes.map((note, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 pt-3 border-t border-border/70 flex items-start gap-2 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
            <span>
              Dữ liệu được đối chiếu thực từ bảng <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">map_points</code> (thư viện, wifi công cộng, phòng lab STEM, cơ sở giáo dục).
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
