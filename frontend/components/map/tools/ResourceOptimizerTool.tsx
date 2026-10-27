/**
 * Resource Optimizer Tool (Idea #1 — AI Resource Optimizer)
 *
 * Merged into the unified Map Hub. Previously a standalone page at
 * `/map/resource-optimizer`; now the `resource-optimizer` tab on `/map`.
 *
 * Panel: budget slider + plan comparison (A/B/C) + facility list.
 * Overlay: facility markers (colored by plan tier) + gap markers + heatmap.
 */
"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  BrainCircuit, Banknote, RefreshCw, AlertCircle, Info,
  MapPin, CheckCircle2, BarChart3, Layers, ThermometerSun,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { fetchWithRetry } from "@/src/lib/fetch-with-retry";
import { unwrapApiResponse } from "@/src/lib/api-utils";
import {
  MapContainer, TileLayer, GeoJSON, Marker, Popup, Circle, useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import HeatmapLayer from "@/components/map/HeatmapLayer";
import type { ToolPanelProps, ToolOverlayProps } from "./types";

const BUDGET_OPTIONS = [
  { value: 5, label: "5 triệu" },
  { value: 15, label: "15 triệu" },
  { value: 30, label: "30 triệu" },
  { value: 50, label: "50 triệu" },
  { value: 75, label: "75 triệu" },
  { value: 100, label: "100 triệu" },
];

const PLAN_COLORS: Record<string, string> = {
  A: "#22c57e", // green
  B: "#38bdf8", // cyan
  C: "#f59e0b", // amber
};

const PLAN_LABELS: Record<string, { label: string; pct: number }> = {
  A: { label: "Kế hoạch A", pct: 40 },
  B: { label: "Kế hoạch B", pct: 70 },
  C: { label: "Kế hoạch C", pct: 100 },
};

// ── Panel ───────────────────────────────────────────────────────────────────

export function ResourceOptimizerPanel({
  viewport, result, onResult, loading, setLoading, error, setError, active,
}: ToolPanelProps) {
  const [budgetMillion, setBudgetMillion] = useState(30);

  const fetchOptimization = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("budget", String(budgetMillion * 1_000_000));
      const res = await fetchWithRetry(`/api/map/resource-optimization?${params.toString()}`, { retries: 2 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      onResult(data);
      if (data?.metadata?.degraded) {
        toast.warning(data.metadata.reason || "Dữ liệu đang trong chế độ giảm tốc.");
      } else {
        toast.success("Tối ưu vị trí thành công.");
      }
    } catch (err: any) {
      logger.error("Resource optimization error", err);
      setError(err?.message || "Không thể tải tối ưu hóa nguồn lực.");
      toast.error("Tải tối ưu thất bại — vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [budgetMillion, active, onResult, setLoading, setError]);

  useEffect(() => {
    if (active && !result) fetchOptimization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const plans = useMemo(() => result?.plans || {}, [result]);
  const gaps = useMemo(() => (result?.gaps || []), [result]);
  const summary = useMemo(() => result?.summary || {}, [result]);
  const meta = useMemo(() => result?.metadata || {}, [result]);
  const features = useMemo(() => result?.features || [], [result]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Tối ưu vị trí cơ sở giáo dụng mới bằng MCLP (Maximizing Coverage
        Location Problem) — tối đa hoá số người được phục vụ trong ngân sách.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Ngân sách: {budgetMillion} triệu VND</label>
          <select
            value={budgetMillion}
            onChange={(e) => setBudgetMillion(parseInt(e.target.value, 10))}
            className="mt-1 w-full text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {BUDGET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchOptimization} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Đang tối ưu…
            </>
          ) : (
            <>
              <Banknote className="w-4 h-4" /> Tối ưu lại
            </>
          )}
        </button>
      </div>

      {/* Degraded banner */}
      {meta.degraded && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{meta.reason || "Dữ liệu đang trong chế độ giảm tốc."}</span>
        </div>
      )}

      {/* Summary */}
      {result && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="text-2xl font-bold text-primary">{summary.candidate_count || 0}</div>
            <div className="text-[10px] text-muted-foreground">Ứng cử viên</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/20 border border-border">
            <div className="text-2xl font-bold text-destructive">{summary.demand_count || 0}</div>
            <div className="text-[10px] text-muted-foreground">Điểm cần phủ</div>
          </div>
        </div>
      )}

      {/* Plans comparison */}
      {Object.keys(plans).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Layers className="w-3.5 h-3.5" />
            <span>So sánh kế hoạch</span>
          </div>
          {Object.entries(plans).map(([planId, planData]: [string, any]) => {
            const planInfo = PLAN_LABELS[planId] || { label: planId, pct: 0 };
            const color = PLAN_COLORS[planId] || "#647493";
            const facilityCount = features.filter((f: any) => f.properties?.plan === planId).length;
            return (
              <div key={planId} className="p-3 rounded-lg bg-muted/10 border border-border space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium text-foreground">{planInfo.label}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{planInfo.pct}% ngân sách</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="text-center">
                    <div className="font-bold text-foreground">{facilityCount}</div>
                    <div className="text-muted-foreground/60">Cơ sở đề xuất</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-foreground">{planData.coverage_pct?.toFixed(0) || 0}%</div>
                    <div className="text-muted-foreground/60">Phủ sóng</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Methodology */}
      {result && (
        <div className="p-3 rounded-lg bg-muted/20 border border-border text-[10px] text-muted-foreground/80">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-1">
            <Info className="w-3.5 h-3.5" />
            <span>Phương pháp</span>
          </div>
          <div>• MCLP (Maximizing Coverage Location Problem) — tối đa hoá đi coverage trong ngân sách</div>
          <div>• Trọng số: proximity 0.40 · urgency 0.25 · condition 0.25 · availability 0.10</div>
          <div>• Cache: {meta.cached ? "cache" : "mới"} · Solver: {meta.solver || "unknown"}</div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ── Overlay ─────────────────────────────────────────────────────────────────

const _iconCache = new Map<string, L.DivIcon>();

function getFacilityIcon(planId: string): L.DivIcon {
  const key = `facility-${planId}`;
  const cached = _iconCache.get(key);
  if (cached) return cached;
  const color = PLAN_COLORS[planId] || "#647493";
  const svg = `<svg viewBox="0 0 24 24" class="w-4 h-4" fill="${color}"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7V5h10v8z"/></svg>`;
  const html = `<div class="relative flex items-center justify-center" style="width:26px;height:26px">${svg}</div>`;
  const icon = L.divIcon({
    className: "edumap-facility-marker shadow",
    html,
    iconSize: [26, 26],
    iconAnchor: [13, 27],
    popupAnchor: [0, -32],
  });
  _iconCache.set(key, icon);
  return icon;
}

function ResourceOptimizerOverlayMap({ data, points }: { data: any; points: any[] }) {
  const map = useMap();
  const features = useMemo(() => data?.features || [], [data]);

  const fitPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    features.forEach((f: any) => {
      const coords = f.geometry?.coordinates;
      if (coords && typeof coords[1] === "number") {
        pts.push({ lat: coords[1], lng: coords[0] });
      }
    });
    return pts;
  }, [features]);

  useEffect(() => {
    if (fitPoints.length > 0) {
      const group = L.featureGroup();
      fitPoints.forEach((ll) => group.addLayer(L.marker([ll.lat, ll.lng], {})));
      const bounds = group.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      group.clearLayers();
    }
  }, [fitPoints, map]);

  if (!features.length) return null;

  return (
    <>
      {/* Heatmap of all facility candidates */}
      <HeatmapLayer
        points={points
          .filter((p) => p.lat != null && p.lng != null)
          .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), intensity: 0.5 }))}
      />

      {/* Gap markers (areas needing coverage) */}
      {features
        .filter((f: any) => f.properties?.feature_type === "gap" || (!f.properties?.plan && f.properties?.gap_score != null))
        .slice(0, 50)
        .map((f: any, idx: number) => {
          const coords = f.geometry?.coordinates;
          if (!coords || typeof coords[1] !== "number") return null;
          const score = f.properties?.gap_score || 0;
          return (
            <Marker
              key={`gap-${idx}`}
              position={[coords[1], coords[0]]}
              icon={L.divIcon({
                className: "edumap-gap-marker shadow",
                html: `<div class="flex items-center justify-center" style="width:22px;height:22px"><svg viewBox="0 0 24 24" class="w-5 h-5"><path fill="#ef4444" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg></div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 24],
                popupAnchor: [0, -28],
              })}
            >
              <Popup>
                <div className="font-sans text-xs text-foreground">
                  <strong className="block text-red-400">Khoảng trống</strong>
                  <span className="block opacity-80 mt-0.5">
                    Điểm thiếu hụt: {Number(score * 100).toFixed(0)}%
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}

      {/* Facility markers colored by plan tier */}
      {features
        .filter((f: any) => f.properties?.plan)
        .slice(0, 100)
        .map((f: any, idx: number) => {
          const coords = f.geometry?.coordinates;
          if (!coords || typeof coords[1] !== "number") return null;
          const planId = f.properties.plan;
          const color = PLAN_COLORS[planId] || "#647493";
          return (
            <Marker
              key={`fac-${idx}`}
              position={[coords[1], coords[0]]}
              icon={L.divIcon({
                className: "edumap-facility-marker shadow",
                html: `<div class="relative flex items-center justify-center" style="width:24px;height:24px"><svg viewBox="0 0 24 24" class="absolute inset-0 w-6 h-6"><path fill="${color}" opacity="0.3" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg><div class="w-3.5 h-3.5 rounded-sm" style="background:${color}"></div></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 26],
                popupAnchor: [0, -30],
              })}
            >
              <Popup>
                <div className="font-sans text-xs text-foreground">
                  <strong className="block" style={{ color }}>
                    {f.properties.name || "Đề xuất cơ sở"}
                  </strong>
                  <span className="block opacity-80 mt-0.5">
                    Kế hoạch {planId} — phủ {f.properties.coverage_pct?.toFixed(0) || 0}%
                  </span>
                  {f.properties.nearest_population != null && (
                    <span className="block opacity-70 mt-0.5">
                      Dân số lân cận: {f.properties.nearest_population}
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

      {/* Gap circles with radius representing coverage deficit */}
      {features
        .filter((f: any) => f.properties?.gap_score != null && !f.properties?.plan)
        .slice(0, 30)
        .map((f: any, idx: number) => {
          const coords = f.geometry?.coordinates;
          if (!coords || typeof coords[1] !== "number") return null;
          const score = f.properties.gap_score || 0;
          return (
            <Circle
              key={`gap-circle-${idx}`}
              center={[coords[1], coords[0]]}
              radius={(1 + score * 4) * 500}
              pathOptions={{
                color: "#ef4444",
                fillColor: "#ef4444",
                weight: 1,
                fillOpacity: 0.12,
              }}
            />
          );
        })}
    </>
  );
}

export function ResourceOptimizerOverlay({ result, points }: ToolOverlayProps) {
  return <ResourceOptimizerOverlayMap data={result} points={points} />;
}

const ResourceOptimizerTool = {
  id: "resource-optimizer",
  label: "Tối ưu nguồn lực",
  longLabel: "Tối ưu Nguồn lực Giáo dục",
  icon: ThermometerSun,
  description: "MCLP tối ưu vị trí cơ sở trong ngân sách.",
  longDescription: "Tối ưu vị trí cơ sở giáo dụng mới bằng MCLP (Maximizing Coverage Location Problem) — tối đa hoá số người được phục vụ trong ngân sách.",
  authRequired: true,
  hideBaseLayers: false,
  defaultCenter: { lat: 10.957, lng: 106.843 },
  Panel: ResourceOptimizerPanel,
  Overlay: ResourceOptimizerOverlay,
};

export default ResourceOptimizerTool;
