"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Download,
  Info,
  Layers,
  Lightbulb,
  MessageSquare,
  Minus,
  RefreshCw,
  Route,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import SectionHeader from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { analyticsService } from "@/reporting/services/analytics.service";
import { cn } from "@/lib/utils";

/* ───────────────────────────── Types ───────────────────────────── */

type HistoricalPoint = {
  year: number;
  metric_value: number;
};

type Sector = {
  name: string;
  growth_pct: number;
  prediction_2025: number;
  latest_value: number;
  historical: HistoricalPoint[];
};

type TrendingSkill = {
  name: string;
  growth?: string;
  count?: number;
};

type Insights = {
  average_annual_growth_pct?: number;
  prediction_2025_it_students?: number;
  top_user_activity?: string;
  conclusion?: string;
  data_points?: number;
};

type TrendsPayload = {
  success?: boolean;
  status?: string;
  historical_data?: HistoricalPoint[];
  sectors?: Sector[];
  insights?: Insights;
  trending_skills?: TrendingSkill[];
};

/* ─────────────────────────── Helpers ──────────────────────────── */

const SECTOR_LABELS: Record<string, string> = {
  "Enrollment Rate": "Tỷ lệ nhập học",
  "Graduation Rate": "Tỷ lệ tốt nghiệp",
  "STEM Lab Usage": "Sử dụng phòng STEM",
  "Online Learning Adoption": "Học trực tuyến",
};

const sectorLabel = (name: string) => SECTOR_LABELS[name] ?? name;

const fmtPct = (value: number, digits = 1) =>
  Number.isFinite(value) ? `${value.toFixed(digits)}%` : "—";

