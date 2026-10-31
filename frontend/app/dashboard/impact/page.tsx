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

  const fetchReport = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // The service talks to the BFF at /api/dashboard/impact (auth forwarded).
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
  }, [params, user]);

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
    <div className="page-shell max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Đo lường Tác động AI
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchReport}
            disabled={loading || !user}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <BookmarkButton
            targetType="impact_report"
            targetId={report?.region || "bien-hoa"}
            size="sm"
            showLabel
            className="inline-flex h-9 min-w-[6rem] items-center justify-center gap-2 rounded-md border border-border bg-background/70 px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          />
        </div>
      </div>

      {/* Region / deployment controls */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6">
        <input type="number" step="0.001" placeholder="min lat"
          className="form-input text-sm py-2"
          value={params.minLat ?? ""} onChange={e => setParams({ ...params, minLat: e.target.value ? +e.target.value : undefined })} />
        <input type="number" step="0.001" placeholder="max lat"
          className="form-input text-sm py-2"
          value={params.maxLat ?? ""} onChange={e => setParams({ ...params, maxLat: e.target.value ? +e.target.value : undefined })} />
        <input type="number" step="0.001" placeholder="min lng"
          className="form-input text-sm py-2"
          value={params.minLng ?? ""} onChange={e => setParams({ ...params, minLng: e.target.value ? +e.target.value : undefined })} />
        <input type="number" step="0.001" placeholder="max lng"
          className="form-input text-sm py-2"
          value={params.maxLng ?? ""} onChange={e => setParams({ ...params, maxLng: e.target.value ? +e.target.value : undefined })} />
        <input type="date"
          className="form-input text-sm py-2"
          value={params.deploymentDate ?? ""} onChange={e => setParams({ ...params, deploymentDate: e.target.value })} />
        <button onClick={applyBbox} type="button"
          className="form-button flex items-center justify-center gap-2">
          <MapPin className="h-4 w-4" />Áp dụng Biên Hòa
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !report && (
        <div className="py-12 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
          Đang tính toán báo cáo đo lường tác động…
        </div>
      )}

      {!report && !loading && (
        <div className="py-12 text-center text-muted-foreground">
          Chọn khu vực / ngày triển khai và nhấn "Làm mới" để xem báo cáo.
        </div>
      )}

      {/* Charts grid — wider gaps for breathing room (Image 10) */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Score gauge */}
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Điểm tác động AI</p>
            <div className="flex justify-center">
              <ScoreGaugeSvg />
            </div>
            <p className={`text-xs mt-1 ${report.degraded ? "text-primary" : "text-accent"}`}>
              {report.degraded ? "Tính toán giảm tốc" : "Tính toán AI"}
            </p>
          </div>

          {/* Before/after access-rate bars */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tỉ lệ tiếp cận (5 km)</p>
            <div className="flex justify-center">{BarChartSvg()}</div>
            <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="block h-2 w-4 rounded bg-amber-400" /> Trước {fmtPct(b?.access_rate)}</span>
              <span className="inline-flex items-center gap-1"><span className="block h-2 w-4 rounded bg-sky-400" /> Sau {fmtPct(a?.access_rate)}</span>
            </div>
          </div>

          {/* Coverage improvement arc */}
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Cải thiện phủ sóng</p>
            <div className="flex justify-center">{CoverageArcSvg()}</div>
            <p className="text-xs mt-1 text-muted-foreground">
              {b?.synthetic_baseline && "Trước: số liệu tham chiếu"}
            </p>
          </div>
        </div>
      )}

      {/* Trend + people diff — wider gap (Image 10) */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Xu hướng triển khai</p>
            <TrendSvg />
            <p className="mt-2 text-xs text-muted-foreground">
              {`Xu hướng: `}
              <span className={`font-medium ${report.trend.trend === "tăng" ? "text-accent" : report.trend.trend === "giảm" ? "text-destructive" : "text-muted-foreground"}`}>
                {report.trend.trend} ({fmtPct(report.trend.growth_rate_pct)})
              </span>
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Người được tiếp cận (bán kính 5 km)</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-2xl font-bold">{fmtNumber(report.people_in_radius?.before)}</p><p className="text-xs text-muted-foreground">Trước</p></div>
              <div><p className="text-2xl font-bold">{fmtNumber(report.people_in_radius?.after)}</p><p className="text-xs text-muted-foreground">Sau</p></div>
              <div className={`text-2xl font-bold ${report.people_in_radius?.delta >= 0 ? "text-accent" : "text-destructive"}`}>
                {(report.people_in_radius?.delta >= 0 ? "+" : "") + fmtNumber(report.people_in_radius?.delta)}
                <p className="text-xs text-muted-foreground font-normal">Chênh lệch</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" />Cơ sở sau: <b>{a?.facility_count}</b> (trước {b?.facility_count})</div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />Thời gian: {b?.period} → {a?.period}</div>
              <div className="flex items-center gap-2"><Award className="h-4 w-4 text-muted-foreground" />CI: [{fmtPct(ci?.lower, 0)}, {fmtPct(ci?.upper, 0)}] ({ci?.method})</div>
              <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground" />Dân số ước tính: {fmtNumber(report.population_estimate)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Narrative + causal notes */}
      {report && (
        <div className="mt-8 rounded-lg border bg-card p-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Diễn giải AI</p>
          <p className="text-sm leading-relaxed">{report.narrative}</p>
          {report.causal_notes && report.causal_notes.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {report.causal_notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5" />
            <span>
              Dữ liệu: cơ sở giáo dục thực từ bảng <code className="rounded bg-muted px-1">map_points</code> (wifi, thư viện, trường học, phòng lab…).
              Không có tổ chức giả tạo.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
