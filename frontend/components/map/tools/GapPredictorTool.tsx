/**
 * Gap Predictor Tool (Idea #3 — AI Educational Gap Predictor)
 *
 * Merged into the unified Map Hub. Previously a standalone page at
 * `/map/gap-predictor`; now the `gap-predictor` tab on `/map`.
 *
 * Panel: region selector + forecast horizon + risk ranking + trend summary.
 * Overlay: risk heatmap (leaflet.heat) + risk-zone GeoJSON + gap markers.
 */
"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  BrainCircuit, RefreshCw, AlertCircle, Info, ExternalLink,
  CheckCircle2, Flame, BarChart3, MapPin,
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

const REGIONS = [
  { label: "Đồng Nai", value: "Đồng Nai" },
  { label: "TP. Hồ Chí Minh", value: "TP. Hồ Chí Minh" },
  { label: "Hà Nội", value: "Hà Nội" },
  { label: "Đà Nẵng", value: "Đà Nẵng" },
  { label: "Cần Thơ", value: "Cần Thơ" },
];

const STEPS_OPTIONS = [3, 5, 10];

function riskBadge(level: string) {
  if (level === "high") return { bg: "bg-red-500/15", border: "border-red-500/30", text: "text-red-400", Icon: AlertCircle };
  if (level === "medium") return { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400", Icon: AlertCircle };
  return { bg: "bg-green-500/15", border: "border-green-500/30", text: "text-green-400", Icon: CheckCircle2 };
}

function formatPct(v: number): string {
  return `${Number(v).toFixed(1)}%`;
}

function riskColor(level: string): string {
  if (level === "high") return "#ef4444";
  if (level === "medium") return "#f59e0b";
  return "#22c57e";
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function GapPredictorPanel({
  viewport, result, onResult, loading, setLoading, error, setError, active,
}: ToolPanelProps) {
  const [region, setRegion] = useState("Đồng Nai");
  const [stepsAhead, setStepsAhead] = useState(3);

  const fetchForecast = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/map/gap-forecast?region=${encodeURIComponent(region)}&steps=${stepsAhead}`;
      const res = await fetchWithRetry(url, { retries: 2 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = unwrapApiResponse<any>(json);
      onResult(data);
      if (data?.metadata?.degraded) {
        toast.warning(data.metadata.reason || "Dữ liệu đang trong chế độ giảm tốc.");
      }
    } catch (err: any) {
      logger.error("Gap forecast error", err);
      setError(err?.message || "Không thể tải dự báo khoảng trống.");
      toast.error("Tải dự báo thất bại — vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [region, stepsAhead, active, onResult, setLoading, setError]);

  useEffect(() => {
    if (active && !result) fetchForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const riskRanking = useMemo(() => (result?.risk_ranking || []).slice(0, 12), [result]);
  const trends = useMemo(() => result?.trends || [], [result]);
  const meta = useMemo(() => result?.metadata || {}, [result]);
  const heatPoints = useMemo(() => result?.heat_points || [], [result]);
  const geoFeatures = useMemo(() => result?.features || [], [result]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Kết hợp dự báo Holt's Linear (chuỗi thời gian) + DBSCAN (mật độ trường) để đưa ra bản đồ rủi ro và khu vực cần khảo sát sớm.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Khu vực</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="form-select mt-1 text-sm"
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
            className="form-select mt-1 text-sm"
          >
            {STEPS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s} năm</option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchForecast} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60"
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
          <span>{meta.reason || "Dữ liệu hiếm — kết quả chỉ mang tính tham khảo."}</span>
        </div>
      )}

      {/* Methodology */}
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
            <div>Cache: {meta.cached ? "cache" : "mới"} · DBSCAN ≤2000 pts · dự báo {meta.steps_ahead} năm</div>
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
              const b = riskBadge(t.risk_level || "low");
              return (
                <div key={t.metric_type} className={`p-2 rounded border ${b.bg} ${b.border}`}>
                  <div className="font-medium text-foreground">{t.metric_type}</div>
                  <div className="text-muted-foreground/70">
                    {t.growth_pct >= 0 ? "+" : ""}{t.growth_pct}%/năm
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
          <span>Bảng xếp hạng khu vực nguy cơ ({riskRanking.length})</span>
        </div>
        {riskRanking.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/65">Chưa có dữ liệu.</p>
        ) : (
          <div className="space-y-1">
            {riskRanking.map((r: any, i: number) => {
              const b = riskBadge(r.risk_level || "low");
              return (
                <div key={`${r.area}:${i}`} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-muted-foreground/60 text-right">{i + 1}.</span>
                  <span className={`w-2 h-2 rounded-full ${r.risk_level === "high" ? "bg-red-400" : r.risk_level === "medium" ? "bg-amber-400" : "bg-green-400"}`} />
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
                    {f.properties.area} — rủi ro{" "}
                    {formatPct((f.properties.risk_score_pct) || (f.properties.risk_score * 100))}
                    {" "}
                    <span className="opacity-70">({f.properties.trend})</span>
                  </span>
                </li>
              ))}
          </ul>
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

function getRiskIcon(riskLevel: string): L.DivIcon {
  const key = `gap-risk-${riskLevel}`;
  const cached = _iconCache.get(key);
  if (cached) return cached;
  const colorClass = riskLevel === "high" ? "text-red-500" : riskLevel === "medium" ? "text-amber-500" : "text-green-500";
  const html = `<div class="${colorClass} relative flex items-center justify-center" style="width:26px;height:26px"><svg viewBox="0 0 24 24" class="absolute inset-0 w-6 h-6"><path fill="currentColor" d="M12 2.5C8.17 2.5 5 5.67 5 9.5 5 14.85 11.25 20.15 11.53 20.46a1 1 0 001.46-.01C12.75 20.15 19 14.85 19 9.5 19 5.67 15.83 2.5 12 2.5zm0 13.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg></div>`;
  const icon = L.divIcon({
    className: "edumap-gap-marker shadow",
    html,
    iconSize: [26, 26],
    iconAnchor: [13, 27],
    popupAnchor: [0, -32],
  });
  _iconCache.set(key, icon);
  return icon;
}

function GapPredictorOverlayMap({ data, points }: { data: any; points: any[] }) {
  const map = useMap();
  const [geoMapCenter, setGeoMapCenter] = useState<[number, number]>([10.957, 106.843]);
  const fitPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    (data?.features || []).forEach((f: any) => {
      const coords = f.geometry?.coordinates;
      if (coords && typeof coords[0] === "number") {
        if (Array.isArray(coords[0]) && typeof coords[0][0] === "number") {
          const ring = coords[0];
          const lat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length;
          const lng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length;
          pts.push({ lat, lng });
        } else if (typeof coords[1] === "number") {
          pts.push({ lat: coords[1], lng: coords[0] });
        }
      }
    });
    return pts;
  }, [data]);

  useEffect(() => {
    const feats = data?.features || [];
    const agg = feats.find((f: any) => f.properties?.gap_type === "region_aggregate");
    if (agg?.geometry?.coordinates) {
      setGeoMapCenter([agg.geometry.coordinates[1], agg.geometry.coordinates[0]]);
    }
  }, [data]);

  useEffect(() => {
    if (fitPoints.length > 0) {
      const group = L.featureGroup();
      fitPoints.forEach((ll) => group.addLayer(L.marker([ll.lat, ll.lng], {})));
      const bounds = group.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      group.clearLayers();
    }
  }, [fitPoints, map]);

  if (!data?.features?.length) return null;

  return (
    <>
      <HeatmapLayer
        points={(data?.heat_points || []).map((p: any) => ({
          lat: Number(p[0]),
          lng: Number(p[1]),
          intensity: Number(p[2] || 0),
        }))}
      />

      <GeoJSON
        data={data}
        filter={(f: any) => f.properties?.gap_type !== "region_aggregate"}
        pathOptions={{
          color: "#0ea5e3",
          weight: 2,
          opacity: 0.8,
          fillColor: "#0ea5e3",
          fillOpacity: 0.1,
        }}
        pointToLayer={(feature: any, latlng: L.LatLngExpression) => {
          const props = feature.properties || {};
          return L.circleMarker(latlng, {
            radius: props.needs_survey ? 9 : 6,
            color: riskColor(props.risk_level || "low"),
            fillColor: riskColor(props.risk_level || "low"),
            fillOpacity: props.needs_survey ? 0.9 : 0.6,
          });
        }}
        onEachFeature={(feature: any, layer: L.Layer) => {
          const props = feature.properties || {};
          const title = props.area || "Khu vực";
          const score = props.risk_score_pct ?? (props.risk_score * 100).toFixed(1);
          layer.bindPopup(`
            <div class="font-sans text-xs text-foreground">
              <strong class="${props.risk_level === 'high' ? 'text-red-400' : props.risk_level === 'medium' ? 'text-amber-400' : 'text-green-400'}">${title}</strong>
              <span class="block opacity-80 mt-0.5">Rủi ro: ${score}% (${props.risk_level}) • ${props.trend}</span>
              ${props.point_count ? `<span class="block opacity-70 mt-0.5">${props.point_count} cơ sở</span>` : ""}
              ${props.needs_survey ? `<span class="block opacity-80 mt-0.5 text-red-400">→ Cần khảo sát</span>` : ""}
            </div>
          `);
        }}
      />

      {/* Gap (needs-survey) markers on top for emphasis. */}
      {data?.features
        ?.filter((f: any) => f.properties?.needs_survey)
        .slice(0, 50)
        .map((f: any, idx: number) => {
          const coords = f.geometry?.coordinates;
          if (!coords) return null;
          return (
            <Marker
              key={`gap-${idx}`}
              position={[coords[1], coords[0]]}
              icon={getRiskIcon(f.properties.risk_level || "high")}
            >
              <Popup>
                <div className="font-sans text-xs">
                  <strong className="block text-red-400">Vùng cần khảo sát</strong>
                  <span className="block opacity-80 mt-0.5">
                    {f.properties.area} — rủi ro {f.properties.risk_score_pct ?? (f.properties.risk_score * 100).toFixed(0)}%
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </>
  );
}

export function GapPredictorOverlay({ result, points }: ToolOverlayProps) {
  return <GapPredictorOverlayMap data={result} points={points} />;
}

// ── Tool definition ─────────────────────────────────────────────────────────

const GapPredictorTool = {
  id: "gap-predictor",
  label: "Dự báo khoảng trống",
  longLabel: "Dự báo Khoảng trống Giáo dục",
  icon: Flame,
  description: "Dự báo Holt's Linear + DBSCAN, bản đồ rủi ro và xu hướng.",
  longDescription: "Kết hợp dự báo Holt's Linear (chuỗi thời gian) + DBSCAN (mật độ trường) để đưa ra bản đồ rủi ro và khu vực cần khảo sát sớm.",
  authRequired: true,
  hideBaseLayers: false,
  defaultCenter: { lat: 10.957, lng: 106.843 },
  Panel: GapPredictorPanel,
  Overlay: GapPredictorOverlay,
};

export default GapPredictorTool;