const fmtSigned = (value: number) =>
  Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(2)}%` : "—";

const fmtInt = (value: number) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("vi-VN").format(Math.round(value))
    : "—";

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isRateSector = (sector: Sector | null | undefined) =>
  !!sector &&
  sector.historical.length > 0 &&
  sector.historical.every((p) => p.metric_value >= 0 && p.metric_value <= 100);

const normalizeSectors = (raw: any[] | undefined): Sector[] =>
  (raw ?? [])
    .map((s) => {
      const historical: HistoricalPoint[] = (s?.historical ?? [])
        .map((p: any) => ({
          year: Number(p?.year),
          metric_value: Number(p?.metric_value ?? p?.value ?? 0),
        }))
        .filter(
          (p: HistoricalPoint) =>
            Number.isFinite(p.year) && Number.isFinite(p.metric_value),
        )
        .sort((a: HistoricalPoint, b: HistoricalPoint) => a.year - b.year);

      return {
        name: String(s?.name ?? "Khác"),
        growth_pct: toNumber(s?.growth_pct),
        prediction_2025: toNumber(s?.prediction_2025),
        latest_value: toNumber(
          s?.latest_value ?? historical[historical.length - 1]?.metric_value,
        ),
        historical,
      };
    })
    .filter((s) => s.historical.length > 0);

const parseShare = (skill: TrendingSkill, total: number) => {
  const raw = Number(String(skill.growth ?? "").replace(/[+%]/g, ""));
  if (Number.isFinite(raw) && raw > 0) return raw;
  const count = Number(skill.count) || 0;
  return total > 0 ? (count / total) * 100 : 0;
};

const ACTION_LINK =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/* ───────────────────────── Small pieces ───────────────────────── */

function GrowthBadge({ value }: { value: number }) {
  const neutral = Math.abs(value) < 0.005;
  const positive = value > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        neutral
          ? "bg-muted text-muted-foreground"
          : positive
            ? "bg-accent/15 text-accent"
            : "bg-destructive/10 text-destructive",
      )}
    >
      {neutral ? (
        <Minus className="h-3 w-3" />
      ) : positive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {fmtSigned(value)}
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone?: "primary" | "accent" | "muted";
}) {
  const toneClass =
    tone === "accent"
      ? "bg-accent/15 text-accent"
      : tone === "muted"
        ? "bg-muted text-muted-foreground"
        : "bg-primary/10 text-primary";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          {hint && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            toneClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "positive"
            ? "text-accent"
            : tone === "negative"
              ? "text-destructive"
              : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ──────────────────────────── Chart ──────────────────────────── */

function SectorTrendChart({
  sector,
  forecastYear,
}: {
  sector: Sector;
  forecastYear: number;
}) {
  const points = sector.historical;
  const isRate = isRateSector(sector);
  const suffix = isRate ? "%" : "";
  const forecast = Number(sector.prediction_2025);
  const hasForecast = Number.isFinite(forecast) && forecast > 0;

  const values = [
    ...points.map((p) => p.metric_value),
    ...(hasForecast ? [forecast] : []),
  ];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max(isRate ? 2 : 1, (rawMax - rawMin) * 0.3);
  const yMin = Math.max(0, Math.floor(rawMin - pad));
  const yMax = isRate ? Math.min(100, Math.ceil(rawMax + pad)) : Math.ceil(rawMax + pad);
  const span = Math.max(1, yMax - yMin);

  const W = 720;
  const H = 280;
  const M = { top: 30, right: 28, bottom: 42, left: 58 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const xYears = hasForecast
    ? [...points.map((p) => p.year), forecastYear]
    : points.map((p) => p.year);

  const x = (year: number) => {
    const idx = xYears.indexOf(year);
    return M.left + (xYears.length <= 1 ? plotW / 2 : (idx / (xYears.length - 1)) * plotW);
  };
  const y = (value: number) =>
    M.top + plotH - ((value - yMin) / span) * plotH;

  const linePath = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${x(p.year).toFixed(2)} ${y(p.metric_value).toFixed(2)}`,
    )
    .join(" ");

  const baseline = (M.top + plotH).toFixed(2);
  const areaPath = points.length
    ? `${linePath} L ${x(points[points.length - 1].year).toFixed(2)} ${baseline} L ${x(points[0].year).toFixed(2)} ${baseline} Z`
    : "";

  const last = points[points.length - 1];
  const forecastPath =
    hasForecast && last
      ? `M ${x(last.year).toFixed(2)} ${y(last.metric_value).toFixed(2)} L ${x(forecastYear).toFixed(2)} ${y(forecast).toFixed(2)}`
      : "";

  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (span * i) / 4);
  const tickDigits = span <= 5 ? 1 : 0;

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Diễn biến ${sectorLabel(sector.name)} từ ${points[0]?.year} đến ${last?.year}${hasForecast ? `, dự báo ${forecastYear} là ${forecast}${suffix}` : ""}`}
      >
        <defs>
          <linearGradient
            id="sectorArea"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
            className="text-primary"
          >
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : "3 4"}
            />
            <text
              x={M.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize={11}
              className="fill-muted-foreground"
            >
              {tick.toFixed(tickDigits)}
              {suffix}
            </text>
          </g>
        ))}

        {areaPath && <path d={areaPath} fill="url(#sectorArea)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            className="stroke-primary"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {forecastPath && (
          <path
            d={forecastPath}
            fill="none"
            className="stroke-accent"
            strokeWidth={2}
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
        )}

        {points.map((p) => (
          <g key={p.year}>
            <circle
              cx={x(p.year)}
              cy={y(p.metric_value)}
              r={5}
              className="fill-card stroke-primary"
              strokeWidth={2.5}
            />
            <text
              x={x(p.year)}
              y={y(p.metric_value) - 12}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              className="fill-foreground"
            >
              {p.metric_value.toFixed(1)}
              {suffix}
            </text>
            <text
              x={x(p.year)}
              y={H - 14}
              textAnchor="middle"
              fontSize={11}
              className="fill-muted-foreground"
            >
              {p.year}
            </text>
          </g>
        ))}

        {hasForecast && last && (
          <g>
            <circle
              cx={x(forecastYear)}
              cy={y(forecast)}
              r={5}
              className="fill-card stroke-accent"
              strokeWidth={2.5}
              strokeDasharray="3 2"
            />
            <text
              x={x(forecastYear)}
              y={y(forecast) - 12}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              className="fill-accent"
            >
              {forecast.toFixed(0)}
              {suffix}
            </text>
            <text
              x={x(forecastYear)}
              y={H - 14}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              className="fill-accent"
            >
              {forecastYear}*
            </text>
          </g>
        )}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" /> Thực tế
        </span>
        {hasForecast && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" /> Dự báo {forecastYear}
          </span>
        )}
        <span>
          * Ngoại suy từ CAGR {points[0]?.year}–{last?.year}
        </span>
      </figcaption>
    </figure>
  );
}

/* ───────────────────────── Sector table ───────────────────────── */

function SectorTable({
  sectors,
  selected,
  onSelect,
  forecastYear,
}: {
  sectors: Sector[];
  selected: string | null;
  onSelect: (name: string) => void;
  forecastYear: number;
}) {
  const years = useMemo(
    () =>
      Array.from(
        new Set(sectors.flatMap((s) => s.historical.map((p) => p.year))),
      ).sort((a, b) => a - b),
    [sectors],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <caption className="sr-only">
          So sánh các chỉ số theo năm, tốc độ tăng trưởng kép và dự báo
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="py-3 pr-4 font-semibold">
              Chỉ số
            </th>
            {years.map((year) => (
              <th
                key={year}
                scope="col"
                className="px-4 py-3 text-right font-semibold"
              >
                {year}
              </th>
            ))}
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              CAGR
            </th>
            <th scope="col" className="py-3 pl-4 text-right font-semibold">
              Dự báo {forecastYear}
            </th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((sector) => {
            const active = selected === sector.name;
            const isRate = isRateSector(sector);

            return (
              <tr
                key={sector.name}
                className={cn(
                  "border-b border-border/60 transition-colors last:border-0",
                  active ? "bg-primary/5" : "hover:bg-muted/40",
                )}
              >
                <th scope="row" className="py-3 pr-4 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onSelect(sector.name)}
                    aria-pressed={active}
                    className="group inline-flex flex-col items-start gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span
                      className={cn(
                        "font-medium",
                        active
                          ? "text-primary"
                          : "text-foreground group-hover:text-primary",
                      )}
                    >
                      {sectorLabel(sector.name)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {sector.name}
                    </span>
                  </button>
                </th>

                {years.map((year) => {
                  const point = sector.historical.find((p) => p.year === year);
                  return (
                    <td
                      key={year}
                      className="px-4 py-3 text-right tabular-nums text-foreground/80"
                    >
                      {point
                        ? `${point.metric_value.toFixed(1)}${isRate ? "%" : ""}`
                        : "—"}
                    </td>
                  );
                })}

                <td className="px-4 py-3 text-right">
                  <GrowthBadge value={sector.growth_pct} />
                </td>
                <td className="py-3 pl-4 text-right font-medium tabular-nums text-foreground">
                  {sector.prediction_2025.toFixed(0)}
                  {isRate ? "%" : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────── Skill list ───────────────────────── */

function SkillList({ skills }: { skills: TrendingSkill[] }) {
  const counts = skills.map((s) => Number(s.count) || 0);
  const maxCount = Math.max(...counts, 1);
  const total = counts.reduce((sum, n) => sum + n, 0);

  return (
    <ul className="space-y-1">
      {skills.map((skill, idx) => {
        const count = Number(skill.count) || 0;
        const share = parseShare(skill, total);
        const width = Math.max(6, Math.round((count / maxCount) * 100));

        return (
          <li key={`${skill.name}-${idx}`}>
            <Link
              href={`/career/jobs?skill=${encodeURIComponent(skill.name)}`}
              aria-label={`Tìm việc làm yêu cầu kỹ năng ${skill.name}`}
              className="group block rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {String(idx + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                      {skill.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {count} tin
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/80 transition-all group-hover:bg-primary"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-primary">
                      {share.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────────────────────── Page ──────────────────────────── */

export default function AITrendsPage() {
  const [data, setData] = useState<TrendsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await analyticsService.getAiTrends();
      const ok =
        response?.success === true ||
        response?.status === "success" ||
        response?.status === "online";

      if (!ok) {
        throw new Error("Dịch vụ AI trả về dữ liệu không hợp lệ.");
      }

      const sectors = normalizeSectors(response.sectors);
      const skills = (response.trending_skills ?? []).filter(
        (skill: TrendingSkill) => skill?.name,
      );

      setData({
        ...response,
        sectors,
        trending_skills: skills,
      });
      setLastUpdated(new Date());
      setSelectedSector((current) => {
        if (current && sectors.some((s) => s.name === current)) return current;
        return sectors[0]?.name ?? null;
      });

      if (silent) toast.success("Đã cập nhật dữ liệu xu hướng");
    } catch (err: any) {
      const message =
        err?.message || "Không thể kết nối dịch vụ AI. Vui lòng thử lại.";
      setError(message);
      if (silent) toast.error("Không thể cập nhật dữ liệu");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    analyticsService.trackEvent("view_ai_trends", {
      timestamp: new Date().toISOString(),
    });
    fetchData();
  }, [fetchData]);

  const sectors = data?.sectors ?? [];
  const skills = data?.trending_skills ?? [];
  const insights = data?.insights ?? {};

  const selected =
    sectors.find((s) => s.name === selectedSector) ?? sectors[0] ?? null;

  const allYears = useMemo(
    () =>
      Array.from(
        new Set(sectors.flatMap((s) => s.historical.map((p) => p.year))),
      ).sort((a, b) => a - b),
    [sectors],
  );

  const forecastYear = allYears.length
    ? allYears[allYears.length - 1] + 1
    : new Date().getFullYear() + 1;

  const selectedForecastYear = selected?.historical.length
    ? Math.max(...selected.historical.map((p) => p.year)) + 1
    : forecastYear;

  const avgGrowth = Number(insights.average_annual_growth_pct ?? 0);
  const prediction = Number(insights.prediction_2025_it_students ?? 0);
  const dataPoints = Number(insights.data_points ?? 0);

  const predictionSector =
    sectors.find((s) => /it|enroll|tuyển sinh/i.test(s.name)) ?? sectors[0] ?? null;

  const predictionIsRate = isRateSector(predictionSector);
  const predictionDisplay = predictionSector
    ? predictionIsRate
      ? fmtPct(prediction, 0)
      : fmtInt(prediction)
    : "—";

  const fastest =
    sectors.length > 0
      ? sectors.reduce((a, b) => (b.growth_pct > a.growth_pct ? b : a))
      : null;

  const slowest =
    sectors.length > 0
      ? sectors.reduce((a, b) => (b.growth_pct < a.growth_pct ? b : a))
      : null;

  const topSkill = skills[0];
  const totalMentions = skills.reduce(
    (sum, skill) => sum + (Number(skill.count) || 0),
    0,
  );

  const hasData = sectors.length > 0 || skills.length > 0;

  const yearsLabel = allYears.length
    ? `${allYears[0]}–${allYears[allYears.length - 1]}`
    : "—";

  const localizedConclusion = useMemo(() => {
    let text = insights.conclusion || "";
    // The backend groups education metrics and calls them "sectors". In the
    // UI they are indicators (chỉ số), so keep the wording accurate even if
    // an older backend still returns the original sentence.
    text = text.split("các ngành").join("các chỉ số");
    Object.entries(SECTOR_LABELS).forEach(([en, vi]) => {
      text = text.split(en).join(vi);
    });
    return text;
  }, [insights.conclusion]);

  const exportCsv = () => {
    if (!hasData) return;

    const rows: (string | number)[][] = [
      ["Chỉ số", ...allYears.map(String), "CAGR (%)", `Dự báo ${forecastYear} (%)`],
      ...sectors.map((sector) => [
        sectorLabel(sector.name),
        ...allYears.map(
          (year) =>
            sector.historical.find((p) => p.year === year)?.metric_value ?? "",
        ),
        sector.growth_pct,
        sector.prediction_2025,
      ]),
      [],
      ["Kỹ năng", "Số tin tuyển dụng", "Tỷ lệ yêu cầu (%)"],
      ...skills.map((skill) => [
        skill.name,
        skill.count ?? "",
        String(skill.growth ?? "").replace("+", ""),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `edumap-xu-huong-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    toast.success("Đã xuất dữ liệu CSV");
  };

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <main className="w-full min-h-full px-6 py-8 md:px-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Skeleton className="h-[430px] rounded-xl xl:col-span-2" />
          <Skeleton className="h-[430px] rounded-xl" />
        </div>
        <Skeleton className="h-52 rounded-xl" />
      </main>
    );
  }

  return (
    <main className="w-full min-h-full px-6 py-8 md:px-8 space-y-6">
      <SectionHeader
        title="Xu hướng thị trường"
        subtitle="Diễn biến giáo dục 2022–2024 và nhu cầu kỹ năng từ các tin tuyển dụng đang hoạt động."
        icon={TrendingUp}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("h-4 w-4", refreshing && "animate-spin")}
              />
              {refreshing ? "Đang tải…" : "Tải lại"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!hasData}
            >
              <Download className="h-4 w-4" />
              Xuất CSV
            </Button>

            <Link
              href="/career/roadmap"
              className={cn(
                ACTION_LINK,
                "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <Route className="h-4 w-4" />
              Xem lộ trình
            </Link>
          </div>
        }
      />

      {/* Data provenance — be explicit that this is seeded/demo data, not a
          live market feed. The education metrics are curated seed rows and
          the skill counts come from the sample job postings in the DB. */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Dữ liệu mẫu:</span>{" "}
          Chỉ số giáo dục 2022–2024 được seed trong CSDL của EduMap; kỹ năng
          được tổng hợp từ các tin tuyển dụng mẫu đang hoạt động. Đây không
          phải số liệu thị trường trực tiếp.
        </p>
      </div>

      {/* Error banner — keeps stale data visible when a refresh fails. */}
      {error && (
        <div className="flex flex-col gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Không tải được dữ liệu xu hướng
            </p>
            <p className="mt-0.5 break-words text-xs text-muted-foreground">
              {error}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchData()}
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </Button>
        </div>
      )}

      {!hasData ? (
        error ? null : (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              Chưa có dữ liệu xu hướng
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Hệ thống chưa có điểm dữ liệu <code>education_stats</code> hoặc tin
              tuyển dụng đang hoạt động. Hãy đồng bộ dữ liệu rồi thử lại.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={() => fetchData()}
            >
              <RefreshCw className="h-4 w-4" />
              Tải lại
            </Button>
          </div>
        )
      ) : (
        <>
          {/* KPI row */}
          <section
            aria-label="Chỉ số tổng quan"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <KpiCard
              label="Tăng trưởng TB/năm"
              value={fmtSigned(avgGrowth)}
              hint={`CAGR ${yearsLabel}`}
              icon={TrendingUp}
              tone={avgGrowth >= 0 ? "accent" : "muted"}
            />
            <KpiCard
              label="Chỉ số đang theo dõi"
              value={String(sectors.length)}
              hint={`${fmtInt(dataPoints)} điểm dữ liệu`}
              icon={Layers}
            />
            <KpiCard
              label={`Dự báo ${forecastYear}`}
              value={predictionDisplay}
              hint={
                predictionSector
                  ? sectorLabel(predictionSector.name)
                  : "Chưa có dữ liệu"
              }
              icon={Sparkles}
            />
            <KpiCard
              label="Kỹ năng nổi bật"
              value={String(skills.length)}
              hint={topSkill ? `${topSkill.name} dẫn đầu` : "Chưa có dữ liệu"}
              icon={Zap}
              tone="accent"
            />
          </section>

          {/* Chart + skills */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6 xl:col-span-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Diễn biến theo chỉ số
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Chọn một chỉ số bên dưới để xem xu hướng và dự báo.
                </p>
              </div>

              {sectors.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Chọn chỉ số
                  </p>
                  <div
                    role="group"
                    aria-label="Chọn chỉ số để xem biểu đồ"
                    className="flex flex-wrap gap-2"
                  >
                    {sectors.map((sector) => {
                      const active = selected?.name === sector.name;
                      return (
                        <button
                          key={sector.name}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedSector(sector.name)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            active
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground",
                          )}
                        >
                          {sectorLabel(sector.name)}
                          <span
                            className={cn(
                              "tabular-nums",
                              sector.growth_pct > 0
                                ? "text-accent"
                                : sector.growth_pct < 0
                                  ? "text-destructive"
                                  : "text-muted-foreground",
                            )}
                          >
                            {fmtSigned(sector.growth_pct)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selected ? (
                <>
                  <div className="mt-5">
                    <SectorTrendChart
                      sector={selected}
                      forecastYear={selectedForecastYear}
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-3">
                    <Metric
                      label="Giá trị gần nhất"
                      value={`${selected.latest_value.toFixed(1)}${isRateSector(selected) ? "%" : ""}`}
                      hint={
                        selected.historical.length
                          ? `Năm ${selected.historical[selected.historical.length - 1].year}`
                          : undefined
                      }
                    />
                    <Metric
                      label="Tăng trưởng kép"
                      value={fmtSigned(selected.growth_pct)}
                      hint={`CAGR ${yearsLabel}`}
                      tone={
                        selected.growth_pct > 0
                          ? "positive"
                          : selected.growth_pct < 0
                            ? "negative"
                            : undefined
                      }
                    />
                    <Metric
                      label={`Dự báo ${selectedForecastYear}`}
                      value={`${selected.prediction_2025.toFixed(0)}${isRateSector(selected) ? "%" : ""}`}
                      hint="Ngoại suy từ CAGR"
                    />
                  </div>
                </>
              ) : (
                <p className="mt-8 text-sm text-muted-foreground">
                  Chưa có dữ liệu chỉ số nào.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Kỹ năng được săn đón
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {totalMentions > 0
                      ? `${fmtInt(totalMentions)} lượt yêu cầu kỹ năng`
                      : "Từ tin tuyển dụng đang hoạt động"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {skills.length} kỹ năng
                </span>
              </div>

              <div className="mt-4">
                {skills.length > 0 ? (
                  <SkillList skills={skills} />
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Chưa có dữ liệu kỹ năng từ tin tuyển dụng.
                  </p>
                )}
              </div>

              <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                Tỷ lệ = phần trăm tổng lượt yêu cầu kỹ năng trong các tin đang
                hoạt động. Nhấn vào một kỹ năng để tìm việc làm phù hợp.
              </p>
            </div>
          </section>

          {/* Sector comparison */}
          {sectors.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    So sánh các chỉ số
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nhấn vào tên chỉ số để đưa chỉ số đó lên biểu đồ.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  CAGR = tốc độ tăng trưởng kép hàng năm
                </p>
              </div>

              <SectorTable
                sectors={sectors}
                selected={selected?.name ?? null}
                onSelect={setSelectedSector}
                forecastYear={forecastYear}
              />
            </section>
          )}

          {/* AI insight */}
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Lightbulb className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Điểm chính từ dữ liệu
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                  {localizedConclusion ||
                    "Chưa có nhận định. Hãy tải lại dữ liệu để xem điểm chính mới."}
                </p>

                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {fastest && (
                    <li className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm">
                      <span className="text-muted-foreground">
                        Chỉ số tăng nhanh nhất:{" "}
                      </span>
                      <span className="font-medium text-foreground">
                        {sectorLabel(fastest.name)}
                      </span>{" "}
                      <span className="font-medium text-accent">
                        {fmtSigned(fastest.growth_pct)}
                      </span>
                    </li>
                  )}

                  {slowest && slowest.name !== fastest?.name && (
                    <li className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm">
                      <span className="text-muted-foreground">
                        Chỉ số cần chú ý:{" "}
                      </span>
                      <span className="font-medium text-foreground">
                        {sectorLabel(slowest.name)}
                      </span>{" "}
                      <span
                        className={cn(
                          "font-medium",
                          slowest.growth_pct < 0
                            ? "text-destructive"
                            : "text-accent",
                        )}
                      >
                        {fmtSigned(slowest.growth_pct)}
                      </span>
                    </li>
                  )}

                  {topSkill && (
                    <li className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm">
                      <span className="text-muted-foreground">
                        Kỹ năng dẫn đầu:{" "}
                      </span>
                      <span className="font-medium text-foreground">
                        {topSkill.name}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        ({topSkill.count ?? 0} tin)
                      </span>
                    </li>
                  )}

                  <li className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm">
                    <span className="text-muted-foreground">
                      Điểm dữ liệu:{" "}
                    </span>
                    <span className="font-medium text-foreground">
                      {fmtInt(dataPoints)}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      ({yearsLabel})
                    </span>
                  </li>
                </ul>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href="/career/roadmap"
                    className={cn(
                      ACTION_LINK,
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    <Route className="h-4 w-4" />
                    Xem lộ trình gợi ý
                  </Link>

                  <Link
                    href={
                      topSkill
                        ? `/career/jobs?skill=${encodeURIComponent(topSkill.name)}`
                        : "/career/jobs"
                    }
                    className={cn(
                      ACTION_LINK,
                      "border border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    <Briefcase className="h-4 w-4" />
                    Tìm việc làm
                  </Link>

                  <Link
                    href="/ai-chat"
                    className={cn(
                      ACTION_LINK,
                      "border border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Hỏi trợ lý AI
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Data provenance */}
          <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
            <span>
              Nguồn:{" "}
              <span className="text-foreground/70">education_stats</span> (dữ
              liệu mẫu) + <span className="text-foreground/70">jobs</span> (tin
              mẫu đang hoạt động)
            </span>
            <span>Giai đoạn: {yearsLabel}</span>
            <span>{fmtInt(dataPoints)} điểm dữ liệu</span>
            {lastUpdated && (
              <span>
                Cập nhật lúc{" "}
                {lastUpdated.toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </footer>
        </>
      )}
    </main>
  );
}
